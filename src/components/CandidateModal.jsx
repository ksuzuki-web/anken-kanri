import React, { useState, useEffect } from 'react'
import { STATUSES, CA_MEMBERS } from '../constants'
import { evaluateAlert } from '../alerts'

const EMPTY_FORM = {
  candidateName: '',
  company: '',
  assignedCA: CA_MEMBERS[0],
  fee: '',
  status: 'lead',
  interviewDate: '',
  memo: '',
  nextAction: '',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function CandidateModal({ candidate, onSave, onDelete, onClose }) {
  const isNew = !candidate
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (candidate) {
      setForm({
        candidateName: candidate.candidateName || '',
        company: candidate.company || '',
        assignedCA: candidate.assignedCA || CA_MEMBERS[0],
        fee: candidate.fee || '',
        status: candidate.status || 'lead',
        interviewDate: candidate.interviewDate || '',
        memo: candidate.memo || '',
        nextAction: candidate.nextAction || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [candidate])

  const alert = candidate ? evaluateAlert(candidate) : null

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    if (!form.candidateName.trim()) {
      window.alert('候補者名を入力してください')
      return
    }

    const statusChanged = candidate && candidate.status !== form.status
    const next = {
      ...(candidate || {}),
      ...form,
      // ステータスが変わった場合、またはこのレコードがそもそも新規の場合は変更日を更新する
      statusChangedAt:
        isNew || statusChanged ? todayStr() : candidate.statusChangedAt || todayStr(),
      updatedAt: todayStr(),
    }
    onSave(next, isNew)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 31, 61, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--navy-900)' }}>
            {isNew ? '候補者を追加' : '候補者を編集'}
          </h2>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            ×
          </button>
        </div>

        {alert && alert.isAlert && (
          <div
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              fontSize: '12px',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              marginBottom: '14px',
            }}
          >
            {alert.reasons.join(' / ')}
          </div>
        )}

        <Field label="候補者名">
          <input
            type="text"
            value={form.candidateName}
            onChange={(e) => handleChange('candidateName', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="選考企業">
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Field label="担当CA" style={{ flex: 1 }}>
            <select value={form.assignedCA} onChange={(e) => handleChange('assignedCA', e.target.value)} style={inputStyle}>
              {CA_MEMBERS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="紹介料（万円）" style={{ flex: 1 }}>
            <input
              type="number"
              value={form.fee}
              onChange={(e) => handleChange('fee', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="ステータス">
          <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="面接日">
          <input
            type="date"
            value={form.interviewDate}
            onChange={(e) => handleChange('interviewDate', e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="次回アクション">
          <input
            type="text"
            value={form.nextAction}
            onChange={(e) => handleChange('nextAction', e.target.value)}
            placeholder="例：金曜までに面接日程を確定する"
            style={inputStyle}
          />
        </Field>

        <Field label="メモ">
          <textarea
            value={form.memo}
            onChange={(e) => handleChange('memo', e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {!isNew && candidate?.statusChangedAt && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '14px' }}>
            ステータス最終変更日: {candidate.statusChangedAt}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {!isNew ? (
            <button
              onClick={() => {
                if (window.confirm('この候補者を削除しますか？')) onDelete(candidate.id)
              }}
              style={{ ...btnStyle, color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
            >
              削除
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={btnStyle}>
              キャンセル
            </button>
            <button
              onClick={handleSave}
              style={{ ...btnStyle, background: 'var(--navy-800)', color: '#fff', borderColor: 'var(--navy-800)' }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: '12px', ...style }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px',
  background: '#fff',
  color: 'var(--text-primary)',
}

const btnStyle = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: '#fff',
  fontSize: '13px',
  cursor: 'pointer',
}
