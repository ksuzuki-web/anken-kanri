import React from 'react'
import { STATUS_LABEL } from '../constants'
import { getAlert, getInconsistencies } from '../alerts'
import { suggestNextAction } from '../suggestions'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'お疲れさまです'
  if (h < 11) return 'おはようございます'
  if (h < 18) return 'お疲れさまです'
  return 'お疲れさまです'
}

export default function DigestModal({ candidates, todoPending, onOpenCandidate, onClose }) {
  const today = localToday()
  const interviews = candidates.filter(c => c.interviewDate === today)
  const alerts = candidates.filter(c => getAlert(c).isAlert)
  const issues = candidates.map(c => ({ c, list: getInconsistencies(c) })).filter(x => x.list.length > 0)
  const suggestions = [...alerts]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 5)
    .map(c => ({ c, text: suggestNextAction(c) }))
    .filter(x => x.text)

  const dateLabel = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>☀️ {greeting()}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>{dateLabel} の「今日やること」</div>
          </div>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        {/* サマリーチップ */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 8px' }}>
          <Chip n={interviews.length} label="本日の面接" color="#0ea5e9" />
          <Chip n={alerts.length} label="要対応" color="#ef4444" />
          <Chip n={issues.length} label="入力の矛盾" color="#f59e0b" />
          <Chip n={todoPending.length} label="未完了TODO" color="#8b5cf6" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto', marginTop: 6 }}>
          <Section icon="📅" title="本日の面接" count={interviews.length} empty="本日の面接はありません">
            {interviews.map(c => (
              <Row key={c.id} onClick={() => onOpenCandidate(c)}>
                <b>{c.candidateName}</b>
                <span style={sub}>{c.company} · {STATUS_LABEL[c.status]}</span>
              </Row>
            ))}
          </Section>

          <Section icon="🔴" title="停滞・要対応" count={alerts.length} empty="停滞中の案件はありません">
            {alerts.slice(0, 8).map(c => (
              <Row key={c.id} onClick={() => onOpenCandidate(c)}>
                <b>{c.candidateName}</b>
                <span style={sub}>{c.company} · {getAlert(c).reasons[0]}</span>
              </Row>
            ))}
            {alerts.length > 8 && <More n={alerts.length - 8} />}
          </Section>

          <Section icon="⚠️" title="入力の矛盾・抜け" count={issues.length} empty="矛盾は見つかりませんでした">
            {issues.slice(0, 8).map(({ c, list }) => (
              <Row key={c.id} onClick={() => onOpenCandidate(c)}>
                <b>{c.candidateName}</b>
                <span style={sub}>{c.company} · {list[0]}</span>
              </Row>
            ))}
            {issues.length > 8 && <More n={issues.length - 8} />}
          </Section>

          {suggestions.length > 0 && (
            <Section icon="💡" title="おすすめアクション" count={suggestions.length} empty="">
              {suggestions.map(({ c, text }) => (
                <Row key={c.id} onClick={() => onOpenCandidate(c)}>
                  <b>{c.candidateName}</b>
                  <span style={sub}>{text}</span>
                </Row>
              ))}
            </Section>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            今日も頑張る 💪
          </button>
        </div>
      </div>
    </div>
  )
}

function Chip({ n, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}1a`, borderRadius: 20, padding: '5px 12px' }}>
      <span style={{ fontSize: 16, fontWeight: 800, color }}>{n}</span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function Section({ icon, title, count, empty, children }) {
  const isEmpty = !children || (Array.isArray(children) && children.flat().filter(Boolean).length === 0)
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 7 }}>{icon} {title} <span style={{ color: 'var(--muted-2)', fontWeight: 600 }}>({count})</span></div>
      {isEmpty
        ? <div style={{ fontSize: 12, color: 'var(--faint)', paddingLeft: 4 }}>{empty}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>}
    </div>
  )
}

function Row({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: 'var(--surface-sub)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, color: 'var(--text)' }}>
      {children}
    </button>
  )
}

function More({ n }) {
  return <div style={{ fontSize: 11, color: 'var(--muted-2)', paddingLeft: 4 }}>他 {n} 件</div>
}

const sub = { fontSize: 11, color: 'var(--muted)' }
const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .2s ease' }
const xBtn = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1, padding: 0 }
