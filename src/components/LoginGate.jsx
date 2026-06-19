import React, { useState } from 'react'
import { CA_MEMBERS, ADMIN_CA, ADMIN_PASSCODE } from '../constants'

const CA_COLOR = { [CA_MEMBERS[0]]: '#3b82f6', [CA_MEMBERS[1]]: '#10b981', [CA_MEMBERS[2]]: '#8b5cf6' }

export default function LoginGate({ onSelect }) {
  const [pwUser, setPwUser] = useState(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  function pick(ca) {
    if (ca === ADMIN_CA) { setPwUser(ca); setPw(''); setErr(false) }
    else onSelect(ca)
  }
  function submit() {
    if (pw === ADMIN_PASSCODE) onSelect(pwUser)
    else { setErr(true); setPw('') }
  }

  return (
    <div style={overlay}>
      <div style={dialog} className="pop-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, var(--accent), var(--primary))', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.28)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>宅</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>操作する担当者を選択</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 1 }}>選んだ担当者として記録されます</div>
          </div>
        </div>

        {!pwUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {CA_MEMBERS.map(m => {
              const isAdmin = m === ADMIN_CA
              const color = CA_COLOR[m] || '#64748b'
              return (
                <button key={m} className="pill-btn" onClick={() => pick(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{m[0]}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{m}</span>
                  {isAdmin && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', borderRadius: 20, padding: '3px 10px' }}>🔑 管理者</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8 }}>🔑 {pwUser}（管理者）のパスコード（4桁）</div>
            <input
              type="password" inputMode="numeric" maxLength={4} autoFocus value={pw}
              onChange={e => { setPw(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(false) }}
              onKeyDown={e => { if (e.key === 'Enter' && pw.length === 4) submit() }}
              placeholder="••••"
              style={{ width: '100%', padding: '12px 14px', fontSize: 22, letterSpacing: '0.5em', textAlign: 'center', border: `1.5px solid ${err ? '#ef4444' : 'var(--border)'}`, borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
            {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>パスコードが違います</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => { setPwUser(null); setErr(false) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>戻る</button>
              <button onClick={submit} disabled={pw.length < 4} className="btn-primary" style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', fontSize: 13, fontWeight: 700, cursor: pw.length < 4 ? 'not-allowed' : 'pointer', opacity: pw.length < 4 ? 0.5 : 1 }}>ログイン</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16, backdropFilter: 'blur(4px)' }
const dialog = { background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.32)' }
