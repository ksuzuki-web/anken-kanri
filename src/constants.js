export const CA_MEMBERS = ['鈴木', '高井', '藤島']

// 管理者（全権限）と簡易パスコード。※フロント実装のため誤操作防止レベルの簡易ロック
export const ADMIN_CA = '鈴木'
export const ADMIN_PASSCODE = '1839'

export const STATUSES = [
  { key: 'lead',           label: 'リード' },
  { key: 'screening',      label: '書類選考' },
  { key: 'interview1',     label: '一次選考' },
  { key: 'interview2',     label: '二次選考' },
  { key: 'interviewFinal', label: '最終選考' },
  { key: 'offer',          label: '内定' },
  { key: 'won',            label: '成約' },
  { key: 'rejectedDoc',    label: '落選（書類）' },
  { key: 'rejected1',      label: '落選（1次）' },
  { key: 'rejectedFinal',  label: '落選（最終）' },
  { key: 'withdrawn',      label: '離脱' },
]

export const KANBAN_STATUSES = ['lead', 'screening', 'interview1', 'interview2', 'interviewFinal', 'offer', 'won']
export const CLOSED_STATUSES = ['rejectedDoc', 'rejected1', 'rejectedFinal', 'withdrawn']
// 成約＝着地済みの成功終端。アラート対象外
export const DONE_STATUSES = ['won']
export const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]))

// 停滞アラートのしきい値（日数）。面接系は「面接実施後」、それ以外は「ステータス変更後」で判定
export const STALL_THRESHOLDS = {
  lead: 5, screening: 3, interview1: 3, interview2: 3, interviewFinal: 3, offer: 5,
}

// ステータスごとの自動TODOテンプレート
export const STATUS_TODOS = {
  screening:      ['書類選考の結果を回収する'],
  interview1:     ['一次面接の合否を回収する', '求職者の意向を確認する'],
  interview2:     ['二次面接の合否を回収する', '求職者の意向を確認する'],
  interviewFinal: ['最終面接の合否を回収する', '求職者の意向を確認する'],
  offer:          ['内定の意向を確認する', '承諾書を回収する'],
}

// 面接系ステータス（面接日前はTODO非表示）
export const INTERVIEW_STATUSES = ['interview1', 'interview2', 'interviewFinal']

// 着地候補の紹介料カウント対象ステータス（1次以降）
export const WIN_COUNT_STATUSES = ['interview1', 'interview2', 'interviewFinal', 'offer', 'won']

// ファネル：失注ポイントの短縮ラベル
export const LOSS_POINT_LABEL = {
  rejectedDoc:   '書類落ち',
  rejected1:     '1次落ち',
  rejectedFinal: '最終落ち',
  withdrawn:     '離脱',
}
