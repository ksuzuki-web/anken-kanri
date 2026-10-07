// ===== ヨミ管理（着地予測）エンジン =====
// 案件データ＋ステータス変更履歴から、
//   ・各選考関門の通過率（実績×業界目安のブレンド）
//   ・各ステージの平均滞在日数
//   ・案件ごとの成約確率／期待値／見込み時期／ヨミランク
// を算出する。UIに依存しない純粋関数だけで構成。
import { CLOSED_STATUSES, STATUSES, INTERVIEW_STATUSES, CA_MEMBERS } from './constants'
import { getAlert } from './alerts'

export const STAGE_ORDER = ['lead', 'screening', 'interview1', 'interview2', 'interviewFinal', 'offer', 'won']
const IDX = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]))
const LABEL_TO_KEY = Object.fromEntries(STATUSES.map(s => [s.label, s.key]))

// 選考の関門。prior は人材紹介の一般的な目安（実績が少ないうちはこちらが効く）
export const GATES = [
  { key: 'apply',  label: '応募承諾', desc: 'リード → 書類提出',   prior: 0.40 },
  { key: 'doc',    label: '書類通過', desc: '書類選考 → 一次面接', prior: 0.35 },
  { key: 'first',  label: '一次通過', desc: '一次面接 → 次の選考', prior: 0.45 },
  { key: 'second', label: '二次通過', desc: '二次面接 → 最終面接', prior: 0.60 },
  { key: 'final',  label: '最終通過', desc: '最終面接 → 内定',     prior: 0.55 },
  { key: 'accept', label: '内定承諾', desc: '内定 → 成約',         prior: 0.55 },
]
// 実績を何件分の重みで目安に寄せるか（少数データで数字が暴れないように）
const PRIOR_WEIGHT = 5

// 現在ステータスから成約までに越える関門
const GATE_PATH = {
  lead:           ['apply', 'doc', 'first', 'final', 'accept'],
  screening:      ['doc', 'first', 'final', 'accept'],
  interview1:     ['first', 'final', 'accept'],
  interview2:     ['second', 'final', 'accept'],
  interviewFinal: ['final', 'accept'],
  offer:          ['accept'],
  won:            [],
}

// 各ステージの標準滞在日数（実績が少ないときの目安）
export const DEFAULT_STAGE_DAYS = { lead: 7, screening: 7, interview1: 10, interview2: 10, interviewFinal: 7, offer: 7 }
// 現在ステージを抜けたあと、成約までに通過するステージ
const STAGES_AFTER = {
  lead:           ['screening', 'interview1', 'interviewFinal', 'offer'],
  screening:      ['interview1', 'interviewFinal', 'offer'],
  interview1:     ['interviewFinal', 'offer'],
  interview2:     ['interviewFinal', 'offer'],
  interviewFinal: ['offer'],
  offer:          [],
}
// 履歴が無い落選・離脱は、どこで落ちたかをステータスから推定
const DEFAULT_FAIL_STAGE = { rejectedDoc: 'screening', rejected1: 'interview1', rejectedFinal: 'interviewFinal', withdrawn: null }

// ヨミランクのしきい値（成約確率）
export const RANKS = [
  { key: 'A', min: 0.5,  label: 'Aヨミ', desc: '確度50%以上（内定・着地候補の最終など）' },
  { key: 'B', min: 0.25, label: 'Bヨミ', desc: '確度25〜49%（最終面接など）' },
  { key: 'C', min: 0.1,  label: 'Cヨミ', desc: '確度10〜24%（一次・二次面接など）' },
  { key: 'D', min: 0,    label: 'Dヨミ', desc: '確度10%未満（書類・リード）' },
]

// これ以上動きのない選考中案件は「実質失注」とみなす（通過率の計算と確度の両方に反映）
export const STALE_DAYS = 30

const ADJUST = {
  stale:       { label: '長期停滞',     mult: 0.4,  tone: 'neg' },
  stalled:     { label: '停滞中',       mult: 0.7,  tone: 'neg' },
  winCand:     { label: '着地候補',     mult: 1.25, tone: 'pos' },
  noInterview: { label: '面接日未確定', mult: 0.9,  tone: 'neg' },
}

