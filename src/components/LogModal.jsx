import React, { useState, useEffect } from 'react'
import { loadLogs, addLog, saveCandidate } from '../storage'

export default function LogModal({ candidate, type, onUpdate, onClose }) {
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
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{label}の履歴</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{candidate.candidateName} · {candidate.company}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* 現在の値 */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginTop: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>現在</div>
          <div style={{ fontSize: 13, color: currentValue ? '#1e293b' : '#94a3b8' }}>{currentValue || '未設定'}</div>
        </div>

        {/* 新規入力 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>新しい{label}を記録</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder={`${label}を入力...`}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: '#1e293b', lineHeight: 1.5 }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0f172a' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: text.trim() && !saving ? 'pointer' : 'not-allowed', opacity: text.trim() && !saving ? 1 : 0.4 }}
            >
              {saving ? '保存中...' : '記録する'}
            </button>
          </div>
        </div>

        {/* 履歴 */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>履歴</div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#cbd5e0', fontSize: 13, padding: '16px 0' }}>まだ履歴がありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {logs.map(log => (
                <div key={log.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 4 }}>{log.content}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmt(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(15,23,42,0.18)' }
