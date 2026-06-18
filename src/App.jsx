import React, { useState, useEffect, useCallback } from 'react'
import { KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL, CA_MEMBERS, STATUSES } from './constants'
import { loadAll, insertCandidate, saveCandidate, removeCandidate, subscribeToChanges, generateId } from './storage'
import { getAlert } from './alerts'
import Modal from './components/Modal'

export default function App() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | candidate object
  const [saving, setSaving] = useState(false)
  const [caFilter, setCaFilter] = useState('all')
  const [closedOpen, setClosedOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await loadAll()
      setCandidates(data)
      setError(null)
    } catch (e) {
      setError('読み込み失敗: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => subscribeToChanges(load), [load])

  const filtered = candidates.filter(c =>
    caFilter === 'all' || c.assignedCA === caFilter
  )
  const active = filtered.filter(c => !CLOSED_STATUSES.includes(c.status))
  const closed = filtered.filter(c => CLOSED_STATUSES.includes(c.status))
  const alertCount = active.filter(c => getAlert(c).isAlert).length

  async function handleSave(form) {
    setSaving(true)
    try {
      const isNew = !form.id
      const record = isNew ? { ...form, id: generateId() } : form
      const saved = isNew ? await insertCandidate(record) : await saveCandidate(record)
      setCandidates(prev => isNew ? [...prev, saved] : prev.map(c => c.id === saved.id ? saved : c))
      setModal(null)
    } catch (e) {
      alert('保存失敗: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleInlineChange(candidate, field, value) {
    const today = new Date().toISOString().slice(0, 10)
    const statusChanged = field === 'status' && candidate.status !== value
    const updated = {
      ...candidate,
      [field]: value,
      statusChangedAt: statusChanged ? today : candidate.statusChangedAt,
      updatedAt: today,
    }
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
    try {
      await saveCandidate(updated)
    } catch (e) {
      alert('保存失敗: ' + e.message)
      load()
    }
  }

  async function handleDelete(id) {
    if (!confirm('削除しますか？')) return
    try {
      await removeCandidate(id)
      setCandidates(prev => prev.filter(c => c.id !== id))
      setModal(null)
    } catch (e) {
      alert('削除失敗: ' + e.message)
    }
  }

  async function handleAddApplication(candidateName, assignedCA) {
    setModal({ _prefill: { candidateName, assignedCA } })
  }

  if (loading) return <div style={center}>読み込み中...</div>
  if (error) return <div style={{ ...center, color: '#e53e3e' }}>{error}</div>

  // グループ化（求職者名でまとめる）
  const groups = []
  const seen = {}
  for (const c of active) {
    if (!seen[c.candidateName]) {
      seen[c.candidateName] = { name: c.candidateName, rows: [] }
      groups.push(seen[c.candidateName])
    }
    seen[c.candidateName].rows.push(c)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', fontFamily: 'system-ui, sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ background: '#1a2e4a', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>案件管理 | 宅建Jobエージェント</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={caFilter} onChange={e => setCaFilter(e.target.value)} style={selStyle}>
            <option value="all">全担当</option>
            {CA_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {alertCount > 0 && (
            <span style={{ background: '#e53e3e', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12 }}>
              要注意 {alertCount}件
            </span>
          )}
          <button onClick={() => setModal('new')} style={addBtn}>+ 候補者追加</button>
        </div>
      </div>

      {/* ① カンバン（上部サマリー） */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 11, color: '#718096', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>選考サマリー</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {KANBAN_STATUSES.map(status => {
            const items = active.filter(c => c.status === status)
            const alertItems = items.filter(c => getAlert(c).isAlert)
            return (
              <div key={status} style={{ minWidth: 110, flex: '0 0 110px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#718096', marginBottom: 4 }}>{STATUS_LABEL[status]}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#2d3748', lineHeight: 1 }}>{items.length}</div>
                {alertItems.length > 0 && (
                  <div style={{ fontSize: 10, color: '#e53e3e', marginTop: 3 }}>⚠ {alertItems.length}件要注意</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ② テーブル（下部・グループ別・直接編集） */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #e2e8f0' }}>
                <th style={th}>求職者名</th>
                <th style={th}>選考企業</th>
                <th style={th}>ステータス</th>
                <th style={th}>担当CA</th>
                <th style={th}>紹介料</th>
                <th style={th}>面接日</th>
                <th style={th}>次回アクション</th>
                <th style={th}>メモ</th>
                <th style={{ ...th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#a0aec0' }}>候補者を追加してください</td></tr>
              )}
              {groups.map(group => (
                <React.Fragment key={group.name}>
                  {/* 求職者親行 */}
                  <tr style={{ background: '#edf2f7', borderBottom: '1px solid #e2e8f0' }}>
                    <td colSpan={9} style={{ padding: '6px 12px', fontWeight: 600, color: '#2d3748', fontSize: 13 }}>
                      {group.name}
                      <span style={{ fontWeight: 400, color: '#718096', fontSize: 11, marginLeft: 8 }}>{group.rows.length}社選考中</span>
                      <button
                        onClick={() => handleAddApplication(group.name, group.rows[0]?.assignedCA)}
                        style={{ marginLeft: 12, fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid #cbd5e0', borderRadius: 4, cursor: 'pointer', color: '#4a5568' }}
                      >+ 企業追加</button>
                    </td>
                  </tr>
                  {/* 選考行 */}
                  {group.rows.map(c => {
                    const alert = getAlert(c)
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0', background: alert.isAlert ? '#fff5f5' : '#fff' }}>
                        <td style={td}>
                          {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#e53e3e', marginRight: 4, cursor: 'help' }}>●</span>}
                          <span style={{ color: '#a0aec0', fontSize: 11 }}>└</span>
                        </td>
                        <td style={td}>
                          <input
                            value={c.company || ''}
                            onChange={e => handleInlineChange(c, 'company', e.target.value)}
                            onBlur={e => handleInlineChange(c, 'company', e.target.value)}
                            style={cellInput}
                          />
                        </td>
                        <td style={td}>
                          <select
                            value={c.status}
                            onChange={e => handleInlineChange(c, 'status', e.target.value)}
                            style={{ ...cellInput, color: alert.isAlert ? '#e53e3e' : '#2d3748' }}
                          >
                            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </td>
                        <td style={td}>
                          <select
                            value={c.assignedCA || ''}
                            onChange={e => handleInlineChange(c, 'assignedCA', e.target.value)}
                            style={cellInput}
                          >
                            {CA_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            value={c.fee ?? ''}
                            onChange={e => handleInlineChange(c, 'fee', e.target.value === '' ? null : Number(e.target.value))}
                            style={{ ...cellInput, width: 70 }}
                            placeholder="万円"
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="date"
                            value={c.interviewDate || ''}
                            onChange={e => handleInlineChange(c, 'interviewDate', e.target.value)}
                            style={cellInput}
                          />
                        </td>
                        <td style={td}>
                          <input
                            value={c.nextAction || ''}
                            onChange={e => handleInlineChange(c, 'nextAction', e.target.value)}
                            onBlur={e => handleInlineChange(c, 'nextAction', e.target.value)}
                            style={cellInput}
                            placeholder="次回アクション"
                          />
                        </td>
                        <td style={td}>
                          <input
                            value={c.memo || ''}
                            onChange={e => handleInlineChange(c, 'memo', e.target.value)}
                            onBlur={e => handleInlineChange(c, 'memo', e.target.value)}
                            style={cellInput}
                            placeholder="メモ"
                          />
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button onClick={() => handleDelete(c.id)} style={delBtn} title="削除">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* 落選・離脱 */}
        {closed.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setClosedOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#718096', padding: '4px 0' }}>
              {closedOpen ? '▼' : '▶'} 落選・離脱 ({closed.length}件)
            </button>
            {closedOpen && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginTop: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {closed.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={td}>{c.candidateName}</td>
                        <td style={td}>{c.company}</td>
                        <td style={td}><span style={{ color: '#a0aec0' }}>{STATUS_LABEL[c.status]}</span></td>
                        <td style={td}>{c.assignedCA}</td>
                        <td style={td}>{c.memo}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button onClick={() => handleDelete(c.id)} style={delBtn} title="削除">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* モーダル */}
      {modal !== null && (
        <Modal
          candidate={modal === 'new' ? null : (modal._prefill ? null : modal)}
          prefill={modal._prefill || null}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16 }
const selStyle = { fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #4a6fa5', background: 'transparent', color: '#fff' }
const addBtn = { background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#718096', fontWeight: 500, whiteSpace: 'nowrap' }
const td = { padding: '5px 8px', verticalAlign: 'middle' }
const cellInput = { width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: 4, fontSize: 13, background: 'transparent', color: '#2d3748', boxSizing: 'border-box', cursor: 'pointer' }
const delBtn = { background: 'none', border: 'none', color: '#cbd5e0', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }
