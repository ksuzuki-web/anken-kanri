import React, { useState } from 'react'
import { STATUS_MAP } from '../constants'

export default function ClosedSection({ candidates, onCardClick }) {
  const [open, setOpen] = useState(false)

  if (candidates.length === 0) return null

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          padding: 0,
        }}
      >
        {open ? '▾' : '▸'} 完了済み（落選・離脱） {candidates.length}件
      </button>

      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '8px',
            marginTop: '10px',
          }}
        >
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onCardClick(c)}
              style={{
                textAlign: 'left',
                background: 'var(--closed-bg)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.candidateName}</div>
              <div style={{ fontSize: '11px', color: 'var(--closed-text)' }}>
                {c.company} ・ {STATUS_MAP[c.status]?.label}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
