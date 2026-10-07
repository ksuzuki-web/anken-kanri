import React from 'react'

export const WHATS_NEW_VERSION = 'yomi-v1'

const ITEMS = [
  { icon: '🎯', title: 'ヨミ管理（着地予測）', body: '案件ごとの成約確率を実績から自動計算して、今月いくら着地しそうかを表示。A/B/Cヨミの自動ランク付け、目標からの逆算（あと書類何件？）、担当別の比較まで見られます。', where: 'ツールバーの「🎯 ヨミ」' },
  { icon: '💬', title: '連絡文ジェネレーター', body: 'ステータスや面接日に合わせて、求職者・企業向けの文面をワンタップで作成。面接前リマインド、合否督促、内定後の後押しなど17パターン。LINE送信・メール起動もそのまま。', where: '各案件の「💬」' },
  { icon: '📝', title: '週次レポート自動作成', body: '今月の数字・今週の動き・来週の面接・要フォロー・来週の注力を自動でまとめた週報を、コピーしてチャットやメールに貼るだけ。', where: 'ツールバーの「📝」' },
  { icon: '☀️', title: '朝のダイジェストに今月のヨミ', body: '毎朝のダイジェストに、自分の着地予測と目標までの距離が出るようになりました。', where: '☀️ ボタン' },
]

export default function WhatsNewModal({ onClose, onGoYomi }) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em' }}>NEW</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>案件管理がパワーアップしました</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>「数字の見通し」と「毎日の連絡・報告」をまとめて楽にする4つの新機能です。</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {ITEMS.map(it => (
            <div key={it.title} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-sub)', border: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{it.title}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{it.where}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 3 }}>{it.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>あとで</button>
          <button onClick={onGoYomi} className="btn-primary" style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>🎯 ヨミ管理を見てみる</button>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16, backdropFilter: 'blur(3px)' }
const dialog = { background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.32)', animation: 'pop-in .2s ease' }
