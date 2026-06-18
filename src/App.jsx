import React, { useState, useEffect, useCallback } from 'react'
import { KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL, CA_MEMBERS, STATUSES, STATUS_TODOS, INTERVIEW_STATUSES, WIN_COUNT_STATUSES } from './constants'
import { loadAll, insertCandidate, saveCandidate, removeCandidate, subscribeToChanges, generateId, loadTodos, upsertTodo } from './storage'
import { getAlert } from './alerts'
import Modal from './components/Modal'
import LogModal from './components/LogModal'

const UNIQUE_STATUSES = ['screening', 'interview1', 'interview2', 'interviewFinal', 'offer']

const STATUS_STYLE = {
  lead:           { bg: '#f1f5f9', color: '#64748b' },
  screening:      { bg: '#dbeafe', color: '#1d4ed8' },
  interview1:     { bg: '#e0f2fe', color: '#0369a1' },
  interview2:     { bg: '#ede9fe', color: '#6d28d9' },
  interviewFinal: { bg: '#fae8ff', color: '#a21caf' },
  offer:          { bg: '#dcfce7', color: '#15803d' },
  rejectedDoc:    { bg: '#fee2e2', color: '#b91c1c' },
  rejected1:      { bg: '#fee2e2', color: '#b91c1c' },
  rejectedFinal:  { bg: '#fee2e2', color: '#b91c1c' },
  withdrawn:      { bg: '#f1f5f9', color: '#94a3b8' },
}

