export const CA_MEMBERS = ['鈴木', '高井', '藤島']

export const STATUSES = [
  { key: 'lead',           label: 'リード' },
  { key: 'screening',      label: '書類選考' },
  { key: 'interview1',     label: '一次選考' },
  { key: 'interview2',     label: '二次選考' },
  { key: 'interviewFinal', label: '最終選考' },
  { key: 'offer',          label: '内定' },
  { key: 'rejectedDoc',    label: '落選（書類）' },
  { key: 'rejected1',      label: '落選（1次）' },
  { key: 'rejectedFinal',  label: '落選（最終）' },
  { key: 'withdrawn',      label: '離脱' },
]

export const KANBAN_STATUSES = ['lead', 'screening', 'interview1', 'interview2', 'interviewFinal', 'offer']
export const CLOSED_STATUSES = ['rejectedDoc', 'rejected1', 'rejectedFinal', 'withdrawn']
export const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]))

export const STALL_THRESHOLDS = {
  lead: 5, screening: 2, interview1: 3, interview2: 3, interviewFinal: 3, offer: 3,
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

// 成約候補の紹介料カウント対象ステータス（1次以降）
export const WIN_COUNT_STATUSES = ['interview1', 'interview2', 'interviewFinal', 'offer']
