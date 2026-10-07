// ===== 週次レポート自動生成 =====
// 変更履歴（change_logs）と案件データから、チャットやメールにそのまま貼れる週報テキストを作る。
import { STATUS_LABEL, CLOSED_STATUSES, INTERVIEW_STATUSES, CA_MEMBERS, LOSS_POINT_LABEL } from './constants'
import { getAlert } from './alerts'
import { toDate, startOfDay, addDays, monthKeyOf, monthLabel, summarize } from './forecast'

const WEEK = '日月火水木金土'
const md = d => `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`
export const yen = n => `${Math.round(n || 0).toLocaleString()}万円`
const STAGE_SHORT = { interview1: '一次', interview2: '二次', interviewFinal: '最終' }

// 月曜はじまりの週
export function weekRange(today = new Date(), offsetWeeks = 0) {
  const d = startOfDay(today)
  const dow = (d.getDay() + 6) % 7
  const start = addDays(d, -dow + offsetWeeks * 7)
  return { start, end: addDays(start, 6) }
}

const LABEL_TO_KEY = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]))

// 週内のステータス到達を数える（同じ案件の同じステータスは1回とカウント）
export function weeklyMovements({ candidates, history = [], ca = 'all', start, end }) {
  const endExcl = addDays(end, 1)
  const inWeek = d => d && d >= start && d < endExcl
  const scoped = candidates.filter(c => ca === 'all' || c.assignedCA === ca)
  const byId = new Map(scoped.map(c => [c.id, c]))
  const reached = {} // statusKey -> Map(candidateId -> candidate)
  const add = (key, c) => { if (!reached[key]) reached[key] = new Map(); reached[key].set(c.id, c) }
  let created = 0
  const usesHistory = history.length > 0

  if (usesHistory) {
    const createdIds = new Set()
    for (const h of history) {
      const c = byId.get(h.candidateId)
      if (!c || !inWeek(toDate(h.createdAt))) continue
      if (h.field === 'create') createdIds.add(c.id)
      else if (h.field === 'status') { const k = LABEL_TO_KEY[h.newValue]; if (k) add(k, c) }
    }
    created = createdIds.size
  } else {
    // 履歴が無い場合：現在のステータスと変更日時からの簡易集計
    for (const c of scoped) {
      if (inWeek(toDate(c.createdAt))) created++
      if (inWeek(toDate(c.statusChangedAt))) add(c.status, c)
    }
  }
  const count = k => reached[k]?.size || 0
  const list = k => [...(reached[k]?.values() || [])]
  const interviewsHeld = scoped.filter(c => inWeek(toDate(c.interviewDate))).length
  const losses = CLOSED_STATUSES.map(k => ({ k, label: LOSS_POINT_LABEL[k] || STATUS_LABEL[k], n: count(k) })).filter(x => x.n)
  return {
    usesHistory, created, interviewsHeld,
    docs: count('screening'),
    docPassed: count('interview1'),
    later: new Set([...list('interview2'), ...list('interviewFinal')].map(c => c.id)).size,
    offers: count('offer'), wins: count('won'),
    offerList: list('offer'), winList: list('won'),
    losses, lossTotal: losses.reduce((s, x) => s + x.n, 0),
  }
}

