import React from 'react'
import { evaluateAlert } from '../alerts'

function formatDate(dateStr) {
  if (!dateStr) return '未設定'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '未設定'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatFee(fee) {
  if (!fee) return '—'
  const n = Number(fee)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString()}万`
}

export default function CandidateCard({ candidate, onClick }) {
  const alert = evaluateAlert(candidate)

  return (
    <button
      onClick={() => onClick(candidate)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--bg-card)',
        border: alert.isAlert ? '1.5px solid var(--danger-border)' : '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginBottom: '8px',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {alert.isAlert && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--danger-strong)',
          }}
          title={alert.reasons.join(' / ')}
        />
      )}

      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px', paddingRight: '16px' }}>
        {candidate.candidateName || '（氏名未入力）'}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {candidate.company || '企業未設定'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
        <span>担当: {candidate.assignedCA || '未割当'}</span>
        <span>紹介料: {formatFee(candidate.fee)}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
        <span>面接: {formatDate(candidate.interviewDate)}</span>
        {alert.daysSinceStatusChange !== null && (
          <span style={{ color: alert.isStalled ? 'var(--danger-text)' : 'var(--text-tertiary)' }}>
            {alert.daysSinceStatusChange}日経過
          </span>
        )}
      </div>

      {alert.isAlert && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--danger-text)',
            background: 'var(--danger-bg)',
            borderRadius: '4px',
            padding: '4px 6px',
          }}
        >
          {alert.reasons.join(' / ')}
        </div>
      )}
    </button>
  )
}
