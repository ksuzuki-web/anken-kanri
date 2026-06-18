import { STALL_THRESHOLDS, DEFAULT_STALL_THRESHOLD, CLOSED_STATUSES } from './constants'

const ONE_DAY_MS = 1000 * 60 * 60 * 24

export function daysBetween(dateStr, now = new Date()) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return null
  const diff = now.setHours(0, 0, 0, 0) - target.setHours(0, 0, 0, 0)
  return Math.floor(diff / ONE_DAY_MS)
}

// 案件1件分のアラート状態を判定する。
// 戻り値: { isStalled, isOverdueInterview, daysSinceStatusChange, daysOverdueInterview, reasons: string[] }
export function evaluateAlert(candidate, now = new Date()) {
  const reasons = []
  const isClosed = CLOSED_STATUSES.includes(candidate.status)

  const daysSinceStatusChange = daysBetween(candidate.statusChangedAt, new Date(now))
  const threshold = STALL_THRESHOLDS[candidate.status] ?? DEFAULT_STALL_THRESHOLD
  const isStalled = !isClosed && daysSinceStatusChange !== null && daysSinceStatusChange >= threshold

  if (isStalled) {
    reasons.push(`ステータス変更から${daysSinceStatusChange}日経過（基準${threshold}日）`)
  }

  // 面接日が過去で、かつまだ選考中（次のステータスに進んでいない）場合
  let daysOverdueInterview = null
  let isOverdueInterview = false
  if (!isClosed && candidate.interviewDate) {
    const overdue = daysBetween(candidate.interviewDate, new Date(now))
    if (overdue !== null && overdue > 0) {
      daysOverdueInterview = overdue
      isOverdueInterview = true
      reasons.push(`面接予定日を${overdue}日超過`)
    }
  }

  return {
    isStalled,
    isOverdueInterview,
    daysSinceStatusChange,
    daysOverdueInterview,
    isAlert: isStalled || isOverdueInterview,
    reasons,
  }
}
