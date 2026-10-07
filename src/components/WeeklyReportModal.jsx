import React, { useState, useMemo, useEffect } from 'react'
import { CA_MEMBERS } from '../constants'
import { buildWeeklyReport, weekRange } from '../report'

// 週次レポート：チャットやメールにそのまま貼れる週報を自動生成
export default function WeeklyReportModal({ candidates, history, fc, targets, diagnosis, defaultCa = 'all', onClose }) {
  const [ca, setCa] = useState(defaultCa)
  const [week, setWeek] = useState(0)
  const generated = useMemo(
    () => buildWeeklyReport({ candidates, history, fc, targets, diagnosis, ca, offsetWeeks: week, today: fc.today }),
    [candidates, history, fc, targets, diagnosis, ca, week],
  )
  const [text, setText] = useState(generated)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setText(generated); setCopied(false) }, [generated])

  const { start, end } = weekRange(fc.today, week)
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`

  async function copy() {
    try { await navigator.clipboard.writeText(text) }
    catch (_) {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const subject = `週次報告 ${fmt(start)}〜${fmt(end)}（${ca === 'all' ? 'ユニット' : ca}）`
  const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>📝 週次レポート</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>数字・動き・来週の注力を自動でまとめました。編集してからコピーできます。</div>
          </div>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Seg value={week} onChange={setWeek} options={[[0, '今週'], [-1, '先週']]} />
          <Seg value={ca} onChange={setCa} options={[['all', '全体'], ...CA_MEMBERS.map(m => [m, m])]} />
          <span style={{ alignSelf: 'center', fontSize: 11.5, color: 'var(--muted-2)' }}>{fmt(start)}〜{fmt(end)}</span>
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)} rows={20}
          style={{ width: '100%', marginTop: 12, padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface-sub)' }} />

        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <a href={mailUrl} style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>✉️ メールで開く</a>
          <button onClick={copy} className="btn-primary" style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: copied ? 'var(--good)' : 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', minWidth: 132 }}>
            {copied ? '✓ コピーしました' : '📋 コピー'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Seg({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-hover)', borderRadius: 8, padding: 3, flexWrap: 'wrap' }}>
      {options.map(([v, label]) => (
        <button key={String(v)} onClick={() => onChange(v)} style={{ border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: value === v ? 'var(--surface)' : 'transparent', color: value === v ? 'var(--text)' : 'var(--muted)', boxShadow: value === v ? 'var(--card-shadow)' : 'none' }}>{label}</button>
      ))}
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', padding: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .18s ease' }
const xBtn = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1, padding: 0 }
