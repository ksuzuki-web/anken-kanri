import React, { useState, useMemo, useEffect } from 'react'
import { STATUS_LABEL } from '../constants'
import { buildMessages, messageText, splitSubject, countPlaceholders } from '../messages'

// 連絡文ジェネレーター：案件の状況に合った文面を選んで、編集→コピー／LINE／メールで送る
export default function MessageComposer({ candidate, sender, onClose }) {
  const messages = useMemo(() => buildMessages(candidate, { sender }), [candidate, sender])
  const [selId, setSelId] = useState(messages[0]?.id)
  const sel = messages.find(m => m.id === selId) || messages[0]
  const [text, setText] = useState(sel ? messageText(sel) : '')
  const [copied, setCopied] = useState(false)
  const [showRef, setShowRef] = useState(false)

  useEffect(() => { if (sel) setText(messageText(sel)); setCopied(false) }, [selId]) // eslint-disable-line react-hooks/exhaustive-deps

  const placeholders = countPlaceholders(text)
  const isCompany = sel?.audience === 'company'

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch (_) {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`
  const { subject, body } = splitSubject(text)
  const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const groups = [
    { key: 'candidate', label: '求職者へ（LINE・メール）', items: messages.filter(m => m.audience === 'candidate') },
    { key: 'company', label: '企業へ（メール）', items: messages.filter(m => m.audience === 'company') },
  ].filter(g => g.items.length)

  const hasRef = (candidate.memo || '').trim() || (candidate.nextAction || '').trim()

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>💬 連絡文をつくる</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>{candidate.candidateName} · {candidate.company || '企業未設定'} · {STATUS_LABEL[candidate.status]}</div>
          </div>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        {groups.map(g => (
          <div key={g.key} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{g.label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {g.items.map(m => {
                const active = m.id === sel?.id
                return (
                  <button key={m.id} onClick={() => setSelId(m.id)} className="pill-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)', color: active ? 'var(--text)' : 'var(--text-3)' }}>
                    {m.recommended && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)', borderRadius: 8, padding: '0 6px', lineHeight: '16px' }}>おすすめ</span>}
                    {m.title}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <textarea value={text} onChange={e => setText(e.target.value)} rows={14}
          style={{ width: '100%', marginTop: 14, padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13.5, lineHeight: 1.65, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface-sub)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, minHeight: 18 }}>
          {placeholders > 0
            ? <span style={{ fontSize: 11.5, color: 'var(--warn)', fontWeight: 700 }}>✎ 【 】の部分が{placeholders}か所あります。埋めてから送ってください</span>
            : <span style={{ fontSize: 11.5, color: 'var(--good)', fontWeight: 700 }}>✓ そのまま送れる状態です</span>}
        </div>

        {hasRef && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowRef(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>{showRef ? '▾' : '▸'} 参考：この案件のメモ・次回アクション</button>
            {showRef && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-sub)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
                {candidate.memo && <div><b>メモ：</b>{candidate.memo}</div>}
                {candidate.nextAction && <div><b>次回：</b>{candidate.nextAction}</div>}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isCompany
            ? <a href={mailUrl} style={{ ...ghostBtn, textDecoration: 'none' }}>✉️ メールで開く</a>
            : <a href={lineUrl} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none', color: '#06c755', borderColor: 'color-mix(in srgb, #06c755 45%, var(--border))' }}>LINEで送る</a>}
          <button onClick={copy} className="btn-primary" style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: copied ? 'var(--good)' : 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', minWidth: 132 }}>
            {copied ? '✓ コピーしました' : '📋 コピー'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', padding: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .18s ease' }
const xBtn = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1, padding: 0 }
const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