const CA_THEME = {
  [CA_MEMBERS[0]]: { dot: '#3b82f6', headerBg: '#f0f7ff', accent: '#3b82f6', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
  [CA_MEMBERS[1]]: { dot: '#10b981', headerBg: '#f0fdf6', accent: '#10b981', badgeBg: '#d1fae5', badgeColor: '#065f46' },
  [CA_MEMBERS[2]]: { dot: '#8b5cf6', headerBg: '#faf5ff', accent: '#8b5cf6', badgeBg: '#ede9fe', badgeColor: '#5b21b6' },
}

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

function PriorityStars({ value, onChange }) {
  const color = PRI_COLOR[value] || '#e2e8f0'
  return (
    <div style={{ display: 'flex', gap: 1 }} title={PRI_LABEL[value] || '未設定'}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onClick={() => onChange(value === i ? 0 : i)} style={{ fontSize: 12, color: i <= value ? color : '#e2e8f0', cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}>★</span>
      ))}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map(({ level, count }) => (
          <div key={level}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: PRI_COLOR[level], fontWeight: 700 }}>{'★'.repeat(level)}</span>
              <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{PRI_LABEL[level]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: count > 0 ? 600 : 400, color: count > 0 ? '#475569' : '#cbd5e0' }}>{count}名</span>
            </div>
            <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              {count > 0 && <div style={{ width: `${(count/max)*100}%`, height: '100%', background: PRI_COLOR[level], borderRadius: 3 }} />}
            </div>
          </div>
        ))}
      </div>
      {none > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>未設定</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{none}名</span>
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
          <span style={{ marginLeft: 8, background: '#fef2f2', color: '#ef4444', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{pending.length}</span>
        )}
      </div>
      {pending.length === 0 && done.length === 0 && (
        <div style={{ fontSize: 12, color: '#cbd5e0', textAlign: 'center', padding: '8px 0' }}>TODOなし</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pending.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <button onClick={() => onToggle(t, true)} style={{ width: 16, height: 16, border: '1.5px solid #cbd5e0', borderRadius: 4, background: '#fff', cursor: 'pointer', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
              <div style={{ color: '#1e293b', fontWeight: 500, lineHeight: 1.4 }}>{t.taskLabel}</div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{t.candidateName} · {STATUS_LABEL[t.statusKey]}</div>
            </div>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowDone(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{showDone ? '▾' : '▸'}</span> 完了済み ({done.length})
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {done.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: 0.55 }}>
                  <button onClick={() => onToggle(t, false)} style={{ width: 16, height: 16, border: '1.5px solid #10b981', borderRadius: 4, background: '#dcfce7', cursor: 'pointer', flexShrink: 0, marginTop: 1, fontSize: 9, color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                  <div style={{ fontSize: 11, flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#475569', textDecoration: 'line-through' }}>{t.taskLabel}</div>
                    <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>{t.candidateName} · {t.doneAt ? fmtDt(t.doneAt) : ''}</div>
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

function MobileCard({ c, isFirst, name, ca, theme, alert, onPriority, onInline, onLog, onDelete, onAddCompany }) {
  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.lead
  return (
    <div style={{ padding: '14px 14px', borderBottom: '1px solid #f1f5f9', background: alert.isAlert ? '#fffbfb' : '#fff', borderLeft: `3px solid ${isFirst ? theme.accent : '#f1f5f9'}` }}>
      {/* 上段：名前 or └、注力度、削除 */}
      {isFirst ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 9 }}>●</span>}
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{name}</span>
          <PriorityStars value={c.priority ?? 0} onChange={v => onPriority(name, v)} />
          <button onClick={onAddCompany} style={{ fontSize: 11, padding: '2px 9px', background: theme.badgeBg, border: 'none', borderRadius: 20, cursor: 'pointer', color: theme.badgeColor, fontWeight: 700 }}>+企業</button>
          <button onClick={() => onDelete(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e0', fontSize: 18 }}>×</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>└ 同じ候補者の別企業</span>
          <button onClick={() => onDelete(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e0', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* 企業名 */}
      <input value={c.company || ''} onChange={e => onInline(c, 'company', e.target.value)} placeholder="企業名" style={{ ...mInput, fontWeight: 600, fontSize: 15 }} />

      {/* ステータス + 成約 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <select value={c.status} onChange={e => onInline(c, 'status', e.target.value)} style={{ ...mInput, flex: 1, background: ss.bg, color: ss.color, fontWeight: 700, appearance: 'none', WebkitAppearance: 'none', border: 'none' }}>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={() => onInline(c, 'winCandidate', !c.winCandidate)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', border: `1.5px solid ${c.winCandidate ? '#16a34a' : '#e2e8f0'}`, borderRadius: 8, background: c.winCandidate ? '#dcfce7' : '#fff', color: c.winCandidate ? '#16a34a' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {c.winCandidate ? '✓' : '○'} 成約
        </button>
      </div>
      {c.statusChangedAt && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>変更: {fmtDt(c.statusChangedAt)}</div>}

      {/* 紹介料 + 面接日 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={mLabel}>紹介料（万円）</div>
          <input type="number" value={c.fee ?? ''} onChange={e => onInline(c, 'fee', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" style={mInput} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={mLabel}>面接日</div>
          <input type="date" value={c.interviewDate || ''} onChange={e => onInline(c, 'interviewDate', e.target.value)} style={mInput} />
        </div>
      </div>

      {/* 次回アクション・メモ */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => onLog(c, 'action')} style={mLogBtn}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>📋 次回</span>
          <span style={{ fontSize: 13, color: c.nextAction ? '#475569' : '#cbd5e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nextAction || '—'}</span>
        </button>
        <button onClick={() => onLog(c, 'memo')} style={mLogBtn}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>📋 メモ</span>
          <span style={{ fontSize: 13, color: c.memo ? '#475569' : '#cbd5e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo || '—'}</span>
        </button>
      </div>
    </div>
  )
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
  const isMobile = useIsMobile()
  const px = isMobile ? 12 : 24

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

  // CA と ステータスで絞り込み
  const filteredByCA = caFilter === 'all' ? active : active.filter(c => c.assignedCA === caFilter)
  const filteredForTable = statusFilter ? filteredByCA.filter(c => c.status === statusFilter) : filteredByCA
  const alertCount = filteredByCA.filter(c => getAlert(c).isAlert).length

  async function handleSave(form) {
    setSaving(true)
    try {
      const isNew = !form.id
      const record = isNew ? { ...form, id: generateId() } : form
      const saved = isNew ? await insertCandidate(record) : await saveCandidate(record)
      setCandidates(prev => isNew ? [...prev, saved] : prev.map(c => c.id === saved.id ? saved : c))
      setModal(null)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleInlineChange(candidate, field, value) {
    const statusChanged = field === 'status' && candidate.status !== value
    const updated = {
      ...candidate, [field]: value,
      statusChangedAt: statusChanged ? new Date().toISOString() : candidate.statusChangedAt,
      updatedAt: new Date().toISOString(),
    }
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
    try { await saveCandidate(updated) }
    catch (e) { alert('保存失敗: ' + e.message); load() }
  }

  async function handlePriorityChange(candidateName, value) {
    const toUpdate = candidates.filter(c => c.candidateName === candidateName)
    setCandidates(prev => prev.map(c => c.candidateName === candidateName ? { ...c, priority: value } : c))
    try { await Promise.all(toUpdate.map(c => saveCandidate({ ...c, priority: value }))) }
    catch (e) { alert('保存失敗: ' + e.message); load() }
  }

  function handleLogUpdate(updatedCandidate) {
    setCandidates(prev => prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c))
    setLogModal(prev => prev ? { ...prev, candidate: updatedCandidate } : null)
  }

  async function handleDelete(id) {
    if (!confirm('削除しますか？')) return
    try { await removeCandidate(id); setCandidates(prev => prev.filter(c => c.id !== id)); setModal(null) }
    catch (e) { alert('削除失敗: ' + e.message) }
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

  if (loading) return <div style={center}>読み込み中...</div>
  if (error) return <div style={{ ...center, color: '#ef4444' }}>{error}</div>

  // CAグループ計算
  const caGroups = CA_MEMBERS.map(ca => {
    const allCaRows = active.filter(c => c.assignedCA === ca)
    const displayRows = filteredForTable.filter(c => c.assignedCA === ca)
    const candidateMap = new Map()
    for (const c of displayRows) {
      const key = c.candidateName || '（名前未設定）'
      if (!candidateMap.has(key)) candidateMap.set(key, [])
      candidateMap.get(key).push(c)
    }
    // ユニーク：全CA候補者から計算
    const allCaNames = new Map()
    for (const c of allCaRows) {
      if (!allCaNames.has(c.candidateName)) allCaNames.set(c.candidateName, [])
      allCaNames.get(c.candidateName).push(c)
    }
    const uniqueCount = [...allCaNames.values()].filter(rows => rows.some(r => UNIQUE_STATUSES.includes(r.status))).length
    // 成約候補（1次以降のみ紹介料カウント）
    const winApps = allCaRows.filter(c => c.winCandidate && WIN_COUNT_STATUSES.includes(c.status))
    const winFee = winApps.reduce((s, c) => s + (Number(c.fee) || 0), 0)
    const winCount = winApps.length
    return { ca, candidateMap, uniqueCount, winCount, winFee, totalCandidates: allCaNames.size }
  })

  const visibleGroups = caFilter === 'all' ? caGroups : caGroups.filter(g => g.ca === caFilter)
  const todoItems = computeTodos(filteredByCA, todos)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: `0 ${px}px`, height: 56, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 30, height: 30, background: '#0f172a', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>宅</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: '#0f172a' }}>宅建Jobエージェント</span>
        {!isMobile && <span style={{ color: '#e2e8f0' }}>|</span>}
        {!isMobile && <span style={{ fontSize: 13, color: '#94a3b8' }}>案件管理</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {alertCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: isMobile ? '4px 9px' : '4px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{isMobile ? alertCount : `要注意 ${alertCount}件`}</span>
            </div>
          )}
          <button onClick={() => setModal('new')} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: isMobile ? '8px 14px' : '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {isMobile ? '+ 追加' : '+ 候補者を追加'}
          </button>
        </div>
      </header>

      {/* Kanban strip（クリックで絞り込み） */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: `10px ${px}px` }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }}>
          {KANBAN_STATUSES.map(status => {
            const items = filteredByCA.filter(c => c.status === status)
            const hasAlert = items.some(c => getAlert(c).isAlert)
            const ss = STATUS_STYLE[status]
            const isSelected = statusFilter === status
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isSelected ? null : status)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, border: `${isSelected ? 2 : 1}px solid`, borderColor: isSelected ? ss.color : (items.length > 0 ? ss.bg : '#f1f5f9'), background: items.length > 0 ? ss.bg : '#fafafa', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', boxShadow: isSelected ? `0 0 0 3px ${ss.color}30` : 'none' }}
              >
                <span style={{ fontSize: 12, color: items.length > 0 ? ss.color : '#cbd5e0', fontWeight: 500 }}>{STATUS_LABEL[status]}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: items.length > 0 ? ss.color : '#cbd5e0' }}>{items.length}</span>
                {hasAlert && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠</span>}
              </button>
            )
          })}
          {statusFilter && (
            <button onClick={() => setStatusFilter(null)} style={{ marginLeft: 8, fontSize: 12, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', flexShrink: 0 }}>
              × 絞り込み解除
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ padding: isMobile ? '14px 12px' : '20px 24px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 20, alignItems: 'flex-start' }}>

        {/* Left: CA sections */}
        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* CA filter tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...CA_MEMBERS].map(f => {
              const group = caGroups.find(g => g.ca === f)
              const isActive = caFilter === f
              const theme = CA_THEME[f]
              return (
                <button key={f} onClick={() => setCaFilter(f)} style={{ padding: '7px 18px', borderRadius: 20, border: '1.5px solid', borderColor: isActive ? (theme?.accent || '#0f172a') : '#e2e8f0', background: isActive ? (theme?.accent || '#0f172a') : '#fff', color: isActive ? '#fff' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  {f === 'all' ? '全体' : f}
                  {f !== 'all' && group && (
                    <span style={{ fontSize: 11, background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9', borderRadius: 20, padding: '1px 7px', color: isActive ? '#fff' : '#64748b' }}>
                      {group.totalCandidates}名
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ステータス絞り込み中のバナー */}
          {statusFilter && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#0369a1', fontWeight: 600 }}>「{STATUS_LABEL[statusFilter]}」で絞り込み中</span>
              <button onClick={() => setStatusFilter(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12 }}>× 解除</button>
            </div>
          )}

          {/* CA sections */}
          {visibleGroups.map(({ ca, candidateMap, uniqueCount, winCount, winFee }) => {
            const theme = CA_THEME[ca] || { dot: '#64748b', headerBg: '#f8fafc', accent: '#64748b', badgeBg: '#f1f5f9', badgeColor: '#475569' }
            const totalApps = [...candidateMap.values()].reduce((s, r) => s + r.length, 0)

            return (
              <div key={ca} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                <div style={{ background: theme.headerBg, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e8edf2', flexWrap: 'wrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{ca}</span>
                  <div style={{ background: theme.badgeBg, color: theme.badgeColor, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                    ユニーク {uniqueCount}件
                  </div>
                  {winCount > 0 && (
                    <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓ 成約候補 {winCount}件</span>
                      {winFee > 0 && <span style={{ opacity: 0.8 }}>/ {winFee}万円</span>}
                    </div>
                  )}
                  {candidateMap.size > 0 && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{candidateMap.size}名 · {totalApps}社</span>
                  )}
                  <button onClick={() => setModal({ _prefill: { assignedCA: ca } })} style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px', background: '#fff', border: `1.5px solid ${theme.accent}`, borderRadius: 7, cursor: 'pointer', color: theme.accent, fontWeight: 700 }}>
                    + 追加
                  </button>
                </div>

                {candidateMap.size === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ color: '#cbd5e0', fontSize: 13, marginBottom: 10 }}>{statusFilter ? `「${STATUS_LABEL[statusFilter]}」の候補者なし` : '候補者なし'}</div>
                    {!statusFilter && <button onClick={() => setModal({ _prefill: { assignedCA: ca } })} style={{ fontSize: 12, padding: '6px 18px', background: 'transparent', border: '1.5px dashed #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }}>+ 候補者を追加</button>}
                  </div>
                ) : isMobile ? (
                  <div>
                    {[...candidateMap.entries()].map(([name, rows]) =>
                      rows.map((c, idx) => (
                        <MobileCard
                          key={c.id}
                          c={c}
                          isFirst={idx === 0}
                          name={name}
                          ca={ca}
                          theme={theme}
                          alert={getAlert(c)}
                          onPriority={handlePriorityChange}
                          onInline={handleInlineChange}
                          onLog={(cand, type) => setLogModal({ candidate: cand, type })}
                          onDelete={handleDelete}
                          onAddCompany={() => setModal({ _prefill: { candidateName: name, assignedCA: ca } })}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, width: 68 }}>注力度</th>
                          <th style={th}>求職者</th>
                          <th style={th}>選考企業</th>
                          <th style={{ ...th, width: 140 }}>ステータス</th>
                          <th style={{ ...th, width: 52 }}>成約</th>
                          <th style={{ ...th, width: 80 }}>紹介料</th>
                          <th style={{ ...th, width: 120 }}>面接日</th>
                          <th style={{ ...th, minWidth: 140 }}>次回アクション</th>
                          <th style={{ ...th, minWidth: 110 }}>メモ</th>
                          <th style={{ ...th, width: 36 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {[...candidateMap.entries()].map(([name, rows]) =>
                          rows.map((c, idx) => {
                            const alert = getAlert(c)
                            const isFirst = idx === 0
                            const isLast = idx === rows.length - 1
                            const ss = STATUS_STYLE[c.status] || STATUS_STYLE.lead
                            return (
                              <tr key={c.id} style={{ borderBottom: isLast ? '1px solid #e8edf2' : '1px solid #f8fafc', background: alert.isAlert ? '#fffbfb' : '#fff' }}>
                                {/* 注力度 */}
                                <td style={{ ...td, paddingLeft: 14 }}>
                                  {isFirst && <PriorityStars value={c.priority ?? 0} onChange={v => handlePriorityChange(name, v)} />}
                                </td>
                                {/* 求職者名 */}
                                <td style={{ ...td, minWidth: 110, borderLeft: `3px solid ${isFirst ? theme.accent : 'transparent'}`, paddingLeft: 12 }}>
                                  {isFirst ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 9, cursor: 'help' }}>●</span>}
                                      <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{name}</span>
                                      <button onClick={() => setModal({ _prefill: { candidateName: name, assignedCA: ca } })} style={{ fontSize: 10, padding: '1px 7px', background: theme.badgeBg, border: 'none', borderRadius: 20, cursor: 'pointer', color: theme.badgeColor, fontWeight: 700 }}>+企業</button>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#cbd5e0', fontSize: 12, paddingLeft: 10 }}>└</span>
                                  )}
                                </td>
                                {/* 選考企業 */}
                                <td style={td}>
                                  <input value={c.company || ''} onChange={e => handleInlineChange(c, 'company', e.target.value)} onBlur={e => handleInlineChange(c, 'company', e.target.value)} style={inputSt} placeholder="企業名" />
                                </td>
                                {/* ステータス + 変更日時 */}
                                <td style={td}>
                                  <select value={c.status} onChange={e => handleInlineChange(c, 'status', e.target.value)} style={{ ...inputSt, background: ss.bg, color: ss.color, fontWeight: 600, fontSize: 12, borderRadius: 20, paddingLeft: 10, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                  </select>
                                  {c.statusChangedAt && (
                                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, paddingLeft: 2 }}>{fmtDt(c.statusChangedAt)}</div>
                                  )}
                                </td>
                                {/* 成約候補チェック */}
                                <td style={{ ...td, textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleInlineChange(c, 'winCandidate', !c.winCandidate)}
                                    title="成約候補にマーク"
                                    style={{ width: 28, height: 28, border: `1.5px solid ${c.winCandidate ? '#16a34a' : '#e2e8f0'}`, borderRadius: 6, background: c.winCandidate ? '#dcfce7' : '#fff', color: c.winCandidate ? '#16a34a' : '#cbd5e0', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >{c.winCandidate ? '✓' : '○'}</button>
                                </td>
                                {/* 紹介料 */}
                                <td style={td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <input type="number" value={c.fee ?? ''} onChange={e => handleInlineChange(c, 'fee', e.target.value === '' ? null : Number(e.target.value))} style={{ ...inputSt, width: 52, textAlign: 'right' }} placeholder="0" />
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>万</span>
                                  </div>
                                </td>
                                {/* 面接日 */}
                                <td style={td}>
                                  <input type="date" value={c.interviewDate || ''} onChange={e => handleInlineChange(c, 'interviewDate', e.target.value)} style={inputSt} />
                                </td>
                                {/* 次回アクション（ログ） */}
                                <td style={{ ...td, cursor: 'pointer' }} onClick={() => setLogModal({ candidate: c, type: 'action' })}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 12, color: c.nextAction ? '#475569' : '#cbd5e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nextAction || '—'}</span>
                                    <span style={{ fontSize: 11, color: '#cbd5e0', flexShrink: 0 }}>📋</span>
                                  </div>
                                </td>
                                {/* メモ（ログ） */}
                                <td style={{ ...td, cursor: 'pointer' }} onClick={() => setLogModal({ candidate: c, type: 'memo' })}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 12, color: c.memo ? '#475569' : '#cbd5e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.memo || '—'}</span>
                                    <span style={{ fontSize: 11, color: '#cbd5e0', flexShrink: 0 }}>📋</span>
                                  </div>
                                </td>
                                {/* 削除 */}
                                <td style={{ ...td, textAlign: 'center' }}>
                                  <button onClick={() => handleDelete(c.id)} title="削除" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 15, padding: '2px 4px', borderRadius: 4 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'none' }}
                                  >×</button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* 落選・離脱 */}
          {closed.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <button onClick={() => setClosedOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10 }}>{closedOpen ? '▾' : '▸'}</span>落選・離脱 ({closed.length}件)
              </button>
              {closedOpen && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 520 : 'auto' }}>
                    <tbody>
                      {closed.map(c => {
                        const ss = STATUS_STYLE[c.status] || STATUS_STYLE.withdrawn
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ ...td, color: '#64748b', fontWeight: 500 }}>{c.candidateName}</td>
                            <td style={{ ...td, color: '#94a3b8' }}>{c.company}</td>
                            <td style={td}><span style={{ background: ss.bg, color: ss.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{STATUS_LABEL[c.status]}</span></td>
                            <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{c.assignedCA}</td>
                            <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{c.memo}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 15 }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#e2e8f0' }}
                              >×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={isMobile
          ? { width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }
          : { width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 76, maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}>
          <PriorityChart candidates={filteredByCA} />
          <TodoPanel items={todoItems} onToggle={handleToggleTodo} />
        </div>
      </div>

      {/* Modals */}
      {modal !== null && (
        <Modal candidate={modal === 'new' ? null : (modal._prefill ? null : modal)} prefill={modal._prefill || null} saving={saving} onSave={handleSave} onDelete={handleDelete} onClose={() => setModal(null)} />
      )}
      {logModal !== null && (
        <LogModal candidate={logModal.candidate} type={logModal.type} onUpdate={handleLogUpdate} onClose={() => setLogModal(null)} />
      )}
    </div>
  )
}

const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#64748b' }
const card = { background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', padding: '14px 16px', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }
const cardTitle = { fontWeight: 700, fontSize: 13, color: '#0f172a', letterSpacing: '-0.01em' }
const th = { padding: '8px 8px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }
const td = { padding: '7px 7px', verticalAlign: 'middle', fontSize: 13 }
const inputSt = { width: '100%', padding: '4px 7px', border: '1px solid transparent', borderRadius: 6, fontSize: 13, background: 'transparent', color: '#1e293b', boxSizing: 'border-box', outline: 'none' }

// モバイルカード用スタイル
const mInput = { width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fff', color: '#1e293b', boxSizing: 'border-box', outline: 'none' }
const mLabel = { fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }
const mLogBtn = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 11px', border: '1px solid #f1f5f9', borderRadius: 8, background: '#f8fafc', cursor: 'pointer' }
