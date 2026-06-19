import { CLOSED_STATUSES, INTERVIEW_STATUSES, WIN_COUNT_STATUSES, LOSS_POINT_LABEL, STATUS_LABEL } from './constants'
import { getAlert, getInconsistencies } from './alerts'

// 担当CAの状況フィードバックを「現状のデータから」自動生成する。
// ※将来は第3引数 externalData（別途の成果分析データ）を渡して精度を上げられる設計。
export function generateCaFeedback(ca, all, externalData = null) {
  const mine = all.filter(c => c.assignedCA === ca)
  const active = mine.filter(c => !CLOSED_STATUSES.includes(c.status))
  const closed = mine.filter(c => CLOSED_STATUSES.includes(c.status))
  const names = new Set(active.map(c => c.candidateName))
  const cnt = s => active.filter(c => c.status === s).length

  const leads = cnt('lead')
  const screening = cnt('screening')
  const interviewing = active.filter(c => INTERVIEW_STATUSES.includes(c.status)).length
  const offers = cnt('offer')
  const won = cnt('won')
  const stalled = active.filter(c => getAlert(c).isAlert)
  const issues = active.filter(c => getInconsistencies(c).length > 0)
  const winApps = active.filter(c => c.winCandidate && WIN_COUNT_STATUSES.includes(c.status))
  const winFee = winApps.reduce((s, c) => s + (Number(c.fee) || 0), 0)
  const highPri = active.filter(c => (c.priority ?? 0) >= 4).length
  const unsetPri = active.filter(c => !c.priority).length
  const activeTotal = active.length

  const lossCounts = CLOSED_STATUSES.map(s => ({ s, n: closed.filter(c => c.status === s).length }))
  const topLoss = lossCounts.filter(x => x.n > 0).sort((a, b) => b.n - a.n)[0]

  // ① 進捗評価
  const stalledRatio = activeTotal ? stalled.length / activeTotal : 0
  let rating, ratingColor
  if (activeTotal === 0) { rating = 'データ不足'; ratingColor = '#94a3b8' }
  else if (stalledRatio <= 0.15 && (interviewing + offers + won) >= 2) { rating = '順調'; ratingColor = '#16a34a' }
  else if (stalledRatio <= 0.35) { rating = 'おおむね順調'; ratingColor = '#0ea5e9' }
  else { rating = '要テコ入れ'; ratingColor = '#f59e0b' }

  const summary = activeTotal === 0
    ? '現在アクティブな案件がありません。まずはリード獲得・案件化から始めましょう。'
    : `アクティブ${activeTotal}件（${names.size}名）。面接フェーズ${interviewing}件／内定${offers}件／成約${won}件。着地候補${winApps.length}件（見込み${winFee}万円）。停滞${stalled.length}件・要確認${issues.length}件。`

  // ② 良い点・改善点
  const goods = []
  if (winApps.length) goods.push(`着地候補が${winApps.length}件（見込み${winFee}万円）あり、受注の柱が見えている`)
  if (offers + won > 0) goods.push(`内定・成約まで到達した案件が${offers + won}件ある`)
  if (interviewing >= 2) goods.push(`面接フェーズの案件が${interviewing}件あり、選考が前に進んでいる`)
  if (activeTotal > 0 && stalled.length === 0) goods.push('停滞案件がなく、フォローが行き届いている')
  if (highPri > 0) goods.push(`高注力(★4以上)が${highPri}件あり、優先順位づけができている`)
  if (!goods.length) goods.push('まずは案件の母数を積み上げる段階。ここからの伸びしろが大きい')

  const improves = []
  if (stalled.length) improves.push(`停滞中が${stalled.length}件。放置すると失注・離脱リスクが上がる`)
  if (issues.length) improves.push(`入力漏れ・要確認が${issues.length}件（面接日未入力／合否回収漏れ等）`)
  if (leads > 0 && leads >= screening + interviewing) improves.push(`リード止まりが多い（${leads}件）。案件化（書類提出）の推進が課題`)
  if (unsetPri > 0) improves.push(`注力度が未設定の案件が${unsetPri}件。優先順位づけで動きが速くなる`)
  if (topLoss) improves.push(`失注は「${LOSS_POINT_LABEL[topLoss.s] || STATUS_LABEL[topLoss.s]}」が最多（${topLoss.n}件）。ここが伸びしろ`)
  if (activeTotal > 0 && winApps.length === 0) improves.push('着地候補マークが未活用。受注見込みの可視化を')
  if (!improves.length) improves.push('現状は大きな問題なし。質を保ちつつ母数を増やせるとなお良い')

  // ③ 今後優先すべきアクション（カテゴリ付き）
  const actions = []
  if (stalled.length) actions.push({ cat: '求職者マター', text: `停滞中の${stalled.length}件に本日中に連絡を入れる（最優先）` })
  const followUp = active.filter(c => INTERVIEW_STATUSES.includes(c.status) && getInconsistencies(c).some(x => x.includes('合否') || x.includes('過ぎ')))
  if (followUp.length) actions.push({ cat: '求職者マター', text: `面接実施済み${followUp.length}件の合否・意向回収を完了する` })
  if (offers) actions.push({ cat: '成果最大化', text: `内定${offers}件の承諾意向を確認し、返答期限を握る` })
  if (winApps.length) actions.push({ cat: '成果最大化', text: `着地候補${winApps.length}件の最終フォローで受注確度を上げる` })
  if (leads >= 1 && screening + interviewing < leads) actions.push({ cat: '案件作り', text: `リード${leads}件の案件化（書類提出）を進める` })
  if (activeTotal < 5) actions.push({ cat: '案件作り', text: '案件の母数が少なめ。新規リードの開拓で母数を確保する' })
  if (!actions.length) actions.push({ cat: '成果最大化', text: '現状維持で問題なし。着地候補のクロージングに注力する' })

  return { rating, ratingColor, summary, goods, improves, actions: actions.slice(0, 5), provisional: !externalData }
}
