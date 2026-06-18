// データの永続化を担うレイヤー（Supabase版）。
// 4人で共有するため、ステップ1のlocalStorage版から切り替えた。
// （ステップ1のコードは storage.localStorage.js に残してある）
//
// 呼び出し側（App.jsx）からは load / create / update / remove の
// 個別関数を呼ぶ形に変更している（全件まとめて保存する方式は
// 同時編集時に他の人の変更を上書きしてしまう危険があるため廃止）。

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '.envファイルにVITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYが設定されていません。README.mdの手順を確認してください。'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// DB（スネークケース）とアプリ内（キャメルケース）の変換
function toAppShape(row) {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    company: row.company,
    assignedCA: row.assigned_ca,
    fee: row.fee,
    status: row.status,
    interviewDate: row.interview_date,
    memo: row.memo,
    nextAction: row.next_action,
    statusChangedAt: row.status_changed_at,
    updatedAt: row.updated_at,
  }
}

function toDbShape(candidate) {
  return {
    id: candidate.id,
    candidate_name: candidate.candidateName,
    company: candidate.company,
    assigned_ca: candidate.assignedCA,
    fee: candidate.fee === '' || candidate.fee === undefined ? null : Number(candidate.fee),
    status: candidate.status,
    interview_date: candidate.interviewDate || null,
    memo: candidate.memo,
    next_action: candidate.nextAction,
    status_changed_at: candidate.statusChangedAt || null,
    updated_at: candidate.updatedAt || null,
  }
}

export async function loadCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('候補者データの読み込みに失敗しました', error)
    return []
  }
  return data.map(toAppShape)
}

export async function createCandidate(candidate) {
  const { data, error } = await supabase
    .from('candidates')
    .insert(toDbShape(candidate))
    .select()
    .single()

  if (error) {
    console.error('候補者の登録に失敗しました', error)
    throw error
  }
  return toAppShape(data)
}

export async function updateCandidate(candidate) {
  const { data, error } = await supabase
    .from('candidates')
    .update(toDbShape(candidate))
    .eq('id', candidate.id)
    .select()
    .single()

  if (error) {
    console.error('候補者の更新に失敗しました', error)
    throw error
  }
  return toAppShape(data)
}

export async function deleteCandidate(id) {
  const { error } = await supabase.from('candidates').delete().eq('id', id)
  if (error) {
    console.error('候補者の削除に失敗しました', error)
    throw error
  }
}

export function generateId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// リアルタイム共有：他の人がデータを変更したら自動で再読み込みするための購読関数。
// App.jsxからuseEffect内で呼び出し、戻り値のunsubscribe()をクリーンアップで呼ぶ。
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('candidates-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
