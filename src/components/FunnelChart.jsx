import React from 'react'
import { KANBAN_STATUSES, CLOSED_STATUSES, STATUS_LABEL, LOSS_POINT_LABEL } from '../constants'

const STAGE_COLOR = {
  lead: '#94a3b8', screening: '#3b82f6', interview1: '#0ea5e9',
  interview2: '#8b5cf6', interviewFinal: '#d946ef', offer: '#22c55e', won: '#047857',
}

export default function FunnelChart({ candidates }) {
  // パイプライン（現在の選考中・件数=応募ベース）
  const stages = KANBAN_STATUSES.map(s => ({
    key: s, label: STATUS_LABEL[s], count: candidates.filter(c => c.status === s).length, color: STAGE_COLOR[s],
  }))
  const maxStage = Math.max(...stages.map(s => s.count), 1)
  const activeTotal = stages.reduce((a, s) => a + s.count, 0)

  // 失注の内訳
  const losses = CLOSED_STATUSES.map(s => ({
    key: s, label: LOSS_POINT_LABEL[s] || STATUS_LABEL[s], count: candidates.filter(c => c.status === s).length,
  }))
  const lossTotal = losses.reduce((a, l) => a + l.count, 0)
  const maxLoss = Math.max(...losses.map(l => l.count), 0)
  const topLoss = maxLoss > 0 ? losses.find(l => l.count === maxLoss) : null

  return (
    <div style={card}>
      <div style={titleRow}>
        <span style={cardTitle}>選考ファネル</span>
        <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>選考中 {activeTotal}・失注 {lossTotal}</span>
      </div>

      {/* パイプライン */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {stages.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', width: 52, flexShrink: 0, textAlign: 'right' }}>{s.label}</span>
            <div style={{ flex: 1, height: 16, background: 'var(--surface-hover)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.max((s.count / maxStage) * 100, s.count > 0 ? 14 : 0)}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width .3s' }} />
              <span style={{ position: 'absolute', right: 5, top: 0, lineHeight: '16px', fontSize: 10, fontWeight: 700, color: s.count > 0 ? 'var(--text)' : 'var(--faint)' }}>{s.count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 失注の内訳 */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 6 }}>失注の内訳</div>
        {lossTotal === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', padding: '4px 0' }}>まだありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {losses.map(l => {
              const isTop = topLoss && l.key === topLoss.key && l.count > 0
              return (
                <div key={l.key} style={{ display: 'flex', alignItems: 'center', fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: isTop ? '#ef4444' : 'var(--faint)', marginRight: 6, flexShrink: 0 }} />
                  <span style={{ color: isTop ? '#ef4444' : 'var(--muted)', fontWeight: isTop ? 700 : 500 }}>{l.label}</span>
                  <span style={{ marginLeft: 'auto', color: isTop ? '#ef4444' : 'var(--text-3)', fontWeight: l.count > 0 ? 700 : 400 }}>{l.count}</span>
                </div>
              )
            })}
          </div>
        )}
        {topLoss && (
          <div style={{ marginTop: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#ef4444', lineHeight: 1.4 }}>
            最も多い失注ポイントは<b>「{topLoss.label}」({topLoss.count}件)</b>。ここの改善が伸びしろです。
          </div>
        )}
      </div>
    </div>
  )
}

const card = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-card)', padding: '14px 16px', boxShadow: 'var(--card-shadow)' }
const titleRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }
const cardTitle = { fontWeight: 700, fontSize: 13, color: 'var(--text)', letterSpacing: '-0.01em' }
