import React from 'react'
import CandidateCard from './CandidateCard'
import { evaluateAlert } from '../alerts'

export default function KanbanColumn({ statusKey, label, candidates, onCardClick }) {
  const alertCount = candidates.filter((c) => evaluateAlert(c).isAlert).length

  return (
    <div
      style={{
        minWidth: '220px',
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 4px',
          borderBottom: '2px solid var(--navy-700)',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy-800)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {alertCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--danger-text)',
                background: 'var(--danger-bg)',
                borderRadius: '10px',
                padding: '1px 6px',
              }}
            >
              {alertCount}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{candidates.length}</span>
        </div>
      </div>

      <div style={{ overflowY: 'auto', paddingRight: '2px', flex: 1 }}>
        {candidates.length === 0 ? (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              padding: '24px 8px',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            候補者なし
          </div>
        ) : (
          candidates.map((c) => <CandidateCard key={c.id} candidate={c} onClick={onCardClick} />)
        )}
      </div>
    </div>
  )
}
