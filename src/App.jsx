import React, { useState, useEffect, useCallback } from 'react'
import { CA_MEMBERS, KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL } from './constants'
import { loadAll, insertCandidate, saveCandidate, removeCandidate, subscribeToChanges, generateId } from './storage'
import { getAlert } from './alerts'
import Modal from './components/Modal'

export default function App() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // null = closed, 'new' = new, candidate obj = edit
  const [caFilter, setCaFilter] = useState('all')
  const [alertOnly, setAlertOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await loadAll()
      setCandidates(data)
      setError(null)
    } catch (e) {
      setError('データの読み込みに失敗しました: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    return subscribeToChanges(load)
  }, [load])

  const filtered = candidates.filter(c => {
    if (caFilter !== 'all' && c.assignedCA !== caFilter) return false
    if (alertOnly && !getAlert(c).isAlert) return false
    return true
  })

  const alertCount = candidates.filter(c => getAlert(c).isAlert).length

  async function handleSave(form) {
    setSaving(true)
    try {
      const isNew = !form.id
      const record = isNew ? { ...form, id: generateId() } : form
      const saved = isNew ? await insertCandidate(record) : await saveCandidate(record)
      setCandidates(prev =>
        isNew ? [...prev, saved] : prev.map(c => c.id === saved.id ? saved : c)
      )
      setSelected(null)
    } catch (e) {
      alert('保存に失敗しました: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('この候補者を削除しますか？')) return
    setSaving(true)
    try {
      await removeCandidate(id)
      setCandidates(prev => prev.filter(c => c.id !== id))
      setSelected(null)
    } catch (e) {
      alert('削除に失敗しました: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={centerStyle}>読み込み中...</div>
  if (error) return <div style={{ ...centerStyle, color: '#c00' }}>{error}</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ background: '#1a2e4a', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>案件管理 | 宅建Jobエージェント</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={caFilter} onChange={e => setCaFilter(e.target.value)} style={selectStyle}>
            <option value="all">全担当</option>
            {CA_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={alertOnly} onChange={e => setAlertOnly(e.target.checked)} />
            要注意のみ {alertCount > 0 && <span style={{ background: '#e53e3e', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{alertCount}</span>}
          </label>
          <button onClick={() => setSelected('new')} style={primaryBtn}>+ 候補者追加</button>
        </div>
      </div>

      {/* カンバン */}
      <div style={{ display: 'flex', gap: 12, padding: 16, overflowX: 'auto' }}>
        {KANBAN_STATUSES.map(status => {
          const cols = filtered.filter(c => c.status === status)
          return (
            <div key={status} style={{ minWidth: 200, flex: '0 0 200px', background: '#e2e8f0', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#2d3748' }}>
                {STATUS_LABEL[status]}
                <span style={{ marginLeft: 6, background: '#cbd5e0', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{cols.length}</span>
              </div>
              {cols.map(c => <Card key={c.id} candidate={c} onClick={() => setSelected(c)} />)}
            </div>
          )
        })}
      </div>

      {/* 落選・離脱 */}
      <ClosedSection
        candidates={filtered.filter(c => CLOSED_STATUSES.includes(c.status))}
        onClick={c => setSelected(c)}
      />

      {/* モーダル */}
      {selected !== null && (
        <Modal
          candidate={selected === 'new' ? null : selected}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function Card({ candidate, onClick }) {
  const alert = getAlert(candidate)
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 8,
        cursor: 'pointer',
        border: alert.isAlert ? '2px solid #e53e3e' : '1px solid #e2e8f0',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{candidate.candidateName}</div>
      {candidate.company && <div style={{ color: '#718096', fontSize: 12 }}>{candidate.company}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#a0aec0' }}>
        <span>{candidate.assignedCA}</span>
        {candidate.fee && <span>{candidate.fee}万円</span>}
      </div>
      {alert.isAlert && (
        <div style={{ color: '#e53e3e', fontSize: 11, marginTop: 4 }}>{alert.reasons[0]}</div>
      )}
    </div>
  )
}

function ClosedSection({ candidates, onClick }) {
  const [open, setOpen] = useState(false)
  if (candidates.length === 0) return null
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#4a5568', fontWeight: 600 }}>
        {open ? '▼' : '▶'} 落選・離脱 ({candidates.length}件)
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {candidates.map(c => (
            <div key={c.id} onClick={() => onClick(c)} style={{ background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', border: '1px solid #e2e8f0', fontSize: 13 }}>
              <span style={{ color: '#718096', fontSize: 11, marginRight: 6 }}>{STATUS_LABEL[c.status]}</span>
              {c.candidateName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16 }
const selectStyle = { fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #4a6fa5' }
const primaryBtn = { background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
