import React, { useState, useEffect, useCallback } from 'react'
import { KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL, CA_MEMBERS, STATUSES, STATUS_TODOS, INTERVIEW_STATUSES, WIN_COUNT_STATUSES, ADMIN_CA } from './constants'
import { loadAll, insertCandidate, saveCandidate, removeCandidate, subscribeToChanges, generateId, loadTodos, upsertTodo, addChangeLog } from './storage'
import { getAlert, getInconsistencies } from './alerts'
import { suggestNextAction } from './suggestions'
import Modal from './components/Modal'
import LogModal from './components/LogModal'
import FunnelChart from './components/FunnelChart'
import BoardView from './components/BoardView'
import HistoryModal from './components/HistoryModal'
import DigestModal from './components/DigestModal'
import Confetti from './components/Confetti'
import LoginGate from './components/LoginGate'
import CaFeedback from './components/CaFeedback'

const UNIQUE_STATUSES = ['screening', 'interview1', 'interview2', 'interviewFinal', 'offer', 'won']

const STATUS_STYLE = {
  lead:           { bg: '#f1f5f9', color: '#64748b' },
  screening:      { bg: '#dbeafe', color: '#1d4ed8' },
  interview1:     { bg: '#e0f2fe', color: '#0369a1' },
  interview2:     { bg: '#ede9fe', color: '#6d28d9' },
  interviewFinal: { bg: '#fae8ff', color: '#a21caf' },
  offer:          { bg: '#dcfce7', color: '#15803d' },
  won:            { bg: '#bbf7d0', color: '#047857' },
  rejectedDoc:    { bg: '#fee2e2', color: '#b91c1c' },
  rejected1:      { bg: '#fee2e2', color: '#b91c1c' },
  rejectedFinal:  { bg: '#fee2e2', color: '#b91c1c' },
  withdrawn:      { bg: '#f1f5f9', color: '#94a3b8' },
}

const CA_THEME = {
  [CA_MEMBERS[0]]: { accent: '#3b82f6' },
  [CA_MEMBERS[1]]: { accent: '#10b981' },
  [CA_MEMBERS[2]]: { accent: '#8b5cf6' },
}
const caColorOf = ca => CA_THEME[ca]?.accent || '#64748b'

const PRI_COLOR = { 5: '#ef4444', 4: '#f97316', 3: '#f59e0b', 2: '#84cc16', 1: '#94a3b8' }
const PRI_LABEL = { 0: '未設定', 1: '通常', 2: '注力低', 3: '注力中', 4: '注力高', 5: '最優先' }

function fmtDt(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

function computeTodos(candidates, todosData) {
  const todosMap = {}
  for (const t of todosData) todosMap[`${t.candidate_id}|${t.status_key}|${t.task_label}`] = t
  const today = new Date()
  const items = []
  for (const c of candidates) {
    if (CLOSED_STATUSES.includes(c.status)) continue
    const tasks = STATUS_TODOS[c.status] || []
    if (!tasks.length) continue
    if (INTERVIEW_STATUSES.includes(c.status)) {
      if (!c.interviewDate) continue
      const iDate = new Date(c.interviewDate)
      iDate.setHours(23, 59, 59)
      if (today < iDate) continue
    }
    for (const task of tasks) {
      const rec = todosMap[`${c.id}|${c.status}|${task}`]
      items.push({ candidateId: c.id, candidateName: c.candidateName, company: c.company, assignedCA: c.assignedCA, statusKey: c.status, taskLabel: task, isDone: rec?.is_done || false, doneAt: rec?.done_at || null })
    }
  }
  return items
}

// 注力度：横幅を取らないよう「★N」のコンパクト表示。クリックでポップオーバーから選択
function PriorityStars({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const color = PRI_COLOR[value] || 'var(--faint)'
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => !disabled && setOpen(o => !o)} title={disabled ? '閲覧のみ' : (PRI_LABEL[value] || '未設定')}
        style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, padding: '3px 9px', cursor: disabled ? 'default' : 'pointer', lineHeight: 1, opacity: disabled ? 0.65 : 1 }}>
        <span style={{ fontSize: 12, color: value ? color : 'var(--faint)' }}>★</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: value ? 'var(--text-2)' : 'var(--faint)' }}>{value || '－'}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 61, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--card-shadow)', padding: '6px 8px', display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} onClick={() => { onChange(value === i ? 0 : i); setOpen(false) }}
                title={PRI_LABEL[i]}
                style={{ fontSize: 18, color: i <= value ? (PRI_COLOR[value] || '#f59e0b') : 'var(--faint)', cursor: 'pointer', lineHeight: 1 }}>★</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 面接日：年を省き月/日のみ表示。クリックで日付ピッカー編集
