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

export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('candidates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
