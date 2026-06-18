import { CLOSED_STATUSES } from './constants'

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today - d) / 86400000)
}

// 状況からおすすめの次回アクションを1つ返す（ルールベースの提案エンジン）
export function suggestNextAction(c) {
  if (!c || CLOSED_STATUSES.includes(c.status)) return null
  const stalled = daysSince(c.statusChangedAt)
  const interviewIn = c.interviewDate ? -daysSince(c.interviewDate) : null // 正=未来, 0=当日, 負=過去

  switch (c.status) {
    case 'lead':
      if (stalled != null && stalled >= 5) return `リード化から${stalled}日。一度連絡を取り、面談・求人提案のアポを打診しましょう`
      return '求職者の希望条件をヒアリングし、マッチする求人を提案しましょう'

    case 'screening':
      if (stalled != null && stalled >= 3) return `書類提出から${stalled}日。企業へ選考結果を督促しましょう`
      return '企業に書類選考の結果を確認しましょう'

    case 'interview1':
    case 'interview2':
    case 'interviewFinal': {
      const stage = c.status === 'interview1' ? '一次' : c.status === 'interview2' ? '二次' : '最終'
      if (!c.interviewDate) return `${stage}面接の日程を企業・求職者と調整して確定しましょう`
      if (interviewIn > 1) return `${stage}面接（${interviewIn}日後）。想定質問と対策を求職者に共有しましょう`
      if (interviewIn === 1) return `明日が${stage}面接。最終確認の連絡を入れましょう`
      if (interviewIn === 0) return `本日${stage}面接。終了後に手応えをヒアリングしましょう`
      return `${stage}面接の合否を企業に確認し、求職者の意向も回収しましょう`
    }

    case 'offer':
      if (stalled != null && stalled >= 3) return `内定から${stalled}日。承諾の意向を再確認し、返答期限を握りましょう`
      return '内定承諾の意向を確認し、承諾書を回収しましょう'

    default:
      return null
  }
}