export function buildWeeklyReport({ candidates, history = [], fc, targets, diagnosis = [], ca = 'all', today = new Date(), offsetWeeks = 0 }) {
  const { start, end } = weekRange(today, offsetWeeks)
  const scoped = candidates.filter(c => ca === 'all' || c.assignedCA === ca)
  const active = scoped.filter(c => !CLOSED_STATUSES.includes(c.status))
  const mv = weeklyMovements({ candidates, history, ca, start, end })
  const monthKey = monthKeyOf(startOfDay(today))
  const sm = summarize(fc, { monthKey, ca, targets })
  const L = []
  const who = ca === 'all' ? 'ユニット全体' : ca

  L.push(`【週次報告】${md(start)}〜${md(end)}｜${who}`)
  L.push('')

  // 今月の数字
  L.push(`■ 今月の数字（${monthLabel(monthKey, today)}）`)
  L.push(`・成約：${sm.won.length}件／${yen(sm.confirmed)}`)
  L.push(`・着地予測：${yen(sm.expected)}（堅め ${yen(sm.conservative)}／強気 ${yen(sm.optimistic)}）`)
  if (sm.target != null) {
    const pct = Math.round((sm.rate || 0) * 100)
    L.push(`・目標：${yen(sm.target)} → 達成見込み ${pct}%${sm.gap > 0 ? `（あと${yen(sm.gap)}）` : '（達成ペース）'}`)
  } else {
    L.push('・目標：未設定')
  }
  L.push('')

  // 今週の動き
  L.push('■ 今週の動き')
  L.push(`・新規 ${mv.created}件／書類提出 ${mv.docs}件／書類通過 ${mv.docPassed}件／面接実施 ${mv.interviewsHeld}件`)
  L.push(`・二次・最終へ ${mv.later}件／内定 ${mv.offers}件／成約 ${mv.wins}件`)
  L.push(`・失注 ${mv.lossTotal}件${mv.losses.length ? `（${mv.losses.map(x => `${x.label}${x.n}`).join('・')}）` : ''}`)
  if (!mv.usesHistory) L.push('　※変更履歴が無いため、現在のステータスからの簡易集計です')
  L.push('')

  // 成約・内定
  const wins = [...mv.winList.map(c => ({ c, kind: '成約' })), ...mv.offerList.filter(c => !mv.winList.some(w => w.id === c.id)).map(c => ({ c, kind: '内定' }))]
  if (wins.length) {
    L.push('■ 今週の成約・内定')
    for (const { c, kind } of wins) L.push(`・${c.candidateName}様 × ${c.company || '企業未設定'}（${kind}${Number(c.fee) > 0 ? `・${yen(c.fee)}` : ''}）`)
    L.push('')
  }

  // 翌週の面接予定
  const nextStart = addDays(start, 7), nextEnd = addDays(end, 8)
  const upcoming = active
    .filter(c => INTERVIEW_STATUSES.includes(c.status))
    .map(c => ({ c, d: toDate(c.interviewDate) }))
    .filter(x => x.d && x.d >= nextStart && x.d < nextEnd)
    .sort((a, b) => a.d - b.d)
  L.push(`■ ${offsetWeeks === 0 ? '来週' : '翌週'}の面接予定（${upcoming.length}件）`)
  if (upcoming.length) for (const { c, d } of upcoming) L.push(`・${md(d)} ${c.candidateName}様 × ${c.company || '企業未設定'}（${STAGE_SHORT[c.status] || ''}）${ca === 'all' ? `［${c.assignedCA}］` : ''}`)
  else L.push('・なし')
  L.push('')

  // 要フォロー
  const stalled = active.filter(c => getAlert(c).isAlert)
  L.push(`■ 要フォロー（停滞 ${stalled.length}件）`)
  if (stalled.length) {
    for (const c of stalled.slice(0, 8)) L.push(`・${c.candidateName}様 × ${c.company || '企業未設定'}：${getAlert(c).reasons[0]}${ca === 'all' ? `［${c.assignedCA}］` : ''}`)
    if (stalled.length > 8) L.push(`・ほか${stalled.length - 8}件`)
  } else L.push('・なし')
  L.push('')

  // 持ち駒アラート
  const thin = diagnosis.filter(d => (ca === 'all' || d.ca === ca) && d.level === 'low')
  const reprop = diagnosis.filter(d => (ca === 'all' || d.ca === ca) && d.level === 'zero')
  if (thin.length || reprop.length) {
    L.push(`■ 持ち駒アラート（持ち駒不足 ${thin.length}名・再提案 ${reprop.length}名）`)
    for (const d of thin.slice(0, 6)) L.push(`・${d.name}様：持ち駒${d.activeRows.length}社・決定確率${Math.round(d.P * 100)}%${d.need ? `（あと${d.need}社の書類提出で${Math.round(d.reach * 100)}%）` : ''}${ca === 'all' ? `［${d.ca}］` : ''}`)
    if (thin.length > 6) L.push(`・ほか持ち駒不足${thin.length - 6}名`)
    if (reprop.length) L.push(`・全社見送りで再提案が必要：${reprop.slice(0, 5).map(d => `${d.name}様`).join('、')}${reprop.length > 5 ? ` ほか${reprop.length - 5}名` : ''}`)
    L.push('')
  }

  // 担当別
  if (ca === 'all') {
    L.push(`■ 担当別（${monthLabel(monthKey, today)}）`)
    for (const m of CA_MEMBERS) {
      const s = summarize(fc, { monthKey, ca: m, targets })
      const tgt = s.target != null ? `／目標${yen(s.target)}（${Math.round((s.rate || 0) * 100)}%）` : ''
      L.push(`・${m}：確定${yen(s.confirmed)}／予測${yen(s.expected)}${tgt}`)
    }
    L.push('')
  }

  // 来週の注力
  const focus = []
  const aRows = sm.pipe.filter(r => r.rank === 'A')
  const bRows = sm.pipe.filter(r => r.rank === 'B')
  if (aRows.length) focus.push(`Aヨミ${aRows.length}件（計${yen(aRows.reduce((s, r) => s + r.feeUsed, 0))}）の取り切り：${aRows.slice(0, 3).map(r => `${r.c.candidateName}様×${r.c.company}`).join('、')}`)
  if (bRows.length) focus.push(`Bヨミ${bRows.length}件の確度アップ（最終面接の対策・意向の再確認）`)
  if (upcoming.length) focus.push(`面接${upcoming.length}件の事前対策と、実施後24時間以内の合否・意向回収`)
  if (stalled.length) focus.push(`停滞${stalled.length}件への連絡・状況確認`)
  if (thin.length + reprop.length) focus.push(`持ち駒不足・再提案の${thin.length + reprop.length}名に、通りやすい企業への並行応募を提案`)
  if (sm.gap > 0) focus.push(`目標まであと${yen(sm.gap)}。来月以降に向けて書類提出数の積み増し`)
  if (focus.length) {
    L.push(`■ ${offsetWeeks === 0 ? '来週' : '今週'}の注力`)
    for (const f of focus) L.push(`・${f}`)
  }

  return L.join('\n').trim()
}
