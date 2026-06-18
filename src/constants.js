// ステータス定義（カンバンの列順）
export const STATUSES = [
  { key: 'lead', label: 'リード', group: 'progress' },
  { key: 'screening', label: '書類選考', group: 'progress' },
  { key: 'interview1', label: '一次選考', group: 'progress' },
  { key: 'interview2', label: '二次選考', group: 'progress' },
  { key: 'interviewFinal', label: '最終選考', group: 'progress' },
  { key: 'offer', label: '内定', group: 'success' },
  { key: 'rejectedDoc', label: '落選（書類）', group: 'closed' },
  { key: 'rejected1', label: '落選（1次）', group: 'closed' },
  { key: 'rejectedFinal', label: '落選（最終）', group: 'closed' },
  { key: 'withdrawn', label: '離脱', group: 'closed' },
]

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]))

// カンバンに表示する列（進行中のみ。内定・落選・離脱はまとめて「完了」列に集約表示する）
export const KANBAN_COLUMNS = [
  'lead',
  'screening',
  'interview1',
  'interview2',
  'interviewFinal',
  'offer',
]

export const CLOSED_STATUSES = ['rejectedDoc', 'rejected1', 'rejectedFinal', 'withdrawn']

// 担当CA（ユニットメンバー）。実運用では設定画面や認証情報から取得する想定の仮データ。
export const CA_MEMBERS = ['鈴木', '高井', '藤島']

// 停滞検知のしきい値（日数）。ステータスごとに「これ以上動きがなければ危険」という基準が違うため個別に設定。
export const STALL_THRESHOLDS = {
  lead: 5,
  screening: 7,
  interview1: 5,
  interview2: 5,
  interviewFinal: 5,
  offer: 14,
}

export const DEFAULT_STALL_THRESHOLD = 7
