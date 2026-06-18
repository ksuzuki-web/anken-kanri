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

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Modal({ candidate, prefill, saving, onSave, onDelete, onClose }) {
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
      statusChangedAt: (isNew || statusChanged) ? today() : (candidate?.statusChangedAt || today()),
      updatedAt: today(),
    }
    onSave(record)
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2d3748' }}>{isNew ? '候補者を追加' : '候補者を編集'}</h2>
          <button onClick={onClose} style={iconBtn}>×</button>
        </div>

        <Row>
          <Label text="求職者名">
            <input value={form.candidateName} onChange={e => set('candidateName', e.target.value)} style={inp} placeholder="山田 太郎" />
          </Label>
          <Label text="担当CA">
            <select value={form.assignedCA} onChange={e => set('assignedCA', e.target.value)} style={inp}>
              {CA_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
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
          <input value={form.nextAction} onChange={e => set('nextAction', e.target.value)} style={inp} placeholder="例：金曜までに面接日程を確定する" />
        </Label>

        <Label text="メモ">
          <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </Label>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {!isNew
            ? <button onClick={() => onDelete(candidate.id)} style={{ ...btn, color: '#e53e3e', borderColor: '#feb2b2' }} disabled={saving}>削除</button>
            : <span />
          }
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btn} disabled={saving}>キャンセル</button>
            <button onClick={handleSave} style={{ ...btn, background: '#2d3748', color: '#fff', borderColor: '#2d3748' }} disabled={saving}>
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
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>{text}</div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }
const dialog  = { background: '#fff', borderRadius: 8, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24 }
const inp     = { width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13, boxSizing: 'border-box', color: '#2d3748' }
const btn     = { padding: '7px 16px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }
const iconBtn = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#a0aec0', lineHeight: 1 }
