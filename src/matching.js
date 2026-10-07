// ===== 作戦ボード：持ち駒診断・企業カルテ =====
// 「誰を・どこに出せば決まるか」を、ヨミ管理と同じ確率エンジン（forecast.js）から計算する。
import { CLOSED_STATUSES, CA_MEMBERS, LOSS_POINT_LABEL, STATUS_LABEL } from './constants'
import { companyKey, pathProb, toDate, daysBetween } from './forecast'

// 決定確率の目標ライン（並行応募をこの確率まで積み上げるのが目安）
export const TARGET_P = 0.5
// 全社見送りになった求職者を「再提案が必要」として表示する期間（最後の見送りからの日数）
const REPROPOSE_DAYS = 30
// 決定済みの求職者を表示する期間（成約からの日数）
const PLACED_SHOW_DAYS = 60

const median = xs => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const shortCompany = name => (name || '').normalize('NFKC').replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)/g, '').trim()

// 1案件の「あるステージに滞在した日数」（履歴から。現在そのステージにいるものは含めない）
function stageDurations(events, stage, createdAt) {
  const out = []
  let enteredAt = null
  let first = true
  for (const e of events) {
    if (e.create || !e.from || !e.to) continue
    if (first && e.from === stage && createdAt && createdAt <= e.at) enteredAt = createdAt
    first = false
    if (e.from === stage && enteredAt) { out.push(Math.max(daysBetween(enteredAt, e.at), 0)); enteredAt = null }
    if (e.to === stage) enteredAt = e.at
  }
  return out
}

// ---------- 企業カルテ ----------
export function buildCompanyInsights(candidates, fc) {
  const groups = new Map()
  for (const c of candidates) {
    const key = companyKey(c.company)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, { key, names: new Map(), apps: [] })
    const g = groups.get(key)
    const nm = c.company.trim()
    g.names.set(nm, (g.names.get(nm) || 0) + 1)
    g.apps.push(c)
  }

  const out = []
  for (const g of groups.values()) {
    const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const rates = fc.companyRates.get(g.key) || fc.rates
    const apps = g.apps
    const won = apps.filter(c => c.status === 'won')
    const active = apps.filter(c => !CLOSED_STATUSES.includes(c.status) && c.status !== 'won')
    const fees = apps.map(c => Number(c.fee)).filter(f => f > 0)
    const avgFee = fees.length ? Math.round(fees.reduce((a, b) => a + b, 0) / fees.length) : null
    const feeUsed = avgFee ?? fc.avgFee
    const pDoc = pathProb('screening', rates) // 書類提出から成約までの確率
    const docDays = []
    for (const c of apps) {
      const ev = fc.timelines.get(c.id)
      if (!ev) continue
      const created = ev.find(e => e.create)?.at || toDate(c.createdAt)
      docDays.push(...stageDurations(ev, 'screening', created))
    }
    const docSpeed = docDays.length ? median(docDays) : null
    const slowAfter = Math.max(5, Math.round((docSpeed ?? 7) + 2))
    const waiting = active
      .filter(c => c.status === 'screening')
      .map(c => { const d = toDate(c.statusChangedAt); return { c, days: d ? Math.max(0, daysBetween(d, fc.today)) : 0 } })
      .sort((a, b) => b.days - a.days)
    const overdue = waiting.filter(w => w.days >= slowAfter)
    const byCa = CA_MEMBERS
      .map(m => ({ ca: m, apps: apps.filter(c => c.assignedCA === m).length, won: won.filter(c => c.assignedCA === m).length }))
      .filter(x => x.apps)
    const losses = CLOSED_STATUSES
      .map(s => ({ s, label: LOSS_POINT_LABEL[s] || STATUS_LABEL[s], n: apps.filter(c => c.status === s).length }))
      .filter(x => x.n)

    out.push({
      key: g.key, name, short: shortCompany(name) || name,
      apps, total: apps.length, active, won,
      avgFee, feeUsed, feeEstimated: avgFee == null,
      rates, pDoc, evPerDoc: pDoc * feeUsed,
      docSpeed, docSpeedN: docDays.length, slowAfter, waiting, overdue,
      byCa, losses,
    })
  }
  return out.sort((a, b) => b.evPerDoc - a.evPerDoc)
}

