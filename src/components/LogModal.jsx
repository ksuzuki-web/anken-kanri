import React, { useState, useEffect } from 'react'
import { loadLogs, addLog, saveCandidate } from '../storage'

export default function LogModal({ candidate, type, suggestion, editable = true, onUpdate, onClose }) {
  const [logs, setLogs] = useState([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const isAction = type === 'action'
  const label = isAction ? '次回アクション' : 'メモ'
  const currentValue = isAction ? candidate.nextAction : candidate.memo

  useEffect(() => {
    loadLogs(candidate.id, type).then(setLogs).catch(() => {})
  }, [candidate.id, type])

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    try {
      if (currentValue?.trim()) {
        await addLog(candidate.id, type, currentValue)
      }
      const field = isAction ? 'nextAction' : 'memo'
      const updated = { ...candidate, [field]: text.trim(), updatedAt: new Date().toISOString() }
      await saveCandidate(updated)
      onUpdate(updated)
      setText('')
      const newLogs = await loadLogs(candidate.id, type)
      setLogs(newLogs)
    } catch (e) {
      alert('保存失敗: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function fmt(iso) {
    return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{label}の履歴</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>{candidate.candidateName} · {candidate.company}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* 現在の値 */}
        <div style={{ background: 'var(--surface-sub)', borderRadius: 8, padding: '10px 14px', marginTop: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.04em' }}>現在</div>
          <div style={{ fontSize: 13, color: currentValue ? 'var(--text-2)' : 'var(--muted-2)' }}>{currentValue || '未設定'}</div>
        </div>

        {!editable && (
          <div style={{ background: 'var(--surface-sub)', border: '1px dashed var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            🔒 {label}の入力は管理者のみが行えます。履歴の閲覧は可能です。
          </div>
        )}

        {/* AI提案 */}
        {editable && isAction && suggestion && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, marginBottom: 2 }}>おすすめの次回アクション</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{suggestion}</div>
            </div>
            <button onClick={() => setText(suggestion)} style={{ flexShrink: 0, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>使う</button>
          </div>
        )}

        {/* 新規入力 */}
        {editable && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>新しい{label}を記録</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder={`${label}を入力...`}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)', lineHeight: 1.5 }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: text.trim() && !saving ? 'pointer' : 'not-allowed', opacity: text.trim() && !saving ? 1 : 0.4 }}
            >
              {saving ? '保存中...' : '記録する'}
            </button>
          </div>
        </div>
        )}

        {/* 履歴 */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>履歴</div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '16px 0' }}>まだ履歴がありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {logs.map(log => (
                <div key={log.id} style={{ background: 'var(--surface-sub)', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 4 }}>{log.content}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{fmt(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .18s ease' }
