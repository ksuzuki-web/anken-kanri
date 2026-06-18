import { STALL_THRESHOLDS, CLOSED_STATUSES } from './constants'

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
