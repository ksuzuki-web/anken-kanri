import React, { useState, useEffect } from 'react'
import { CA_MEMBERS, STATUSES } from '../constants'

const EMPTY = {
  candidateName: '',
  company: '',
  assignedCA: CA_MEMBERS[0],
  fee: '',
  status: 'lead',
  interviewDate: '',
  memo: '',
  nextAction: '',
}

function now() {
  return new Date().toISOString()
}

export default function Modal({ candidate, prefill, saving, lockCA, lockNextAction, onSave, onDelete, onClose }) {
  const isNew = !candidate
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (candidate) {
      setForm({
        candidateName: candidate.candidateName || '',
        company:       candidate.company || '',
        assignedCA:    candidate.assignedCA || CA_MEMBERS[0],
        fee:           candidate.fee ?? '',
        status:        candidate.status || 'lead',
        interviewDate: candidate.interviewDate || '',
        memo:          candidate.memo || '',
        nextAction:    candidate.nextAction || '',
      })
    } else if (prefill) {
      setForm({ ...EMPTY, ...prefill })
    } else {
      setForm(EMPTY)
    }
  }, [candidate, prefill])

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  function handleSave() {
    if (!form.candidateName.trim()) { alert('候補者名を入力してください'); return }
    if (!form.company.trim()) { alert('企業名を入力してください'); return }
    const statusChanged = !isNew && candidate.status !== form.status
    const record = {
      ...(candidate || {}),
      ...form,
      statusChangedAt: (isNew || statusChanged) ? now() : (candidate?.statusChangedAt || now()),
      updatedAt: now(),
    }
    onSave(record)
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{isNew ? '候補者を追加' : '候補者を編集'}</h2>
          <button onClick={onClose} style={iconBtn}>×</button>
        </div>

        <Row>
          <Label text="求職者名">
            <input value={form.candidateName} onChange={e => set('candidateName', e.target.value)} style={inp} placeholder="山田 太郎" />
          </Label>
          <Label text="担当CA">
            {lockCA ? (
              <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-sub)', color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{form.assignedCA}</span>
                <span style={{ fontSize: 11 }}>🔒 自分の担当に固定</span>
              </div>
            ) : (
              <select value={form.assignedCA} onChange={e => set('assignedCA', e.target.value)} style={inp}>
                {CA_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </Label>
        </Row>

        <Row>
          <Label text="選考企業">
            <input value={form.company} onChange={e => set('company', e.target.value)} style={inp} placeholder="株式会社〇〇" />
          </Label>
          <Label text="紹介料（万円）">
            <input type="number" value={form.fee} onChange={e => set('fee', e.target.value)} style={inp} placeholder="50" />
          </Label>
        </Row>

        <Row>
          <Label text="ステータス">
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Label>
          <Label text="面接日">
            <input type="date" value={form.interviewDate} onChange={e => set('interviewDate', e.target.value)} style={inp} />
          </Label>
        </Row>

        <Label text="次回アクション">
          {lockNextAction ? (
            <div style={{ ...inp, display: 'flex', alignItems: 'center', background: 'var(--surface-sub)', color: 'var(--muted)', fontSize: 12 }}>🔒 次回アクションの入力は管理者のみ</div>
          ) : (
            <input value={form.nextAction} onChange={e => set('nextAction', e.target.value)} style={inp} placeholder="例：金曜までに面接日程を確定する" />
          )}
        </Label>

        <Label text="メモ">
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </Label>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {!isNew
            ? <button onClick={() => onDelete(candidate.id)} style={{ ...btn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }} disabled={saving}>削除</button>
            : <span />
          }
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btn} disabled={saving}>キャンセル</button>
            <button onClick={handleSave} style={{ ...btn, background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)', fontWeight: 700 }} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ text, children }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{text}</div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(2px)' }
const dialog  = { background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'pop-in .18s ease' }
const inp     = { width: '100%', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', color: 'var(--text)', background: 'var(--surface)', outline: 'none' }
const btn     = { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted-2)', lineHeight: 1 }
