import { STALL_THRESHOLDS, CLOSED_STATUSES, INTERVIEW_STATUSES } from './constants'

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today - d) / 86400000)
}

export function getAlert(candidate) {
  if (CLOSED_STATUSES.includes(candidate.status)) return { isAlert: false, reasons: [] }

  const reasons = []
  const stalled = daysSince(candidate.statusChangedAt)
  const threshold = STALL_THRESHOLDS[candidate.status] ?? 7
  if (stalled !== null && stalled >= threshold) {
    reasons.push(`ステータス変更から${stalled}日経過（基準${threshold}日）`)
  }

  const overdue = daysSince(candidate.interviewDate)
  if (overdue !== null && overdue > 0) {
    reasons.push(`面接予定日を${overdue}日超過`)
  }

  return { isAlert: reasons.length > 0, reasons }
}

// データの矛盾・入力漏れを検知（停滞アラートとは別軸）
export function getInconsistencies(candidate) {
  if (CLOSED_STATUSES.includes(candidate.status)) {
    // 落選・離脱なのに成約候補ONは矛盾
    if (candidate.winCandidate) return ['落選・離脱なのに成約候補がONです']
    return []
  }

  const issues = []
  const isInterview = INTERVIEW_STATUSES.includes(candidate.status)

  if (isInterview && !candidate.interviewDate) {
    issues.push('面接ステータスですが面接日が未入力です')
  }

  if (isInterview && candidate.interviewDate) {
    const passed = daysSince(candidate.interviewDate)
    if (passed !== null && passed > 0) {
      issues.push(`面接日を${passed}日過ぎていますが選考が進んでいません（合否回収漏れ?）`)
    }
  }

  if (candidate.status === 'offer' && (candidate.fee == null || candidate.fee === '')) {
    issues.push('内定ですが紹介料が未入力です')
  }

  if (candidate.status !== 'lead' && !(candidate.company || '').trim()) {
    issues.push('選考が進んでいますが企業名が未入力です')
  }

  return issues
}
