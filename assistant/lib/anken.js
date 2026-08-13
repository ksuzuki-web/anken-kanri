// 案件管理アプリ（candidatesテーブル）との連携。
// しきい値やステータス定義はアプリ本体の src/constants.js を共有する。
import {
  STATUS_LABEL, STALL_THRESHOLDS, CLOSED_STATUSES, DONE_STATUSES,
  INTERVIEW_STATUSES, KANBAN_STATUSES,
} from '../../src/constants.js'
import { jstYmd } from './cwformat.js'

/** Supabaseから候補者一覧を取得（未設定・失敗時はnull） */
export async function fetchCandidates(env) {
  if (!env.supabaseUrl || !env.supabaseKey) return null
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/candidates?select=*&order=created_at.asc`
    const res = await fetch(url, {
      headers: { apikey: env.supabaseKey, authorization: `Bearer ${env.supabaseKey}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function daysBetweenYmd(fromYmd, toYmd) {
  const toUtc = s => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(toYmd) - toUtc(fromYmd)) / 86400000)
}

/** 候補者一覧から朝ブリーフ用のサマリーを作る（アプリと同じ判定基準） */
export function summarizeAnken(rows, todayYmd = jstYmd()) {
  const active = rows.filter(r => !CLOSED_STATUSES.includes(r.status) && !DONE_STATUSES.includes(r.status))

  const counts = {}
  for (const r of active) counts[r.status] = (counts[r.status] || 0) + 1
  const countsLabel = KANBAN_STATUSES
    .filter(s => counts[s])
    .map(s => `${STATUS_LABEL[s]}${counts[s]}`)
    .join('・')

  const alerts = []
  const issues = []
  const todayInterviews = []
  const upcomingInterviews = []

  for (const r of active) {
    const name = r.candidate_name || '(名前未入力)'
    const label = STATUS_LABEL[r.status] || r.status
    const threshold = STALL_THRESHOLDS[r.status] ?? 5
    const isInterview = INTERVIEW_STATUSES.includes(r.status)

    // 停滞アラート（面接系は面接実施後、それ以外はステータス変更後の経過日数）
    if (isInterview && r.interview_date) {
      const days = daysBetweenYmd(r.interview_date, todayYmd)
      if (days >= threshold) alerts.push(`${name}（${label}・面接から${days}日）`)
      if (days === 0) todayInterviews.push(`${name}（${r.company || '企業未入力'}・${label}）`)
      if (days < 0 && days >= -3) upcomingInterviews.push(`${name}（${r.interview_date.slice(5).replace('-', '/')}・${label}）`)
    } else if (!isInterview && r.status_changed_at) {
      const days = daysBetweenYmd(r.status_changed_at, todayYmd)
      if (days >= threshold) alerts.push(`${name}（${label}・${days}日停滞）`)
    }

    // 入力もれ・矛盾（アプリのgetInconsistenciesと同基準）
    if (isInterview && !r.interview_date) issues.push(`${name}: 面接日が未入力`)
    if (r.status === 'offer' && (r.fee == null || r.fee === '')) issues.push(`${name}: 内定なのに紹介料が未入力`)
    if (r.status !== 'lead' && !(r.company || '').trim()) issues.push(`${name}: 企業名が未入力`)
  }

  return {
    total: rows.length,
    activeCount: active.length,
    countsLabel,
    alerts,
    issues,
    todayInterviews,
    upcomingInterviews,
  }
}

/** ブリーフに載せる行の配列を作る */
export function renderAnkenLines(sum) {
  const lines = []
  lines.push(`・進行中 ${sum.activeCount}件（${sum.countsLabel || 'なし'}）`)
  if (sum.todayInterviews.length) {
    lines.push(`📅 本日の面接 ${sum.todayInterviews.length}件: ${sum.todayInterviews.join('、')}`)
  }
  if (sum.upcomingInterviews.length) {
    lines.push(`📆 近日の面接: ${sum.upcomingInterviews.slice(0, 5).join('、')}`)
  }
  if (sum.alerts.length) {
    lines.push(`🔴 停滞アラート ${sum.alerts.length}件: ${sum.alerts.slice(0, 6).join('、')}${sum.alerts.length > 6 ? ' ほか' : ''}`)
  } else {
    lines.push('🟢 停滞アラートなし')
  }
  if (sum.issues.length) {
    lines.push(`🧹 入力もれ・矛盾 ${sum.issues.length}件: ${sum.issues.slice(0, 3).join('、')}${sum.issues.length > 3 ? ' ほか' : ''}`)
  }
  return lines
}
