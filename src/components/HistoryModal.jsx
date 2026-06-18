import React, { useState, useEffect } from 'react'
import { loadRecentChanges } from '../storage'

const FIELD_LABEL = {
  status: 'ステータス', company: '企業名', fee: '紹介料', interviewDate: '面接日',
  priority: '注力度', winCandidate: '成約候補', nextAction: '次回アクション', memo: 'メモ',
  assignedCA: '担当CA', candidateName: '氏名', create: '新規登録', delete: '削除',
}

function fmt(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function HistoryModal({ onClose }) {
  const [logs, setLogs] = useState(null)

  useEffect(() => { loadRecentChanges(150).then(setLogs).catch(() => setLogs([])) }, [])

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>🕐 変更履歴</div>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 14 }}>誰がいつ何を変更したかの記録（新しい順・最大150件）</div>

        {logs === null ? (
          <div style={{ textAlign: 'center', color: 'var(--muted-2)', padding: '24px 0', fontSize: 13 }}>読み込み中...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--faint)', padding: '24px 0', fontSize: 13 }}>まだ変更履歴がありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '62vh', overflowY: 'auto' }}>
            {logs.map(l => {
              const fl = FIELD_LABEL[l.field] || l.field
              const isCreate = l.field === 'create'
              const isDelete = l.field === 'delete'
              return (
                <div key={l.id} style={{ background: 'var(--surface-sub)', borderRadius: 8, padding: '9px 12px', borderLeft: `3px solid ${isDelete ? '#ef4444' : isCreate ? '#22c55e' : 'var(--border)'}` }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text)' }}>{l.candidateName || '（名称未設定）'}</b>
                    {isCreate ? <span> を新規登録</span>
                      : isDelete ? <span> を削除</span>
                      : (
                        <span> の<b>{fl}</b>を
                          {l.oldValue ? <span style={{ color: 'var(--muted)' }}> 「{l.oldValue}」</span> : ''}
                          <span style={{ color: 'var(--muted)' }}>→</span>
                          <b style={{ color: 'var(--text)' }}>「{l.newValue || '空'}」</b>
                        </span>
                      )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 3 }}>
                    <span style={{ fontWeight: 600 }}>{l.changedBy}</span> ・ {fmt(l.createdAt)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(2px)' }
const dialog = { background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', padding: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .18s ease' }
const xBtn = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1, padding: 0 }
