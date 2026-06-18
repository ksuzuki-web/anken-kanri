import React, { useState } from 'react'
import { KANBAN_STATUSES, STATUS_LABEL } from '../constants'

const STATUS_ACCENT = {
  lead: '#94a3b8', screening: '#3b82f6', interview1: '#0ea5e9',
  interview2: '#8b5cf6', interviewFinal: '#d946ef', offer: '#22c55e', won: '#047857',
}
const PRI_COLOR = { 5: '#ef4444', 4: '#f97316', 3: '#f59e0b', 2: '#84cc16', 1: '#94a3b8' }

export default function BoardView({ candidates, onStatusChange, onOpenCandidate, caColorOf, getAlert }) {
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  function handleDrop(status) {
    const c = candidates.find(x => x.id === draggingId)
    setOverCol(null)
    setDraggingId(null)
    if (c && c.status !== status) onStatusChange(c, status)
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {KANBAN_STATUSES.map(status => {
        const items = candidates.filter(c => c.status === status)
        const accent = STATUS_ACCENT[status]
        const isOver = overCol === status
        return (
          <div
            key={status}
            className={isOver ? 'col-dragover' : ''}
            onDragOver={e => { e.preventDefault(); if (overCol !== status) setOverCol(status) }}
            onDragLeave={e => { if (e.currentTarget === e.target) setOverCol(null) }}
            onDrop={() => handleDrop(status)}
            style={{ width: 224, flexShrink: 0, background: 'var(--surface-sub)', borderRadius: 12, border: '1px solid var(--border-card)', maxHeight: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', gap: 7, position: 'sticky', top: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{STATUS_LABEL[status]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: items.length ? accent : 'var(--faint)' }}>{items.length}</span>
            </div>

            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {items.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>ここにドラッグ</div>
              )}
              {items.map(c => {
                const alert = getAlert(c)
                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggingId(c.id)}
                    onDragEnd={() => { setDraggingId(null); setOverCol(null) }}
                    onClick={() => onOpenCandidate(c)}
                    className={draggingId === c.id ? 'card-dragging' : ''}
                    style={{ background: 'var(--surface)', borderRadius: 9, border: '1px solid var(--border)', borderLeft: `3px solid ${caColorOf(c.assignedCA)}`, padding: '9px 10px', cursor: 'grab', boxShadow: 'var(--card-shadow)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      {alert.isAlert && <span title={alert.reasons.join(' / ')} style={{ color: '#ef4444', fontSize: 8 }}>●</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.candidateName || '（未設定）'}</span>
                      {c.winCandidate && <span title="成約候補" style={{ marginLeft: 'auto', color: '#16a34a', fontSize: 11 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || '企業未設定'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span style={{ fontSize: 9, color: caColorOf(c.assignedCA), fontWeight: 700 }}>{c.assignedCA}</span>
                      {c.priority > 0 && <span style={{ fontSize: 9, color: PRI_COLOR[c.priority], letterSpacing: -1 }}>{'★'.repeat(c.priority)}</span>}
                      {c.fee != null && c.fee !== '' && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-2)' }}>{c.fee}万</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