// ---------- 持ち駒診断 ----------
export const LEVELS = {
  low:    { label: '持ち駒不足', tone: 'bad',  order: 0, desc: '選考中だが決定確率30%未満' },
  zero:   { label: '再提案',     tone: 'bad',  order: 1, desc: '全社見送り・選考中の企業なし' },
  mid:    { label: '要注意',     tone: 'warn', order: 2, desc: '決定確率30〜59%' },
  safe:   { label: '安全圏',     tone: 'good', order: 3, desc: '決定確率60%以上' },
  placed: { label: '決定済み',   tone: 'good', order: 4, desc: '成約済み' },
}

export function buildCandidateDiagnosis(candidates, fc, companies) {
  const rowById = new Map(fc.rows.map(r => [r.c.id, r]))
  const unitDocP = pathProb('screening', fc.rates)
  const groups = new Map()
  for (const c of candidates) {
    const name = (c.candidateName || '').trim()
    if (!name) continue
    const key = `${c.assignedCA}|${name}`
    if (!groups.has(key)) groups.set(key, { key, name, ca: c.assignedCA, apps: [] })
    groups.get(key).apps.push(c)
  }

  const out = []
  for (const g of groups.values()) {
    const placed = g.apps.some(c => c.status === 'won')
    const activeRows = g.apps
      .filter(c => !CLOSED_STATUSES.includes(c.status) && c.status !== 'won')
      .map(c => rowById.get(c.id))
      .filter(Boolean)
      .sort((a, b) => b.prob - a.prob)
    const P = placed ? 1 : 1 - activeRows.reduce((q, r) => q * (1 - r.prob), 1)
    const last = g.apps
      .map(c => toDate(c.statusChangedAt) || toDate(c.createdAt))
      .filter(Boolean)
      .sort((a, b) => b - a)[0]
    const idleDays = last ? daysBetween(last, fc.today) : null
    if (placed) {
      const wonAt = g.apps.filter(c => c.status === 'won').map(c => toDate(c.statusChangedAt)).filter(Boolean).sort((a, b) => b - a)[0]
      if (wonAt && daysBetween(wonAt, fc.today) > PLACED_SHOW_DAYS) continue
    } else if (!activeRows.length) {
      // 全社クローズ：本人が離脱した人は対象外。見送りから時間が経った人も対象外
      const lastClosed = [...g.apps].sort((a, b) => (toDate(b.statusChangedAt) || 0) - (toDate(a.statusChangedAt) || 0))[0]
      if (lastClosed?.status === 'withdrawn') continue
      if (idleDays != null && idleDays > REPROPOSE_DAYS) continue
    }

    // まだ応募していない企業から、書類1件あたりの期待売上が高い順に提案
    const applied = new Set(g.apps.map(c => companyKey(c.company)).filter(Boolean))
    const recs = placed ? [] : companies.filter(co => !applied.has(co.key)).slice(0, 3)

    // 決定確率を目標ラインまで上げるのに必要な追加の書類提出数
    let need = 0, reach = P
    if (!placed && P < TARGET_P) {
      const queue = recs.map(co => co.pDoc)
      while (reach < TARGET_P && need < 30) {
        const q = queue.length ? queue.shift() : unitDocP
        reach = 1 - (1 - reach) * (1 - q)
        need++
      }
    }
    const pct = Math.round(P * 100) // 表示上の%と区分をそろえる
    const level = placed ? 'placed' : !activeRows.length ? 'zero' : pct < 30 ? 'low' : pct < 60 ? 'mid' : 'safe'
    out.push({
      key: g.key, name: g.name, ca: g.ca, apps: g.apps, activeRows,
      closedCount: g.apps.filter(c => CLOSED_STATUSES.includes(c.status)).length,
      placed, P, level, need, reach, recs, idleDays,
      priority: Math.max(0, ...g.apps.map(c => c.priority || 0)),
      expectedFee: activeRows.reduce((s, r) => s + r.ev, 0),
    })
  }
  return out.sort((a, b) =>
    LEVELS[a.level].order - LEVELS[b.level].order ||
    b.priority - a.priority ||
    a.P - b.P,
  )
}

// 決定見込み人数（各求職者の決定確率の合計）
export function expectedPlacements(diag) {
  return diag.reduce((s, d) => s + d.P, 0)
}