// ---------- 日付ユーティリティ ----------
export function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v) ? null : v
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(v)
  return isNaN(d) ? null : d
}
export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000) }
export function addDays(d, n) { const x = startOfDay(d); x.setDate(x.getDate() + n); return x }
export function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + n, 1))
}
export function monthLabel(key, today = new Date()) {
  const [y, m] = key.split('-').map(Number)
  return y === today.getFullYear() ? `${m}月` : `${y}年${m}月`
}
// 今日を含む、月末までの平日数（祝日は考慮しない）
export function businessDaysLeft(today = new Date()) {
  const d = startOfDay(today)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  let n = 0
  for (const x = new Date(d); x <= end; x.setDate(x.getDate() + 1)) {
    const w = x.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0)
const median = arr => {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ---------- 履歴の整形 ----------
// change_logs（field = status / create）を候補ごとの時系列イベントに整形
export function buildTimelines(history = []) {
  const map = new Map()
  for (const h of history) {
    const at = toDate(h.createdAt)
    if (!at || !h.candidateId) continue
    if (!map.has(h.candidateId)) map.set(h.candidateId, [])
    if (h.field === 'status') {
      map.get(h.candidateId).push({ at, from: LABEL_TO_KEY[h.oldValue] || null, to: LABEL_TO_KEY[h.newValue] || null })
    } else if (h.field === 'create') {
      map.get(h.candidateId).push({ at, create: true })
    }
  }
  for (const ev of map.values()) ev.sort((a, b) => a.at - b.at)
  return map
}

// 1案件の「どこまで進んだか／どこで落ちたか」
function analyzeJourney(c, events, today) {
  const visited = new Set([c.status])
  for (const e of events) { if (e.from) visited.add(e.from); if (e.to) visited.add(e.to) }
  let closed = CLOSED_STATUSES.includes(c.status)
  let failStage = null
  // 選考中のまま長期間動きが無い案件は、そのステージで止まった（実質失注）とみなす
  if (!closed && c.status !== 'won' && isStale(c, today)) {
    closed = true
    failStage = c.status
  }
  if (closed && !failStage) {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      if (e.to && CLOSED_STATUSES.includes(e.to) && e.from && IDX[e.from] != null) { failStage = e.from; break }
    }
    if (!failStage) failStage = DEFAULT_FAIL_STAGE[c.status] ?? null
  }
  let maxIdx = -1
  for (const s of visited) if (IDX[s] != null) maxIdx = Math.max(maxIdx, IDX[s])
  if (failStage) maxIdx = Math.max(maxIdx, IDX[failStage])
  return { visited, maxIdx, failStage, closed }
}

function gateOutcome(gate, j) {
  const failedHere = stage => j.closed && j.failStage === stage ? 'fail' : null
  switch (gate) {
    case 'apply':
      if (!j.visited.has('lead')) return null
      return j.maxIdx >= IDX.screening ? 'pass' : failedHere('lead')
    case 'doc':
      if (j.maxIdx < IDX.screening) return null
      return j.maxIdx >= IDX.interview1 ? 'pass' : failedHere('screening')
    case 'first':
      if (j.maxIdx < IDX.interview1) return null
      return j.maxIdx >= IDX.interview2 ? 'pass' : failedHere('interview1')
    case 'second':
      if (!j.visited.has('interview2')) return null
      return j.maxIdx >= IDX.interviewFinal ? 'pass' : failedHere('interview2')
    case 'final':
      if (!(j.visited.has('interviewFinal') || j.maxIdx >= IDX.offer)) return null
      return j.maxIdx >= IDX.offer ? 'pass' : failedHere('interviewFinal')
    case 'accept':
      if (j.maxIdx < IDX.offer) return null
      return j.maxIdx >= IDX.won ? 'pass' : failedHere('offer')
    default:
      return null
  }
}

function isStale(c, today) {
  const changed = toDate(c.statusChangedAt)
  return !!changed && daysBetween(changed, today) >= STALE_DAYS
}

// ---------- 通過率 ----------
export function computeGateRates(candidates, timelines = new Map(), today = new Date()) {
  const res = {}
  for (const g of GATES) res[g.key] = { ...g, pass: 0, fail: 0 }
  for (const c of candidates) {
    const j = analyzeJourney(c, timelines.get(c.id) || [], today)
    for (const g of GATES) {
      const o = gateOutcome(g.key, j)
      if (o) res[g.key][o]++
    }
  }
  for (const g of GATES) {
    const r = res[g.key]
    r.n = r.pass + r.fail
    r.actual = r.n ? r.pass / r.n : null
    r.p = (r.pass + g.prior * PRIOR_WEIGHT) / (r.n + PRIOR_WEIGHT)
  }
  return res
}

// ---------- ステージ滞在日数 ----------
export function computeStageDays(candidates, timelines = new Map()) {
  const samples = {}
  for (const s of Object.keys(DEFAULT_STAGE_DAYS)) samples[s] = []
  for (const c of candidates) {
    const ev = timelines.get(c.id)
    if (!ev || !ev.length) continue
    const created = ev.find(e => e.create)?.at || toDate(c.createdAt)
    let cur = null, enteredAt = null
    for (const e of ev) {
      if (e.create || !e.from || !e.to) continue
      const forward = (IDX[e.to] != null && IDX[e.to] > IDX[e.from]) || CLOSED_STATUSES.includes(e.to)
      let start = null
      if (cur === e.from && enteredAt) start = enteredAt
      else if (cur === null && created && created <= e.at) start = created
      if (forward && start && samples[e.from]) samples[e.from].push(Math.max(daysBetween(start, e.at), 0))
      cur = e.to; enteredAt = e.at
    }
  }
  const out = {}
  for (const [s, def] of Object.entries(DEFAULT_STAGE_DAYS)) {
    const xs = samples[s]
    const n = xs.length
    // 少数データは目安に寄せる（3件分の重み）＋最低2日
    const learned = n ? median(xs) : def
    const days = Math.max(2, Math.round((learned * n + def * 3) / (n + 3)))
    out[s] = { days, n, default: def }
  }
  return out
}

// ---------- 案件ごとの予測 ----------
export function rankOf(prob) {
  return RANKS.find(r => prob >= r.min)?.key || 'D'
}

function forecastRow(c, ctx) {
  if (CLOSED_STATUSES.includes(c.status)) return null
  const fee = Number(c.fee) > 0 ? Number(c.fee) : null
  const feeUsed = fee ?? ctx.avgFee
  const base = { c, fee, feeUsed, feeEstimated: fee == null }

  if (c.status === 'won') {
    const closeDate = toDate(c.statusChangedAt) || ctx.today
    return { ...base, won: true, prob: 1, baseProb: 1, factors: [], ev: feeUsed, rank: 'won', closeDate, monthKey: monthKeyOf(closeDate), expectedDays: 0 }
  }

  const path = GATE_PATH[c.status] || GATE_PATH.lead
  const baseProb = path.reduce((p, g) => p * ctx.rates[g].p, 1)
  const factors = []
  if (isStale(c, ctx.today)) factors.push(ADJUST.stale)
  else if (getAlert(c).isAlert) factors.push(ADJUST.stalled)
  if (c.winCandidate) factors.push(ADJUST.winCand)
  if (INTERVIEW_STATUSES.includes(c.status) && !c.interviewDate) factors.push(ADJUST.noInterview)
  const prob = Math.min(0.95, Math.max(0.01, factors.reduce((p, f) => p * f.mult, baseProb)))

  // 見込み時期：現ステージの残り日数 + 以降のステージの標準日数
  const sd = s => ctx.stageDays[s]?.days ?? DEFAULT_STAGE_DAYS[s] ?? 7
  const changed = toDate(c.statusChangedAt)
  const daysIn = changed ? Math.max(0, daysBetween(changed, ctx.today)) : 0
  let remain
  const iv = toDate(c.interviewDate)
  if (INTERVIEW_STATUSES.includes(c.status) && iv) {
    const until = daysBetween(ctx.today, iv)
    remain = until >= 0 ? until + 4 : Math.max(4 + until, 1) // 面接後は結果待ち（約4日）
  } else {
    remain = Math.max(sd(c.status) - daysIn, 2)
  }
  const expectedDays = remain + (STAGES_AFTER[c.status] || []).reduce((s, x) => s + sd(x), 0)
  const closeDate = addDays(ctx.today, expectedDays)

  return {
    ...base, won: false, prob, baseProb, factors,
    ev: feeUsed * prob, rank: rankOf(prob),
    closeDate, monthKey: monthKeyOf(closeDate), expectedDays,
  }
}

// 全体の予測コンテキストを作る（App から1回だけ呼ぶ）
export function buildForecast(candidates, history = [], today = new Date()) {
  const timelines = buildTimelines(history)
  const rates = computeGateRates(candidates, timelines, today)
  const stageDays = computeStageDays(candidates, timelines)
  const fees = candidates.map(c => Number(c.fee)).filter(f => f > 0)
  const avgFee = fees.length ? Math.round(sum(fees, f => f) / fees.length) : 80
  const ctx = { rates, stageDays, avgFee, today: startOfDay(today), historyCount: history.length }
  const rows = candidates.map(c => forecastRow(c, ctx)).filter(Boolean)
  return { ...ctx, rows }
}

// ---------- 目標 ----------
// targets = { 'YYYY-MM': { 鈴木: 300, 高井: 200, ... } }
// 当月が未設定なら直近の過去月の値を引き継ぐ
export function getTarget(targets, monthKey, ca) {
  if (!targets) return null
  if (ca === 'all') {
    let total = 0, any = false
    for (const m of CA_MEMBERS) {
      const v = getTarget(targets, monthKey, m)
      if (v != null) { total += v; any = true }
    }
    return any ? total : null
  }
  const keys = Object.keys(targets).filter(k => k <= monthKey).sort().reverse()
  for (const k of keys) {
    const v = targets[k]?.[ca]
    if (v != null && v !== '' && !isNaN(Number(v))) return Number(v)
  }
  return null
}
export function isTargetInherited(targets, monthKey) {
  return !targets?.[monthKey] || !Object.values(targets[monthKey]).some(v => v != null && v !== '')
}

// ---------- 月次サマリー ----------
export function summarize(fc, { monthKey, ca = 'all', targets }) {
  const rows = fc.rows.filter(r => ca === 'all' || r.c.assignedCA === ca)
  const won = rows.filter(r => r.won && r.monthKey === monthKey)
  const pipe = rows.filter(r => !r.won && r.monthKey === monthKey).sort((a, b) => b.ev - a.ev)
  const later = rows.filter(r => !r.won && r.monthKey > monthKey)
  const confirmed = sum(won, r => r.feeUsed)
  const byRank = k => pipe.filter(r => r.rank === k)
  const expected = confirmed + sum(pipe, r => r.ev)
  const target = getTarget(targets, monthKey, ca)
  return {
    monthKey, ca, won, pipe, later,
    confirmed,
    pipeEv: sum(pipe, r => r.ev),
    expected,
    conservative: confirmed + sum(byRank('A'), r => r.feeUsed),
    optimistic: confirmed + sum([...byRank('A'), ...byRank('B')], r => r.feeUsed),
    laterEv: sum(later, r => r.ev),
    target,
    gap: target != null ? target - expected : null,
    rate: target ? expected / target : null,
  }
}

// ---------- KPI逆算 ----------
export function backPlan(gap, fc) {
  if (gap == null || gap <= 0) return null
  const { rates, avgFee, stageDays } = fc
  const wins = gap / avgFee
  const offers = wins / rates.accept.p
  const finals = offers / rates.final.p
  const firsts = finals / rates.first.p
  const docs = firsts / rates.doc.p
  const leads = docs / rates.apply.p
  const leadTime = ['screening', 'interview1', 'interviewFinal', 'offer'].reduce((s, k) => s + (stageDays[k]?.days ?? DEFAULT_STAGE_DAYS[k]), 0)
  return {
    avgFee, leadTime,
    steps: [
      { key: 'won',            label: '成約',       n: wins },
      { key: 'offer',          label: '内定',       n: offers },
      { key: 'interviewFinal', label: '最終面接',   n: finals },
      { key: 'interview1',     label: '一次面接',   n: firsts },
      { key: 'screening',      label: '書類提出',   n: docs },
      { key: 'lead',           label: '求人提案',   n: leads },
    ],
  }
}

// 目安と比べて最も弱い関門（実績3件以上のもの）
export function findBottleneck(rates) {
  let worst = null
  for (const g of GATES) {
    const r = rates[g.key]
    if (r.n < 3) continue
    const ratio = r.p / g.prior
    if (ratio < 0.92 && (!worst || ratio < worst.ratio)) worst = { ...r, ratio }
  }
  return worst
}
