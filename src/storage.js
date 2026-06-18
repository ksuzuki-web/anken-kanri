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

export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel('candidates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
