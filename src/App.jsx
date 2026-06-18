import React, { useState, useEffect, useCallback } from 'react'
import { KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL, CA_MEMBERS, STATUSES } from './constants'
import { loadAll, insertCandidate, saveCandidate, removeCandidate, subscribeToChanges, generateId } from './storage'
import { getAlert } from './alerts'
import Modal from './components/Modal'

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

export default function App() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
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

  const active = candidates.filter(c => !CLOSED_STATUSES.includes(c.status))
  const closed = candidates.filter(c => CLOSED_STATUSES.includes(c.status))
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

  if (loading) return <div style={center}>読み込み中...</div>
  if (error) return <div style={{ ...center, color: '#ef4444' }}>{error}</div>

  const caGroups = CA_MEMBERS.map(ca => {
    const caRows = active.filter(c => c.assignedCA === ca)
    const candidateMap = new Map()
    for (const c of caRows) {
      const key = c.candidateName || '（名前未設定）'
      if (!candidateMap.has(key)) candidateMap.set(key, [])
      candidateMap.get(key).push(c)
    }
    const uniqueCount = [...candidateMap.values()].filter(rows =>
      rows.some(r => UNIQUE_STATUSES.includes(r.status))
    ).length
    return { ca, candidateMap, uniqueCount }
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 30, height: 30, background: '#0f172a', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>宅</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.01em' }}>宅建Jobエージェント</span>
        <span style={{ color: '#e2e8f0' }}>|</span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>案件管理</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {alertCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '4px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>要注意 {alertCount}件</span>
            </div>
          )}
          <button
            onClick={() => setModal('new')}
            style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em' }}
          >
            + 候補者を追加
          </button>
        </div>
      </header>

      {/* ── Kanban summary strip ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 24px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {KANBAN_STATUSES.map(status => {
            const items = active.filter(c => c.status === status)
            const hasAlert = items.some(c => getAlert(c).isAlert)
            const ss = STATUS_STYLE[status]
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, border: '1px solid', borderColor: items.length > 0 ? ss.bg : '#f1f5f9', background: items.length > 0 ? ss.bg : '#fafafa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: items.length > 0 ? ss.color : '#cbd5e0', fontWeight: 500 }}>{STATUS_LABEL[status]}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: items.length > 0 ? ss.color : '#cbd5e0', lineHeight: 1 }}>{items.length}</span>
                {hasAlert && <span style={{ fontSize: 10, color: '#ef4444' }}>⚠</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── CA Sections ── */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {caGroups.map(({ ca, candidateMap, uniqueCount }) => {
          const theme = CA_THEME[ca] || { dot: '#64748b', headerBg: '#f8fafc', accent: '#64748b', badgeBg: '#f1f5f9', badgeColor: '#475569' }
          const totalApps = [...candidateMap.values()].reduce((s, r) => s + r.length, 0)

          return (
            <div key={ca} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>

              {/* Section header */}
              <div style={{ background: theme.headerBg, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e8edf2' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.dot, flexShrink: 0, boxShadow: `0 0 0 3px ${theme.dot}25` }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', letterSpacing: '-0.02em' }}>{ca}</span>
                <div style={{ background: theme.badgeBg, color: theme.badgeColor, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                  ユニーク {uniqueCount}件
                </div>
                {candidateMap.size > 0 && (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>
                    {candidateMap.size}名 · {totalApps}社
                  </span>
                )}
                <button
                  onClick={() => setModal({ _prefill: { assignedCA: ca } })}
                  style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px', background: '#fff', border: `1.5px solid ${theme.accent}`, borderRadius: 7, cursor: 'pointer', color: theme.accent, fontWeight: 700 }}
                >
                  + 追加
                </button>
              </div>

              {/* Table or empty state */}
              {candidateMap.size === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ color: '#cbd5e0', fontSize: 13, marginBottom: 10 }}>候補者なし</div>
                  <button
                    onClick={() => setModal({ _prefill: { assignedCA: ca } })}
                    style={{ fontSize: 12, padding: '6px 18px', background: 'transparent', border: '1.5px dashed #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }}
                  >+ 候補者を追加</button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>求職者</th>
                      <th style={th}>選考企業</th>
                      <th style={th}>ステータス</th>
                      <th style={th}>紹介料</th>
                      <th style={th}>面接日</th>
                      <th style={{ ...th, minWidth: 160 }}>次回アクション</th>
                      <th style={{ ...th, minWidth: 130 }}>メモ</th>
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
                          <tr
                            key={c.id}
                            style={{
                              borderBottom: isLast ? '1px solid #e8edf2' : '1px solid #f8fafc',
                              background: alert.isAlert ? '#fffbfb' : '#fff',
                            }}
                          >
                            {/* 求職者名 */}
                            <td style={{ ...td, minWidth: 130, borderLeft: `3px solid ${isFirst ? theme.accent : 'transparent'}`, paddingLeft: 14 }}>
                              {isFirst ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {alert.isAlert && (
                                    <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 9, cursor: 'help' }}>●</span>
                                  )}
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{name}</span>
                                  <button
                                    onClick={() => setModal({ _prefill: { candidateName: name, assignedCA: ca } })}
                                    style={{ fontSize: 10, padding: '1px 7px', background: theme.badgeBg, border: 'none', borderRadius: 20, cursor: 'pointer', color: theme.badgeColor, fontWeight: 700 }}
                                  >+企業</button>
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e0', fontSize: 12, paddingLeft: 10 }}>└</span>
                              )}
                            </td>
                            {/* 選考企業 */}
                            <td style={td}>
                              <input
                                value={c.company || ''}
                                onChange={e => handleInlineChange(c, 'company', e.target.value)}
                                onBlur={e => handleInlineChange(c, 'company', e.target.value)}
                                style={inputSt}
                                placeholder="企業名"
                              />
                            </td>
                            {/* ステータス */}
                            <td style={{ ...td, width: 130 }}>
                              <select
                                value={c.status}
                                onChange={e => handleInlineChange(c, 'status', e.target.value)}
                                style={{ ...inputSt, background: ss.bg, color: ss.color, fontWeight: 600, fontSize: 12, borderRadius: 20, paddingLeft: 10, paddingRight: 4, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                              >
                                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </td>
                            {/* 紹介料 */}
                            <td style={{ ...td, width: 90 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <input
                                  type="number"
                                  value={c.fee ?? ''}
                                  onChange={e => handleInlineChange(c, 'fee', e.target.value === '' ? null : Number(e.target.value))}
                                  style={{ ...inputSt, width: 60, textAlign: 'right' }}
                                  placeholder="0"
                                />
                                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>万</span>
                              </div>
                            </td>
                            {/* 面接日 */}
                            <td style={{ ...td, width: 130 }}>
                              <input
                                type="date"
                                value={c.interviewDate || ''}
                                onChange={e => handleInlineChange(c, 'interviewDate', e.target.value)}
                                style={inputSt}
                              />
                            </td>
                            {/* 次回アクション */}
                            <td style={td}>
                              <input
                                value={c.nextAction || ''}
                                onChange={e => handleInlineChange(c, 'nextAction', e.target.value)}
                                onBlur={e => handleInlineChange(c, 'nextAction', e.target.value)}
                                style={inputSt}
                                placeholder="—"
                              />
                            </td>
                            {/* メモ */}
                            <td style={td}>
                              <input
                                value={c.memo || ''}
                                onChange={e => handleInlineChange(c, 'memo', e.target.value)}
                                onBlur={e => handleInlineChange(c, 'memo', e.target.value)}
                                style={inputSt}
                                placeholder="—"
                              />
                            </td>
                            {/* 削除 */}
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button
                                onClick={() => handleDelete(c.id)}
                                title="削除"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 15, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
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
              )}
            </div>
          )
        })}

        {/* 落選・離脱 */}
        {closed.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setClosedOpen(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 10 }}>{closedOpen ? '▾' : '▸'}</span>
              落選・離脱 ({closed.length}件)
            </button>
            {closedOpen && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {closed.map(c => {
                      const ss = STATUS_STYLE[c.status] || STATUS_STYLE.withdrawn
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ ...td, color: '#64748b', fontWeight: 500, fontSize: 13 }}>{c.candidateName}</td>
                          <td style={{ ...td, color: '#94a3b8', fontSize: 13 }}>{c.company}</td>
                          <td style={td}>
                            <span style={{ background: ss.bg, color: ss.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                              {STATUS_LABEL[c.status]}
                            </span>
                          </td>
                          <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{c.assignedCA}</td>
                          <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{c.memo}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <button
                              onClick={() => handleDelete(c.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 15 }}
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

      {/* Modal */}
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

const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#64748b' }
const th = { padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }
const td = { padding: '8px 10px', verticalAlign: 'middle' }
const inputSt = { width: '100%', padding: '5px 8px', border: '1px solid transparent', borderRadius: 6, fontSize: 13, background: 'transparent', color: '#1e293b', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' }
