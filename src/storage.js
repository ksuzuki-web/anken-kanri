import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export function generateId() {
  return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function toDb(c) {
  return {
    id:               c.id,
    candidate_name:   c.candidateName   ?? '',
    company:          c.company         ?? '',
    assigned_ca:      c.assignedCA      ?? '',
    fee:              c.fee !== '' && c.fee != null ? Number(c.fee) : null,
    status:           c.status          ?? 'lead',
    interview_date:   c.interviewDate   || null,
    memo:             c.memo            ?? '',
    next_action:      c.nextAction      ?? '',
    status_changed_at: c.statusChangedAt || null,
    updated_at:       c.updatedAt       || null,
    priority:         c.priority        ?? 0,
    win_candidate:    c.winCandidate    ?? false,
  }
}

function toApp(row) {
  return {
    id:              row.id,
    candidateName:   row.candidate_name,
    company:         row.company,
    assignedCA:      row.assigned_ca,
    fee:             row.fee,
    status:          row.status,
    interviewDate:   row.interview_date,
    memo:            row.memo,
    nextAction:      row.next_action,
    statusChangedAt: row.status_changed_at,
    updatedAt:       row.updated_at,
    priority:        row.priority ?? 0,
    winCandidate:    row.win_candidate ?? false,
    createdAt:       row.created_at,
  }
}

export async function loadAll() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toApp)
}

export async function insertCandidate(candidate) {
  const row = toDb({ ...candidate, id: candidate.id || generateId() })
  const { data, error } = await supabase
    .from('candidates')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return toApp(data)
}

export async function saveCandidate(candidate) {
  const row = toDb(candidate)
  const { data, error } = await supabase
    .from('candidates')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return toApp(data)
}

export async function removeCandidate(id) {
  const { error } = await supabase.from('candidates').delete().eq('id', id)
  if (error) throw error
}

export async function loadLogs(candidateId, type) {
  let q = supabase
    .from('action_logs')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data.map(r => ({ id: r.id, type: r.type, content: r.content, createdAt: r.created_at }))
}

export async function loadTodos(candidateIds) {
  if (!candidateIds.length) return []
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .in('candidate_id', candidateIds)
  if (error) throw error
  return data
}

export async function upsertTodo(candidateId, statusKey, taskLabel, isDone) {
  const { error } = await supabase
    .from('todos')
    .upsert({ candidate_id: candidateId, status_key: statusKey, task_label: taskLabel, is_done: isDone, done_at: isDone ? new Date().toISOString() : null },
             { onConflict: 'candidate_id,status_key,task_label' })
  if (error) throw error
}

export async function addLog(candidateId, type, content) {
  const { data, error } = await supabase
    .from('action_logs')
    .insert({ id: generateId(), candidate_id: candidateId, type, content })
    .select().single()
  if (error) throw error
  return { id: data.id, type: data.type, content: data.content, createdAt: data.created_at }
}

// ===== 変更履歴（誰がいつ何を変えたか）=====
// change_logs テーブルが未作成でもアプリが壊れないよう、失敗は握りつぶす設計
export async function addChangeLog({ candidateId, candidateName, field, oldValue, newValue, changedBy }) {
  try {
    await supabase.from('change_logs').insert({
      id: generateId(),
      candidate_id: candidateId,
      candidate_name: candidateName ?? '',
      field,
      old_value: oldValue == null ? '' : String(oldValue),
      new_value: newValue == null ? '' : String(newValue),
      changed_by: changedBy || '不明',
    })
  } catch (_) { /* テーブル未作成時などは無視 */ }
}

export async function loadRecentChanges(limit = 120) {
  try {
    const { data, error } = await supabase
      .from('change_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data.map(r => ({
      id: r.id, candidateId: r.candidate_id, candidateName: r.candidate_name,
      field: r.field, oldValue: r.old_value, newValue: r.new_value,
      changedBy: r.changed_by, createdAt: r.created_at,
    }))
  } catch (_) { return [] }
}

// ===== ステータス推移の履歴（ヨミ管理・週次レポート用）=====
// change_logs の status / create だけを古い順に取得。テーブル未作成なら空配列。
export async function loadStatusHistory(maxRows = 10000) {
  // Supabase は1リクエスト最大1000行なので、ページングして全件取る
  const PAGE = 1000
  const rows = []
  try {
    for (let from = 0; from < maxRows; from += PAGE) {
      const { data, error } = await supabase
        .from('change_logs')
        .select('candidate_id, candidate_name, field, old_value, new_value, changed_by, created_at')
        .in('field', ['status', 'create'])
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...data)
      if (data.length < PAGE) break
    }
  } catch (_) { if (!rows.length) return [] }
  return rows.map(r => ({
    candidateId: r.candidate_id, candidateName: r.candidate_name,
    field: r.field, oldValue: r.old_value, newValue: r.new_value,
    changedBy: r.changed_by, createdAt: r.created_at,
  }))
}

// ===== 共有設定（目標など）=====
// app_settings テーブルに保存してユニット全員で共有。テーブル未作成時はこの端末だけに保存（shared: false）。
const LOCAL_PREFIX = 'setting:'
function readLocal(key) {
  try { const v = localStorage.getItem(LOCAL_PREFIX + key); return v ? JSON.parse(v) : null } catch (_) { return null }
}
function writeLocal(key, value) {
  try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value)) } catch (_) { /* 容量超過など */ }
}

export async function loadSetting(key) {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
    if (error) throw error
    if (data) { writeLocal(key, data.value); return { value: data.value, shared: true } }
    return { value: readLocal(key), shared: true }
  } catch (_) {
    return { value: readLocal(key), shared: false }
  }
}

export async function saveSetting(key, value, updatedBy) {
  writeLocal(key, value)
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_by: updatedBy || '', updated_at: new Date().toISOString() })
    if (error) throw error
    return { shared: true }
  } catch (_) { return { shared: false } }
}

export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('candidates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