function DateCell({ value, onChange, variant, disabled }) {
  const [edit, setEdit] = useState(false)
  const isM = variant === 'mobile'
  let label = isM ? '日付を選択' : '—'
  if (value) { const p = value.split('-'); if (p.length === 3) label = `${+p[1]}/${+p[2]}` }

  // モバイルは横幅に余裕があるのでその場で入力欄に切替
  if (isM) {
    if (edit && !disabled) {
      return <input type="date" autoFocus value={value || ''} onChange={e => onChange(e.target.value)} onBlur={() => setEdit(false)} style={mInput} />
    }
    return (
      <button onClick={() => !disabled && setEdit(true)} style={{ ...mInput, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', color: value ? 'var(--text)' : 'var(--muted-2)' }}>{label}</button>
    )
  }

  // 一覧（グリッド）は列が狭いので、編集時は前面にポップオーバー表示して隣の列と被らないようにする
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => !disabled && setEdit(true)} style={{ background: 'none', border: 'none', padding: '2px 4px', fontSize: 13, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', color: value ? 'var(--text-2)' : 'var(--faint)' }}>{label}</button>
      {edit && (
        <input
          type="date" autoFocus value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEdit(false)}
          style={{ position: 'absolute', top: -6, left: -6, width: 156, zIndex: 30, padding: '8px 10px', border: '1.5px solid var(--accent)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--card-shadow-hover)', outline: 'none', fontSize: 13 }}
        />
      )}
    </div>
  )
}

function PriorityChart({ candidates }) {
  const priMap = {}
  for (const c of candidates) {
    const p = c.priority ?? 0
    if (priMap[c.candidateName] === undefined || p > priMap[c.candidateName]) priMap[c.candidateName] = p
  }
  const vals = Object.values(priMap)
  const data = [5,4,3,2,1].map(l => ({ level: l, count: vals.filter(p => p === l).length }))
  const none = vals.filter(p => !p).length
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={card}>
      <div style={cardTitle}>注力度分布</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
        {data.map(({ level, count }) => (
          <div key={level}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: PRI_COLOR[level], fontWeight: 700 }}>{'★'.repeat(level)}</span>
              <span style={{ fontSize: 10, color: 'var(--muted-2)', marginLeft: 4 }}>{PRI_LABEL[level]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: count > 0 ? 600 : 400, color: count > 0 ? 'var(--text-3)' : 'var(--faint)' }}>{count}名</span>
            </div>
            <div style={{ height: 5, background: 'var(--surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
              {count > 0 && <div style={{ width: `${(count/max)*100}%`, height: '100%', background: PRI_COLOR[level], borderRadius: 3 }} />}
            </div>
          </div>
        ))}
      </div>
      {none > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>未設定</span>
          <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{none}名</span>
        </div>
      )}
    </div>
  )
}

