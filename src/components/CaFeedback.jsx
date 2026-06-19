import React, { useState } from 'react'
import { generateCaFeedback } from '../analysis'

const CAT_COLOR = { '求職者マター': '#0ea5e9', '案件作り': '#8b5cf6', '成果最大化': '#16a34a' }

export default function CaFeedback({ ca, candidates }) {
  const [open, setOpen] = useState(true)
  const fb = generateCaFeedback(ca, candidates)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent)', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 15 }}>📋</span>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{ca}さんの状況分析</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: fb.ratingColor, background: `color-mix(in srgb, ${fb.ratingColor} 16%, transparent)`, borderRadius: 20, padding: '2px 11px' }}>{fb.rating}</span>
        {fb.provisional && <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>自動生成（仮）</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--muted-2)', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={{ padding: '4px 18px 18px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '8px 0 16px' }}>{fb.summary}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Block title="👍 良いポイント" color="#16a34a" items={fb.goods} />
            <Block title="🔧 改善ポイント" color="#f59e0b" items={fb.improves} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>🎯 今後優先すべきアクション</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {fb.actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'var(--surface-sub)', borderRadius: 9, padding: '9px 12px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted-2)', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: CAT_COLOR[a.cat] || 'var(--muted)', background: `color-mix(in srgb, ${CAT_COLOR[a.cat] || '#64748b'} 14%, transparent)`, borderRadius: 5, padding: '1px 7px', marginRight: 7 }}>{a.cat}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{a.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {fb.provisional && (
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted-2)', lineHeight: 1.5, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              ※ この内容は現在の案件データから自動生成した暫定版です。今後、別途の成果分析データを取り込むことで、より精度の高いフィードバックに進化させられます。
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Block({ title, color, items }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 7 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((t, i) => (
          <li key={i} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
            <span style={{ color, flexShrink: 0 }}>•</span><span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