function TodoPanel({ items, onToggle }) {
  const [showDone, setShowDone] = useState(false)
  const pending = items.filter(t => !t.isDone)
  const done = items.filter(t => t.isDone)
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={cardTitle}>TODOリスト</span>
        {pending.length > 0 && (
          <span style={{ marginLeft: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{pending.length}</span>
        )}
      </div>
      {pending.length === 0 && done.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '8px 0' }}>TODOなし</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pending.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <button onClick={() => onToggle(t, true)} style={{ width: 16, height: 16, border: '1.5px solid var(--faint)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text-2)', fontWeight: 500, lineHeight: 1.4 }}>{t.taskLabel}</div>
              <div style={{ color: 'var(--muted-2)', fontSize: 10, marginTop: 2 }}>{t.candidateName} · {STATUS_LABEL[t.statusKey]}</div>
            </div>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowDone(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--muted-2)', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{showDone ? '▾' : '▸'}</span> 完了済み ({done.length})
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {done.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: 0.6 }}>
                  <button onClick={() => onToggle(t, false)} style={{ width: 16, height: 16, border: '1.5px solid #10b981', borderRadius: 4, background: 'rgba(16,185,129,0.16)', cursor: 'pointer', flexShrink: 0, marginTop: 1, fontSize: 9, color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                  <div style={{ fontSize: 11, flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-3)', textDecoration: 'line-through' }}>{t.taskLabel}</div>
                    <div style={{ color: 'var(--muted-2)', fontSize: 10, marginTop: 1 }}>{t.candidateName} · {t.doneAt ? fmtDt(t.doneAt) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MobileCard({ c, isFirst, name, ca, alert, issues, suggestion, editable, onPriority, onInline, onLog, onDelete, onAddCompany }) {
  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.lead
  const accent = caColorOf(ca)
  return (
    <div style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-soft)', background: alert.isAlert ? 'var(--alert-row)' : 'var(--surface)', borderLeft: `3px solid ${isFirst ? accent : 'var(--border-soft)'}` }}>
      {isFirst ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 9 }}>●</span>}
          {issues.length > 0 && <span title={issues.join('\n')} style={{ color: '#f59e0b', fontSize: 12, cursor: 'help' }}>⚠</span>}
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{name}</span>
          <PriorityStars value={c.priority ?? 0} onChange={v => onPriority(name, v)} disabled={!editable} />
          {editable && <button onClick={onAddCompany} style={{ fontSize: 11, padding: '2px 9px', background: `${accent}22`, border: 'none', borderRadius: 20, cursor: 'pointer', color: accent, fontWeight: 700 }}>+企業</button>}
          {editable && <button onClick={() => onDelete(c)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18 }}>×</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>└ 同じ候補者の別企業</span>
          {editable && <button onClick={() => onDelete(c)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18 }}>×</button>}
        </div>
      )}

      <input value={c.company || ''} readOnly={!editable} onChange={e => onInline(c, 'company', e.target.value)} placeholder="企業名" style={{ ...mInput, fontWeight: 600, fontSize: 15, opacity: editable ? 1 : 0.7 }} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <select value={c.status} disabled={!editable} onChange={e => onInline(c, 'status', e.target.value)} style={{ ...mInput, flex: 1, background: ss.bg, color: ss.color, fontWeight: 700, appearance: 'none', WebkitAppearance: 'none', border: 'none', opacity: editable ? 1 : 0.8 }}>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button disabled={!editable} onClick={() => onInline(c, 'winCandidate', !c.winCandidate)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', border: `1.5px solid ${c.winCandidate ? '#16a34a' : 'var(--border)'}`, borderRadius: 8, background: c.winCandidate ? 'rgba(34,197,94,0.16)' : 'var(--surface)', color: c.winCandidate ? '#16a34a' : 'var(--muted-2)', fontSize: 13, fontWeight: 600, cursor: editable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
          {c.winCandidate ? '✓' : '○'} 着地
        </button>
      </div>
      {c.statusChangedAt && <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 4 }}>変更: {fmtDt(c.statusChangedAt)}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={mLabel}>紹介料（万円）</div>
          <input type="number" value={c.fee ?? ''} readOnly={!editable} onChange={e => onInline(c, 'fee', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" style={{ ...mInput, opacity: editable ? 1 : 0.7 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={mLabel}>面接日</div>
          <DateCell value={c.interviewDate} onChange={v => onInline(c, 'interviewDate', v)} variant="mobile" disabled={!editable} />
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => onLog(c, 'action', suggestion)} style={mLogBtn}>
          <span style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 600, flexShrink: 0 }}>📋 次回</span>
          <span style={{ fontSize: 13, color: c.nextAction ? 'var(--text-3)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nextAction || '—'}</span>
        </button>
        <button onClick={() => onLog(c, 'memo', null)} style={mLogBtn}>
          <span style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 600, flexShrink: 0 }}>📋 メモ</span>
          <span style={{ fontSize: 13, color: c.memo ? 'var(--text-3)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo || '—'}</span>
        </button>
      </div>
    </div>
  )
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const [candidates, setCandidates] = useState([])
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [logModal, setLogModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [closedOpen, setClosedOpen] = useState(false)
  const [caFilter, setCaFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState(null)
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [currentUser, setCurrentUser] = useState(null) // ログイン時に必ず選択（ログ精度のため永続化しない）
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [digestOpen, setDigestOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const isMobile = useIsMobile()
  const px = isMobile ? 12 : 24

  // テーマ適用
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const isAdmin = currentUser === ADMIN_CA
  const canEdit = c => isAdmin || (c && c.assignedCA === currentUser)

  const load = useCallback(async () => {
    try {
      const data = await loadAll()
      setCandidates(data)
      setError(null)
    } catch (e) { setError('読み込み失敗: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => subscribeToChanges(load), [load])

  const active = candidates.filter(c => !CLOSED_STATUSES.includes(c.status))
  const closed = candidates.filter(c => CLOSED_STATUSES.includes(c.status))

  useEffect(() => {
    const ids = active.map(c => c.id)
    if (!ids.length) { setTodos([]); return }
    loadTodos(ids).then(setTodos).catch(() => {})
  }, [candidates])

  // 朝のダイジェストを1日1回自動表示（ログイン後）
  useEffect(() => {
    if (loading || error || !currentUser) return
    if (localStorage.getItem('digestDate') !== localToday()) {
      setDigestOpen(true)
      localStorage.setItem('digestDate', localToday())
    }
  }, [loading, error, currentUser])

  // URLを開いた時点で「誰が操作するか」を必ず選択させる（ログ精度のため）
  if (!currentUser) return <LoginGate onSelect={setCurrentUser} />

  const matchesSearch = c => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (c.candidateName || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
  }

  const caActive = caFilter === 'all' ? active : active.filter(c => c.assignedCA === caFilter)
  const caClosed = caFilter === 'all' ? closed : closed.filter(c => c.assignedCA === caFilter)
  const displayActive = caActive.filter(matchesSearch)
  const filteredForTable = statusFilter ? displayActive.filter(c => c.status === statusFilter) : displayActive
  const closedShown = caClosed.filter(matchesSearch)
  const alertCount = caActive.filter(c => getAlert(c).isAlert).length
  const todoItems = computeTodos(caActive, todos)

  // 変更履歴ログ用：値を読みやすく整形
  function logChange(cand, field, oldRaw, newRaw) {
    const f = (k, v) => {
      if (v == null || v === '') return ''
      if (k === 'status') return STATUS_LABEL[v] || v
      if (k === 'winCandidate') return v ? 'ON' : 'OFF'
      if (k === 'priority') return v === 0 ? 'なし' : `★${v}`
      if (k === 'fee') return `${v}万`
      return String(v)
    }
    addChangeLog({ candidateId: cand.id, candidateName: cand.candidateName, field, oldValue: f(field, oldRaw), newValue: f(field, newRaw), changedBy: currentUser || '不明' })
  }

  async function handleSave(form) {
    setSaving(true)
    try {
      const isNew = !form.id
      const prev = isNew ? null : candidates.find(c => c.id === form.id)
      if (!isAdmin) {
        if (!isNew && prev && prev.assignedCA !== currentUser) { alert('自分の担当案件のみ編集できます'); setSaving(false); return }
        form = { ...form, assignedCA: currentUser } // 担当は自分に固定
      }
      const record = isNew ? { ...form, id: generateId() } : form
      const saved = isNew ? await insertCandidate(record) : await saveCandidate(record)
      setCandidates(p => isNew ? [...p, saved] : p.map(c => c.id === saved.id ? saved : c))
      setModal(null)
      if (isNew) {
        logChange(saved, 'create', '', '')
      } else if (prev) {
        for (const k of ['status', 'company', 'fee', 'assignedCA', 'interviewDate']) {
          if (prev[k] !== saved[k]) logChange(saved, k, prev[k], saved[k])
        }
      }
      if (saved.status === 'won' && (!prev || prev.status !== 'won')) setConfetti(true)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleInlineChange(candidate, field, value) {
    if (!canEdit(candidate)) { alert('自分の担当案件のみ編集できます'); return }
    if (candidate[field] === value) return
    const statusChanged = field === 'status' && candidate.status !== value
    const updated = {
      ...candidate, [field]: value,
      statusChangedAt: statusChanged ? new Date().toISOString() : candidate.statusChangedAt,
      updatedAt: new Date().toISOString(),
    }
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
    logChange(candidate, field, candidate[field], value)
    if (statusChanged && value === 'won') setConfetti(true)
    try { await saveCandidate(updated) }
    catch (e) { alert('保存失敗: ' + e.message); load() }
  }

  async function handlePriorityChange(candidateName, value) {
    const toUpdate = candidates.filter(c => c.candidateName === candidateName)
    if (toUpdate[0] && !canEdit(toUpdate[0])) { alert('自分の担当案件のみ編集できます'); return }
    const before = toUpdate[0]?.priority ?? 0
    setCandidates(prev => prev.map(c => c.candidateName === candidateName ? { ...c, priority: value } : c))
    if (toUpdate[0]) logChange(toUpdate[0], 'priority', before, value)
    try { await Promise.all(toUpdate.map(c => saveCandidate({ ...c, priority: value }))) }
    catch (e) { alert('保存失敗: ' + e.message); load() }
  }

  function handleLogUpdate(updatedCandidate) {
    setCandidates(prev => prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c))
    setLogModal(prev => prev ? { ...prev, candidate: updatedCandidate } : null)
  }

  async function handleDelete(candidate) {
    const id = typeof candidate === 'string' ? candidate : candidate.id
    const target = candidates.find(c => c.id === id)
    if (target && !canEdit(target)) { alert('自分の担当案件のみ削除できます'); return }
    if (!confirm('削除しますか？')) return
    try {
      await removeCandidate(id)
      setCandidates(prev => prev.filter(c => c.id !== id))
      setModal(null)
      if (target) logChange(target, 'delete', '', '')
    } catch (e) { alert('削除失敗: ' + e.message) }
  }

  async function handleToggleTodo(todo, isDone) {
    setTodos(prev => {
      const idx = prev.findIndex(t => t.candidate_id === todo.candidateId && t.status_key === todo.statusKey && t.task_label === todo.taskLabel)
      const newRec = { candidate_id: todo.candidateId, status_key: todo.statusKey, task_label: todo.taskLabel, is_done: isDone, done_at: isDone ? new Date().toISOString() : null }
      return idx >= 0 ? prev.map((t, i) => i === idx ? newRec : t) : [...prev, newRec]
    })
    try { await upsertTodo(todo.candidateId, todo.statusKey, todo.taskLabel, isDone) }
    catch (e) { alert('TODO更新失敗: ' + e.message) }
  }

  function openCandidate(c) { setModal(c) }

  if (loading) return <div style={center}>読み込み中...</div>
  if (error) return <div style={{ ...center, color: '#ef4444' }}>{error}</div>

  // CAグループ計算（リスト表示用）
  const caGroups = CA_MEMBERS.map(ca => {
    const allCaRows = active.filter(c => c.assignedCA === ca)
    const displayRows = filteredForTable.filter(c => c.assignedCA === ca)
    const candidateMap = new Map()
    for (const c of displayRows) {
      const key = c.candidateName || '（名前未設定）'
      if (!candidateMap.has(key)) candidateMap.set(key, [])
      candidateMap.get(key).push(c)
    }
    const allCaNames = new Map()
    for (const c of allCaRows) {
      if (!allCaNames.has(c.candidateName)) allCaNames.set(c.candidateName, [])
      allCaNames.get(c.candidateName).push(c)
    }
    const uniqueCount = [...allCaNames.values()].filter(rows => rows.some(r => UNIQUE_STATUSES.includes(r.status))).length
    const winApps = allCaRows.filter(c => c.winCandidate && WIN_COUNT_STATUSES.includes(c.status))
    const winFee = winApps.reduce((s, c) => s + (Number(c.fee) || 0), 0)
    return { ca, candidateMap, uniqueCount, winCount: winApps.length, winFee, totalCandidates: allCaNames.size }
  })
  const visibleGroups = caFilter === 'all' ? caGroups : caGroups.filter(g => g.ca === caFilter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {confetti && <Confetti onDone={() => setConfetti(false)} />}

      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 12px rgba(15,23,42,0.04)', padding: `0 ${px}px`, height: 58, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent), var(--primary))', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(79,70,229,0.28)' }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>宅</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15.5, color: 'var(--text)', letterSpacing: '-0.01em' }}>宅建Jobエージェント</span>
        {!isMobile && <span style={{ color: 'var(--border)' }}>|</span>}
        {!isMobile && <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>案件管理</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {alertCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: isMobile ? '4px 9px' : '4px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{isMobile ? alertCount : `要注意 ${alertCount}件`}</span>
            </div>
          )}
          <button className="btn-primary" onClick={() => setModal(isAdmin ? 'new' : { _prefill: { assignedCA: currentUser } })} style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', border: 'none', borderRadius: 9, padding: isMobile ? '8px 14px' : '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(79,70,229,0.25)' }}>
            {isMobile ? '+ 追加' : '+ 候補者を追加'}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: `9px ${px}px`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', top: 56, zIndex: 40 }}>
        {/* 検索 */}
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 300px' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted-2)', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="求職者名・企業名で検索..."
            style={{ width: '100%', padding: '8px 30px 8px 32px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-2)', fontSize: 14 }}>×</button>}
        </div>

        {/* リスト / ボード切替 */}
        <div style={{ display: 'flex', background: 'var(--surface-hover)', borderRadius: 8, padding: 3 }}>
          {[['list', '☰ リスト'], ['board', '▦ ボード']].map(([v, lbl]) => (
            <button key={v} onClick={() => setView(v)} style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--text)' : 'var(--muted)', boxShadow: view === v ? 'var(--card-shadow)' : 'none' }}>{lbl}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 現在の担当者（クリックで切替＝再ログイン） */}
          <button onClick={() => setCurrentUser(null)} title="担当者を切り替える"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 6px', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', cursor: 'pointer' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${caColorOf(currentUser)}22`, color: caColorOf(currentUser), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>{currentUser[0]}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{currentUser}{isAdmin ? ' 🔑' : ''}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>切替</span>
          </button>
          <button onClick={() => setDigestOpen(true)} title="今日やること" className="icon-btn" style={iconBtn}>☀️</button>
          <button onClick={() => setHistoryOpen(true)} title="変更履歴" className="icon-btn" style={iconBtn}>🕐</button>
          <button onClick={() => setDark(d => !d)} title="ダークモード切替" className="icon-btn" style={iconBtn}>{dark ? '🌙' : '☀'}</button>
        </div>
      </div>

      {/* Kanban strip（リスト表示時のみ・クリックで絞り込み） */}
      {view === 'list' && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: `10px ${px}px` }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }}>
            {KANBAN_STATUSES.map(status => {
              const items = caActive.filter(c => c.status === status)
              const hasAlert = items.some(c => getAlert(c).isAlert)
              const ss = STATUS_STYLE[status]
              const isSelected = statusFilter === status
              return (
                <button key={status} onClick={() => setStatusFilter(isSelected ? null : status)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, border: `${isSelected ? 2 : 1}px solid`, borderColor: isSelected ? ss.color : 'var(--border)', background: isSelected ? ss.bg : 'var(--surface)', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, color: items.length > 0 ? ss.color : 'var(--faint)', fontWeight: 500 }}>{STATUS_LABEL[status]}</span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: items.length > 0 ? ss.color : 'var(--faint)' }}>{items.length}</span>
                  {hasAlert && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠</span>}
                </button>
              )
            })}
            {statusFilter && (
              <button onClick={() => setStatusFilter(null)} style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)', background: 'var(--surface-hover)', border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', flexShrink: 0 }}>× 絞り込み解除</button>
            )}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ padding: isMobile ? '14px 12px' : '20px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 20, alignItems: 'flex-start' }}>

        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* CA filter tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...CA_MEMBERS].map(f => {
              const group = caGroups.find(g => g.ca === f)
              const isActive = caFilter === f
              const accent = caColorOf(f)
              return (
                <button key={f} onClick={() => setCaFilter(f)} style={{ padding: '7px 18px', borderRadius: 20, border: '1.5px solid', borderColor: isActive ? (f === 'all' ? 'var(--primary)' : accent) : 'var(--border)', background: isActive ? (f === 'all' ? 'var(--primary)' : accent) : 'var(--surface)', color: isActive ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  {f === 'all' ? '全体' : f}
                  {f !== 'all' && group && (
                    <span style={{ fontSize: 11, background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-hover)', borderRadius: 20, padding: '1px 7px', color: isActive ? '#fff' : 'var(--muted)' }}>{group.totalCandidates}名</span>
                  )}
                </button>
              )
            })}
            {search && (
              <span style={{ marginLeft: 4, alignSelf: 'center', fontSize: 12, color: 'var(--muted-2)' }}>「{search}」の検索結果</span>
            )}
          </div>

          {/* 担当CD分析（特定CAを選択中のみ） */}
          {caFilter !== 'all' && <CaFeedback ca={caFilter} candidates={candidates} />}

          {/* ボード表示 */}
          {view === 'board' ? (
            <BoardView
              candidates={displayActive}
              onStatusChange={(c, s) => handleInlineChange(c, 'status', s)}
              onOpenCandidate={openCandidate}
              caColorOf={caColorOf}
              getAlert={getAlert}
            />
          ) : (
          <>
          {/* ステータス絞り込み中のバナー */}
          {statusFilter && (
            <div style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#0ea5e9', fontWeight: 600 }}>「{STATUS_LABEL[statusFilter]}」で絞り込み中</span>
              <button onClick={() => setStatusFilter(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>× 解除</button>
            </div>
          )}

          {/* CA sections */}
          {visibleGroups.map(({ ca, candidateMap, uniqueCount, winCount, winFee }) => {
            const accent = caColorOf(ca)
            const totalApps = [...candidateMap.values()].reduce((s, r) => s + r.length, 0)
            const canAddHere = isAdmin || ca === currentUser
            return (
              <div key={ca} className="card-hover" style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ background: `linear-gradient(180deg, ${accent}1f, ${accent}0a)`, padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-card)', flexWrap: 'wrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{ca}</span>
                  <div style={{ background: `${accent}22`, color: accent, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>ユニーク {uniqueCount}件</div>
                  {winCount > 0 && (
                    <div style={{ background: 'rgba(34,197,94,0.16)', color: '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓ 着地候補 {winCount}件</span>
                      {winFee > 0 && <span style={{ opacity: 0.8 }}>/ {winFee}万円</span>}
                    </div>
                  )}
                  {candidateMap.size > 0 && <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{candidateMap.size}名 · {totalApps}社</span>}
                  {canAddHere && <button className="pill-btn" onClick={() => setModal({ _prefill: { assignedCA: ca } })} style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px', background: 'var(--surface)', border: `1.5px solid ${accent}`, borderRadius: 7, cursor: 'pointer', color: accent, fontWeight: 700 }}>+ 追加</button>}
                </div>

                {candidateMap.size === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--faint)', fontSize: 13, marginBottom: 10 }}>{search ? '検索に一致する候補者なし' : statusFilter ? `「${STATUS_LABEL[statusFilter]}」の候補者なし` : '候補者なし'}</div>
                    {!statusFilter && !search && canAddHere && <button onClick={() => setModal({ _prefill: { assignedCA: ca } })} style={{ fontSize: 12, padding: '6px 18px', background: 'transparent', border: '1.5px dashed var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--muted-2)' }}>+ 候補者を追加</button>}
                  </div>
                ) : isMobile ? (
                  <div>
                    {[...candidateMap.entries()].map(([name, rows]) =>
                      rows.map((c, idx) => (
                        <MobileCard key={c.id} c={c} isFirst={idx === 0} name={name} ca={ca}
                          alert={getAlert(c)} issues={getInconsistencies(c)} suggestion={suggestNextAction(c)}
                          editable={canEdit(c)}
                          onPriority={handlePriorityChange} onInline={handleInlineChange}
                          onLog={(cand, type, sug) => setLogModal({ candidate: cand, type, suggestion: sug })}
                          onDelete={handleDelete}
                          onAddCompany={() => setModal({ _prefill: { candidateName: name, assignedCA: ca } })} />
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 720 }}>
                      {/* ヘッダー */}
                      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, columnGap: 10, padding: '2px 14px 8px', borderBottom: '1px solid var(--border-soft)', borderLeft: '3px solid transparent' }}>
                        {['注力度', '求職者', '選考企業', 'ステータス', '着地', '紹介料', '面接日', '次回アクション', 'メモ', ''].map((h, i) => (
                          <div key={i} style={hcell}>{h}</div>
                        ))}
                      </div>
                      {/* 行 */}
                      {[...candidateMap.entries()].map(([name, rows]) =>
                        rows.map((c, idx) => {
                          const alert = getAlert(c)
                          const issues = getInconsistencies(c)
                          const sug = suggestNextAction(c)
                          const isFirst = idx === 0
                          const isLast = idx === rows.length - 1
                          const ss = STATUS_STYLE[c.status] || STATUS_STYLE.lead
                          const editable = canEdit(c)
                          return (
                            <div key={c.id} className="list-row" style={{ display: 'grid', gridTemplateColumns: GRID_COLS, alignItems: 'center', columnGap: 10, padding: '8px 14px', borderBottom: isLast ? '1px solid var(--border-card)' : '1px solid var(--border-soft)', borderLeft: `3px solid ${isFirst ? accent : 'transparent'}`, background: alert.isAlert ? 'var(--alert-row)' : undefined }}>
                              <div>{isFirst && <PriorityStars value={c.priority ?? 0} onChange={v => handlePriorityChange(name, v)} disabled={!editable} />}</div>
                              <div style={{ minWidth: 0 }}>
                                {isFirst ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 9, cursor: 'help' }}>●</span>}
                                    {issues.length > 0 && <span title={issues.join('\n')} style={{ color: '#f59e0b', fontSize: 11, cursor: 'help' }}>⚠</span>}
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{name}</span>
                                    {editable && <button className="pill-btn" onClick={() => setModal({ _prefill: { candidateName: name, assignedCA: ca } })} style={{ fontSize: 10, padding: '1px 7px', background: `${accent}22`, border: 'none', borderRadius: 20, cursor: 'pointer', color: accent, fontWeight: 700 }}>+企業</button>}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--faint)', fontSize: 12, paddingLeft: 4 }}>└</span>
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <input className="cell-input" value={c.company || ''} readOnly={!editable} onChange={e => handleInlineChange(c, 'company', e.target.value)} style={{ ...inputSt, width: '100%', opacity: editable ? 1 : 0.65 }} placeholder="企業名" />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <select value={c.status} disabled={!editable} onChange={e => handleInlineChange(c, 'status', e.target.value)} style={{ ...inputSt, width: '100%', background: ss.bg, color: ss.color, fontWeight: 700, fontSize: 12, borderRadius: 20, paddingLeft: 10, cursor: editable ? 'pointer' : 'default', appearance: 'none', WebkitAppearance: 'none', opacity: editable ? 1 : 0.8 }}>
                                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                                {c.statusChangedAt && <div style={{ fontSize: 10, color: 'var(--muted-2)', marginTop: 3, paddingLeft: 2 }}>{fmtDt(c.statusChangedAt)}</div>}
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <button className="pill-btn" disabled={!editable} onClick={() => handleInlineChange(c, 'winCandidate', !c.winCandidate)} title="着地候補にマーク"
                                  style={{ width: 28, height: 28, border: `1.5px solid ${c.winCandidate ? '#16a34a' : 'var(--border)'}`, borderRadius: 7, background: c.winCandidate ? 'rgba(34,197,94,0.16)' : 'var(--surface)', color: c.winCandidate ? '#16a34a' : 'var(--faint)', fontSize: 13, cursor: editable ? 'pointer' : 'default' }}>{c.winCandidate ? '✓' : '○'}</button>
                              </div>
                              <div>
                                <input className="cell-input" type="number" value={c.fee ?? ''} readOnly={!editable} onChange={e => handleInlineChange(c, 'fee', e.target.value === '' ? null : Number(e.target.value))} style={{ ...inputSt, width: '100%', textAlign: 'right', opacity: editable ? 1 : 0.65 }} placeholder="—" />
                              </div>
                              <div><DateCell value={c.interviewDate} onChange={v => handleInlineChange(c, 'interviewDate', v)} disabled={!editable} /></div>
                              <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setLogModal({ candidate: c, type: 'action', suggestion: sug })}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.nextAction ? 'var(--text-3)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nextAction || '—'}</span>
                                  <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>📋</span>
                                </div>
                              </div>
                              <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setLogModal({ candidate: c, type: 'memo', suggestion: null })}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.memo ? 'var(--text-3)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo || '—'}</span>
                                  <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>📋</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                {editable && <button onClick={() => handleDelete(c)} title="削除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 15, padding: '2px 4px', borderRadius: 4 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)' }}>×</button>}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* 落選・離脱 */}
          {closedShown.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <button onClick={() => setClosedOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted-2)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10 }}>{closedOpen ? '▾' : '▸'}</span>落選・離脱 ({closedShown.length}件)
              </button>
              {closedOpen && (<>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', margin: '8px 2px 0' }}>↩ ステータスを選考中（リード〜成約）に戻すと、上のリストに復活します</div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', marginTop: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 520 : 'auto' }}>
                    <tbody>
                      {closedShown.map(c => {
                        const ss = STATUS_STYLE[c.status] || STATUS_STYLE.withdrawn
                        const editable = canEdit(c)
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ ...td, color: 'var(--muted)', fontWeight: 500 }}>{c.candidateName}</td>
                            <td style={{ ...td, color: 'var(--muted-2)' }}>{c.company}</td>
                            <td style={td}>
                              <select value={c.status} disabled={!editable} onChange={e => handleInlineChange(c, 'status', e.target.value)} title={editable ? 'ステータスを選考中に戻すとリストに復活します' : '閲覧のみ'}
                                style={{ ...inputSt, width: 'auto', background: ss.bg, color: ss.color, fontWeight: 600, fontSize: 11, borderRadius: 20, padding: '2px 10px', cursor: editable ? 'pointer' : 'default', appearance: 'none', WebkitAppearance: 'none', opacity: editable ? 1 : 0.8 }}>
                                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </td>
                            <td style={{ ...td, color: 'var(--muted-2)', fontSize: 12 }}>{c.assignedCA}</td>
                            <td style={{ ...td, color: 'var(--muted-2)', fontSize: 12 }}>{c.memo}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {editable && <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 15 }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)' }}>×</button>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>)}
            </div>
          )}
          </>
          )}
        </div>

        {/* Right sidebar */}
        <div style={isMobile
          ? { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }
          : { width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 120, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          <FunnelChart candidates={[...caActive, ...caClosed]} />
          <PriorityChart candidates={caActive} />
          <TodoPanel items={todoItems} onToggle={handleToggleTodo} />
        </div>
      </div>

      {/* Modals */}
      {modal !== null && (
        <Modal candidate={modal === 'new' ? null : (modal._prefill ? null : modal)} prefill={modal._prefill || null} saving={saving} lockCA={!isAdmin} lockNextAction={!isAdmin} onSave={handleSave} onDelete={c => handleDelete(c)} onClose={() => setModal(null)} />
      )}
      {logModal !== null && (
        <LogModal candidate={logModal.candidate} type={logModal.type} suggestion={logModal.suggestion}
          editable={logModal.type === 'action' ? isAdmin : canEdit(logModal.candidate)}
          onUpdate={handleLogUpdate} onClose={() => setLogModal(null)} />
      )}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      {digestOpen && (
        <DigestModal candidates={active.filter(c => c.assignedCA === currentUser)} todoPending={computeTodos(active.filter(c => c.assignedCA === currentUser), todos).filter(t => !t.isDone)}
          onOpenCandidate={c => { setDigestOpen(false); openCandidate(c) }} onClose={() => setDigestOpen(false)} />
      )}
    </div>
  )
}

const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: 'var(--muted)' }
const card = { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', padding: '15px 16px', boxShadow: 'var(--card-shadow)' }
const cardTitle = { fontWeight: 700, fontSize: 13, color: 'var(--text)', letterSpacing: '-0.01em' }
const th = { padding: '8px 8px', textAlign: 'left', fontSize: 11, color: 'var(--muted-2)', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap', background: 'var(--surface-sub)', borderBottom: '1px solid var(--border-soft)' }
const td = { padding: '7px 7px', verticalAlign: 'middle', fontSize: 13 }
const inputSt = { width: '100%', padding: '4px 7px', border: '1px solid transparent', borderRadius: 6, fontSize: 13, background: 'transparent', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn = { width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }

const mInput = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const mLabel = { fontSize: 11, color: 'var(--muted-2)', fontWeight: 600, marginBottom: 4 }
const mLogBtn = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 11px', border: '1px solid var(--border-soft)', borderRadius: 8, background: 'var(--surface-sub)', cursor: 'pointer' }

// グリッド一覧の列定義（テキスト列がfrで余白を吸収＝右側に隙間を作らない）
const GRID_COLS = '58px 132px minmax(110px,0.9fr) 124px 46px 60px 64px minmax(140px,1.8fr) minmax(96px,1.2fr) 30px'
const hcell = { fontSize: 10.5, color: 'var(--muted-2)', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
