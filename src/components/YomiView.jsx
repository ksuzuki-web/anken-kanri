import React, { useState, useMemo } from 'react'
import { CA_MEMBERS, STATUS_LABEL } from '../constants'
import {
  summarize, backPlan, findBottleneck, monthKeyOf, shiftMonth, monthLabel,
  businessDaysLeft, isTargetInherited, GATES, RANKS, STALE_DAYS,
} from '../forecast'
import { suggestNextAction } from '../suggestions'
import { yen } from '../report'

const CA_COLOR = { [CA_MEMBERS[0]]: '#3b82f6', [CA_MEMBERS[1]]: '#10b981', [CA_MEMBERS[2]]: '#8b5cf6' }
const pct = x => `${Math.round((x || 0) * 100)}%`
const md = d => `${d.getMonth() + 1}/${d.getDate()}`
const STAGE_SHORT = { lead: 'リード', screening: '書類', interview1: '一次', interview2: '二次', interviewFinal: '最終', offer: '内定', won: '成約' }

export default function YomiView({ fc, targets, targetsShared, canEditTargets, onSaveTargets, caFilter, currentUser, onOpenCandidate, onCompose, isMobile }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [editTargets, setEditTargets] = useState(false)
  const [showLogic, setShowLogic] = useState(false)
  const today = fc.today
  const baseMonth = monthKeyOf(today)
  const monthKey = shiftMonth(baseMonth, monthOffset)
  const sm = useMemo(() => summarize(fc, { monthKey, ca: caFilter, targets }), [fc, monthKey, caFilter, targets])
  const caSums = useMemo(() => CA_MEMBERS.map(m => ({ ca: m, ...summarize(fc, { monthKey, ca: m, targets }) })), [fc, monthKey, targets])
  const plan = backPlan(sm.gap, fc)
  const bottleneck = findBottleneck(fc.rates)
  const mLabel = monthLabel(monthKey, today)
  const scopeLabel = caFilter === 'all' ? 'ユニット全体' : `${caFilter}さん`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 見出し＋月切替 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🎯 ヨミ管理</span>
          <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{scopeLabel}の着地予測と、目標からの逆算</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface-hover)', borderRadius: 8, padding: 3 }}>
            {[0, 1].map(o => (
              <button key={o} onClick={() => setMonthOffset(o)} style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: monthOffset === o ? 'var(--surface)' : 'transparent', color: monthOffset === o ? 'var(--text)' : 'var(--muted)', boxShadow: monthOffset === o ? 'var(--card-shadow)' : 'none' }}>
                {o === 0 ? '今月' : '来月'}（{monthLabel(shiftMonth(baseMonth, o), today)}）
              </button>
            ))}
          </div>
          {canEditTargets && (
            <button className="pill-btn" onClick={() => setEditTargets(v => !v)} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: editTargets ? 'var(--surface-hover)' : 'var(--surface)', color: 'var(--text-2)', fontWeight: 700, cursor: 'pointer' }}>
              ✏️ 目標を設定
            </button>
          )}
        </div>
      </div>

      {editTargets && canEditTargets && (
        <TargetEditor monthKey={monthKey} mLabel={mLabel} targets={targets} shared={targetsShared}
          onCancel={() => setEditTargets(false)}
          onSave={async next => { await onSaveTargets(next); setEditTargets(false) }} />
      )}

      {/* ヒーロー：着地予測 */}
      <HeroCard sm={sm} mLabel={mLabel} isMobile={isMobile} inherited={sm.target != null && isTargetInherited(targets, monthKey)} canEditTargets={canEditTargets} onEdit={() => setEditTargets(true)} />

      {/* 担当別 */}
      {caFilter === 'all' && <CaBreakdown caSums={caSums} mLabel={mLabel} currentUser={currentUser} />}

      {/* 勝負案件 */}
      <KeyDeals sm={sm} mLabel={mLabel} onOpenCandidate={onOpenCandidate} onCompose={onCompose} />

      {/* ヨミ表 */}
      <YomiTable sm={sm} mLabel={mLabel} isMobile={isMobile} showCa={caFilter === 'all'} onOpenCandidate={onOpenCandidate} onCompose={onCompose} />

      {/* 逆算・通過率 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <BackPlanCard sm={sm} plan={plan} fc={fc} mLabel={mLabel} isCurrentMonth={monthOffset === 0} />
        <GateCard fc={fc} bottleneck={bottleneck} />
      </div>

      {/* 算出ロジック */}
      <div style={{ ...card, padding: '12px 16px' }}>
        <button onClick={() => setShowLogic(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10 }}>{showLogic ? '▾' : '▸'}</span> この数字の出し方
        </button>
        {showLogic && (
          <ul style={{ margin: '10px 0 2px', paddingLeft: 18, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
            <li><b>成約確率</b>＝今のステージから成約までに越える関門の通過率を掛け合わせたもの。通過率はユニットの実績を、件数が少ないうちは業界の目安に寄せて使います。</li>
            <li><b>補正</b>：着地候補 ×1.25／停滞中 ×0.7／{STALE_DAYS}日以上動きなし ×0.4／面接日未確定 ×0.9（上限95%）</li>
            <li><b>期待値</b>＝紹介料 × 成約確率。紹介料が未入力の案件は平均単価 {yen(fc.avgFee)} で試算します。</li>
            <li><b>見込み時期</b>＝今のステージの残り日数＋その先のステージの平均滞在日数（変更履歴から学習）。面接日が入っていれば面接日＋結果待ち4日で計算します。</li>
            <li><b>堅め</b>＝確定＋Aヨミ全件が決まった場合。<b>強気</b>＝さらにBヨミ全件も決まった場合。</li>
            <li>{fc.historyCount > 0 ? `変更履歴 ${fc.historyCount.toLocaleString()}件をもとに算出しています。` : '変更履歴がまだ無いため、通過率と日数は業界の目安を中心に算出しています。使うほど精度が上がります。'}</li>
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------- ヒーロー ----------------
function HeroCard({ sm, mLabel, isMobile, inherited, canEditTargets, onEdit }) {
  const hasTarget = sm.target != null && sm.target > 0
  const scaleMax = Math.max(sm.target || 0, sm.optimistic, sm.expected, 1) * 1.04
  const w = v => `${(v / scaleMax) * 100}%`
  const achieved = hasTarget && sm.gap <= 0
  return (
    <div style={{ ...card, padding: isMobile ? '18px 16px' : '22px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{mLabel}の着地予測（期待値）</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: isMobile ? 44 : 54, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>{Math.round(sm.expected).toLocaleString()}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>万円</span>
        </div>
        {hasTarget ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>目標 <b style={{ color: 'var(--text-2)' }}>{yen(sm.target)}</b>{inherited && <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>（前月から引継ぎ）</span>}</span>
            <span style={{ fontSize: 13, fontWeight: 800, padding: '3px 11px', borderRadius: 20, background: achieved ? 'color-mix(in srgb, var(--good) 16%, transparent)' : 'color-mix(in srgb, var(--warn) 16%, transparent)', color: achieved ? 'var(--good)' : 'var(--warn)' }}>
              {achieved ? '✓ ' : '▲ '}達成見込み {pct(sm.rate)}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>
            目標が未設定です{canEditTargets ? '' : '（管理者が設定できます）'}
            {canEditTargets && <button onClick={onEdit} style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>目標を設定する →</button>}
          </span>
        )}
      </div>

      {/* メーター：確定＋ヨミ期待値 vs 目標 */}
      <div style={{ position: 'relative', marginTop: 22, marginBottom: 6 }}>
        <div style={{ height: 18, background: 'var(--yomi-track)', borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
          <div className="grow-x" style={{ display: 'flex', gap: 2, height: '100%', width: w(sm.expected) }}>
            {sm.confirmed > 0 && <div title={`確定 ${yen(sm.confirmed)}`} style={{ flex: `${sm.confirmed} 0 0`, background: 'var(--yomi-confirmed)', borderRadius: sm.pipeEv > 0 ? '4px 0 0 4px' : 4 }} />}
            {sm.pipeEv > 0 && <div title={`ヨミ期待値 ${yen(sm.pipeEv)}`} style={{ flex: `${sm.pipeEv} 0 0`, background: 'var(--yomi-expected)', borderRadius: sm.confirmed > 0 ? '0 4px 4px 0' : 4 }} />}
          </div>
        </div>
        {hasTarget && (
          <div title={`目標 ${yen(sm.target)}`} style={{ position: 'absolute', top: -6, bottom: -6, left: w(sm.target), width: 2, background: 'var(--text)', borderRadius: 1 }}>
            <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>目標</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--muted)' }}>
        <Legend color="var(--yomi-confirmed)" label={`確定（成約済み）${yen(sm.confirmed)}`} />
        <Legend color="var(--yomi-expected)" label={`ヨミ期待値 ${yen(sm.pipeEv)}`} />
      </div>

      {/* スタットタイル */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginTop: 18 }}>
        <Stat label="確定" value={yen(sm.confirmed)} sub={`成約 ${sm.won.length}件`} />
        <Stat label="堅め" value={yen(sm.conservative)} sub="確定＋Aヨミ全件" />
        <Stat label="強気" value={yen(sm.optimistic)} sub="＋Bヨミ全件" />
        {hasTarget
          ? <Stat label={achieved ? '目標超過' : '目標まで'} value={achieved ? `+${yen(-sm.gap)}` : `あと${yen(sm.gap)}`} sub={achieved ? '上振れ分' : '期待値ベース'} tone={achieved ? 'good' : 'warn'} />
          : <Stat label="来月以降のヨミ" value={yen(sm.laterEv)} sub={`${sm.later.length}件`} />}
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}</span>
}

function Stat({ label, value, sub, tone }) {
  const toneColor = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : null
  return (
    <div style={{ background: 'var(--surface-sub)', borderRadius: 10, padding: '10px 12px', borderTop: toneColor ? `2px solid ${toneColor}` : '2px solid transparent' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2, whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 1 }}>{sub}</div>
    </div>
  )
}

// ---------------- 目標設定 ----------------
function TargetEditor({ monthKey, mLabel, targets, shared, onSave, onCancel }) {
  const current = targets?.[monthKey] || {}
  const prevKey = Object.keys(targets || {}).filter(k => k < monthKey).sort().pop()
  const seed = Object.keys(current).length ? current : (prevKey ? targets[prevKey] : {})
  const [vals, setVals] = useState(() => Object.fromEntries(CA_MEMBERS.map(m => [m, seed[m] ?? ''])))
  const [saving, setSaving] = useState(false)
  const total = CA_MEMBERS.reduce((s, m) => s + (Number(vals[m]) || 0), 0)
  async function save() {
    setSaving(true)
    const clean = Object.fromEntries(CA_MEMBERS.map(m => [m, vals[m] === '' ? null : Number(vals[m])]))
    await onSave({ ...(targets || {}), [monthKey]: clean })
    setSaving(false)
  }
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{mLabel}の売上目標（万円）</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>担当ごとに設定。ユニット目標は合計で自動計算します。翌月以降は未設定なら自動で引き継がれます。</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
        {CA_MEMBERS.map(m => (
          <label key={m} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: CA_COLOR[m] }} />{m}</span>
            <input type="number" min="0" inputMode="numeric" value={vals[m]} onChange={e => setVals(v => ({ ...v, [m]: e.target.value }))} placeholder="例 300"
              style={{ width: 110, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          </label>
        ))}
        <div style={{ fontSize: 12.5, color: 'var(--muted)', paddingBottom: 9 }}>合計 <b style={{ color: 'var(--text)' }}>{yen(total)}</b></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--primary))', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
      {!shared && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.5 }}>
          ⚠ 共有用のテーブルがまだ無いため、目標はこの端末にだけ保存されます。README の「ヨミ管理のセットアップ」のSQLを1回実行すると全員に共有されます。
        </div>
      )}
    </div>
  )
}

// ---------------- 担当別 ----------------
function CaBreakdown({ caSums, mLabel, currentUser }) {
  const scaleMax = Math.max(...caSums.map(s => Math.max(s.target || 0, s.expected)), 1) * 1.04
  const w = v => `${(v / scaleMax) * 100}%`
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={cardTitle}>担当別の着地予測</span>
        <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>{mLabel}・同じ目盛りで比較</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {caSums.map(s => {
          const hasT = s.target != null && s.target > 0
          return (
            <div key={s.ca}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CA_COLOR[s.ca] }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.ca}{s.ca === currentUser && <span style={{ fontSize: 10, color: 'var(--muted-2)', marginLeft: 4 }}>（あなた）</span>}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                  予測 <b style={{ color: 'var(--text)' }}>{yen(s.expected)}</b>
                  {hasT && <> ／ 目標 {yen(s.target)} <b style={{ color: s.gap <= 0 ? 'var(--good)' : 'var(--text-2)', marginLeft: 4 }}>{pct(s.rate)}</b></>}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ height: 10, background: 'var(--yomi-track)', borderRadius: 4, overflow: 'hidden' }}>
                  <div className="grow-x" style={{ display: 'flex', gap: 2, height: '100%', width: w(s.expected) }}>
                    {s.confirmed > 0 && <div title={`確定 ${yen(s.confirmed)}`} style={{ flex: `${s.confirmed} 0 0`, background: 'var(--yomi-confirmed)' }} />}
                    {s.pipeEv > 0 && <div title={`ヨミ期待値 ${yen(s.pipeEv)}`} style={{ flex: `${s.pipeEv} 0 0`, background: 'var(--yomi-expected)', borderRadius: '0 4px 4px 0' }} />}
                  </div>
                </div>
                {hasT && <div title={`目標 ${yen(s.target)}`} style={{ position: 'absolute', top: -3, bottom: -3, left: w(s.target), width: 2, background: 'var(--text)', borderRadius: 1 }} />}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 4 }}>確定 {yen(s.confirmed)}（{s.won.length}件）・ヨミ {s.pipe.length}件</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        <Legend color="var(--yomi-confirmed)" label="確定" />
        <Legend color="var(--yomi-expected)" label="ヨミ期待値" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, background: 'var(--text)' }} />目標</span>
      </div>
    </div>
  )
}

// ---------------- 勝負案件 ----------------
function KeyDeals({ sm, mLabel, onOpenCandidate, onCompose }) {
  const deals = sm.pipe.filter(r => r.rank === 'A' || r.rank === 'B').slice(0, 5)
  if (!deals.length) return null
  const upside = deals.reduce((s, r) => s + r.feeUsed * (1 - r.prob), 0)
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={cardTitle}>🔥 {mLabel}の勝負案件</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>この{deals.length}件を決め切れば、予測からさらに <b style={{ color: 'var(--text)' }}>+{yen(upside)}</b></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {deals.map(r => (
          <div key={r.c.id} className="yomi-row" onClick={() => onOpenCandidate(r.c)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-sub)', cursor: 'pointer' }}>
            <RankBadge rank={r.rank} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.c.candidateName}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>× {r.c.company || '企業未設定'}</span>
                <StageChip status={r.c.status} />
                <span className="num" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 700 }}>確度 {pct(r.prob)}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{yen(r.feeUsed)}{r.feeEstimated ? '（推定）' : ''}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>→ {suggestNextAction(r.c) || '最終フォローで取り切る'}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); onCompose(r.c) }} title="連絡文を作る" className="pill-btn" style={{ flexShrink: 0, fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>💬 連絡文</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- ヨミ表 ----------------
function YomiTable({ sm, mLabel, isMobile, showCa, onOpenCandidate, onCompose }) {
  const [openD, setOpenD] = useState(false)
  const groups = [
    { key: 'won', label: '成約済み', rows: sm.won, desc: '今月確定した成約' },
    ...RANKS.map(r => ({ key: r.key, label: r.label, rows: sm.pipe.filter(x => x.rank === r.key), desc: r.desc })),
  ]
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={cardTitle}>ヨミ表</span>
        <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>{mLabel}に着地しそうな案件・期待値の高い順</span>
      </div>
      {groups.map(g => {
        if (!g.rows.length) return null
        const collapsed = g.key === 'D' && !openD
        const total = g.rows.reduce((s, r) => s + (g.key === 'won' ? r.feeUsed : r.ev), 0)
        return (
          <div key={g.key} style={{ marginTop: 12 }}>
            <div onClick={g.key === 'D' ? () => setOpenD(v => !v) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 6px', borderBottom: '1px solid var(--border-soft)', cursor: g.key === 'D' ? 'pointer' : 'default' }}>
              <RankBadge rank={g.key} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-2)' }}>{g.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>{g.rows.length}件・{g.key === 'won' ? '確定' : '期待値'} {yen(total)}</span>
              {!isMobile && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{g.desc}</span>}
              {g.key === 'D' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-2)' }}>{collapsed ? '▸ 表示' : '▾ 閉じる'}</span>}
            </div>
            {!collapsed && g.rows.map(r => <YomiRow key={r.c.id} r={r} isMobile={isMobile} showCa={showCa} onOpen={() => onOpenCandidate(r.c)} onCompose={() => onCompose(r.c)} />)}
          </div>
        )
      })}
      {sm.won.length + sm.pipe.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '18px 0' }}>{mLabel}に着地見込みの案件はまだありません</div>
      )}
      {sm.later.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted-2)' }}>このほか、翌月以降の着地見込みが {sm.later.length}件（期待値 {yen(sm.laterEv)}）あります。</div>
      )}
    </div>
  )
}

function YomiRow({ r, isMobile, showCa, onOpen, onCompose }) {
  const c = r.c
  const meta = (
    <>
      <StageChip status={c.status} />
      {showCa && <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: CA_COLOR[c.assignedCA] || '#64748b' }} />{c.assignedCA}</span>}
      {r.factors.map(f => (
        <span key={f.label} style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: f.tone === 'pos' ? 'color-mix(in srgb, var(--good) 14%, transparent)' : 'color-mix(in srgb, var(--bad) 12%, transparent)', color: f.tone === 'pos' ? 'var(--good)' : 'var(--bad)' }}>
          {f.label} ×{f.mult}
        </span>
      ))}
    </>
  )
  const numbers = (
    <>
      <Cell w={58} label="確度"><span className="num" style={{ fontWeight: 800, color: 'var(--text)' }}>{r.won ? '確定' : pct(r.prob)}</span></Cell>
      <Cell w={84} label="紹介料"><span className="num">{yen(r.feeUsed)}</span>{r.feeEstimated && <span title="紹介料が未入力のため平均単価で試算" style={{ fontSize: 10, color: 'var(--warn)', marginLeft: 2 }}>推定</span>}</Cell>
      <Cell w={84} label="期待値"><span className="num" style={{ fontWeight: 700, color: 'var(--text-2)' }}>{yen(r.ev)}</span></Cell>
      <Cell w={64} label={r.won ? '成約日' : '見込み'}><span className="num">{md(r.closeDate)}{r.won ? '' : '頃'}</span></Cell>
    </>
  )
  return (
    <div className="yomi-row" onClick={onOpen} style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 10, padding: '9px 6px', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
      <div style={{ flex: 1, minWidth: isMobile ? '70%' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.candidateName || '（未設定）'}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>× {c.company || '企業未設定'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>{meta}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
        {numbers}
        <button onClick={e => { e.stopPropagation(); onCompose() }} title="連絡文を作る" className="icon-btn" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>💬</button>
      </div>
    </div>
  )
}

function Cell({ w, label, children }) {
  return (
    <div style={{ width: w, textAlign: 'right', fontSize: 12.5, color: 'var(--text-3)' }}>
      <div style={{ fontSize: 9.5, color: 'var(--muted-2)', fontWeight: 700 }}>{label}</div>
      <div style={{ whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  )
}

function RankBadge({ rank }) {
  const k = rank === 'won' ? 'won' : rank.toLowerCase()
  return (
    <span style={{ minWidth: 24, height: 22, padding: '0 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, background: `var(--rank-${k}-bg)`, color: `var(--rank-${k}-fg)`, flexShrink: 0 }}>
      {rank === 'won' ? '✓' : rank}
    </span>
  )
}

function StageChip({ status }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: 'var(--surface-hover)', color: 'var(--text-3)' }}>{STAGE_SHORT[status] || STATUS_LABEL[status]}</span>
}

// ---------------- 逆算 ----------------
function BackPlanCard({ sm, plan, fc, mLabel, isCurrentMonth }) {
  const bizLeft = businessDaysLeft(fc.today)
  if (sm.target == null || sm.target <= 0) {
    return (
      <div style={card}>
        <div style={cardTitle}>🧮 目標からの逆算</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.7 }}>目標を設定すると、「あと何件の書類提出・面接が必要か」をユニットの通過率から逆算して表示します。</div>
      </div>
    )
  }
  if (!plan) {
    return (
      <div style={card}>
        <div style={cardTitle}>🧮 目標からの逆算</div>
        <div style={{ marginTop: 12, padding: '14px', borderRadius: 10, background: 'color-mix(in srgb, var(--good) 10%, transparent)', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 }}>
          🎉 {mLabel}は期待値ベースで<b>目標達成ペース</b>です（+{yen(-sm.gap)}）。<br />
          Aヨミの取り切りと、来月分の書類提出の積み増しに時間を使いましょう。
        </div>
      </div>
    )
  }
  const max = Math.max(...plan.steps.map(s => s.n), 1)
  const docs = plan.steps.find(s => s.key === 'screening').n
  const tooLate = isCurrentMonth && plan.leadTime > daysLeftInMonth(fc.today)
  return (
    <div style={card}>
      <div style={cardTitle}>🧮 目標からの逆算</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.6 }}>
        あと <b style={{ color: 'var(--text)' }}>{yen(sm.gap)}</b> は、平均単価 {yen(plan.avgFee)} で成約 {fmtN(plan.steps[0].n)}件分。<br />
        ユニットの通過率で逆算した、<b style={{ color: 'var(--text)' }}>追加で必要な件数（切り上げ）</b>：
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {plan.steps.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 62, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>{s.label}</span>
            <div style={{ flex: 1, height: 14, position: 'relative' }}>
              <div className="grow-x" style={{ width: `${Math.max((s.n / max) * 100, 3)}%`, height: '100%', background: 'var(--yomi-expected)', borderRadius: '0 4px 4px 0', opacity: 0.85 }} />
            </div>
            <span className="num" style={{ width: 52, flexShrink: 0, fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{Math.ceil(s.n)}件</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, background: 'var(--surface-sub)', borderRadius: 9, padding: '10px 12px' }}>
        {isCurrentMonth && <>📅 今月の残り営業日は<b>{bizLeft}日</b>。書類提出なら<b>1日あたり{(docs / Math.max(bizLeft, 1)).toFixed(1)}件</b>のペースです。<br /></>}
        ⏱ 書類提出から成約までは平均<b>約{plan.leadTime}日</b>。
        {tooLate
          ? '今からの新規提出は来月の数字に効くので、今月分は勝負案件の確度アップ（面接対策・意向の握り）で埋めるのが現実的です。'
          : '今から動けば今月中の着地も狙えます。'}
      </div>
    </div>
  )
}
function fmtN(n) { return n >= 10 ? Math.round(n) : (Math.round(n * 10) / 10).toFixed(1) }
function daysLeftInMonth(today) {
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return Math.round((end - today) / 86400000) + 1
}

// ---------------- 通過率 ----------------
function GateCard({ fc, bottleneck }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={cardTitle}>📊 ユニットの通過率</span>
        <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>予測に使っている値（実績＋目安）</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 12 }}>
        {GATES.map(g => {
          const r = fc.rates[g.key]
          const isBn = bottleneck && bottleneck.key === g.key
          return (
            <div key={g.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>{g.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{g.desc}</span>
                {isBn && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bad)', background: 'color-mix(in srgb, var(--bad) 12%, transparent)', borderRadius: 8, padding: '1px 7px' }}>ボトルネック</span>}
                <span className="num" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{pct(r.p)}</span>
              </div>
              <div style={{ position: 'relative', height: 8, background: 'var(--yomi-track)', borderRadius: 4 }}>
                <div className="grow-x" style={{ width: `${r.p * 100}%`, height: '100%', background: 'var(--yomi-expected)', borderRadius: 4 }} />
                <div title={`目安 ${pct(g.prior)}`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${g.prior * 100}%`, width: 2, background: 'var(--text-3)', borderRadius: 1 }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 3 }}>
                {r.n ? `実績 ${pct(r.actual)}（${r.pass}/${r.n}件）` : '実績なし'}・目安 {pct(g.prior)}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        <Legend color="var(--yomi-expected)" label="予測に使う通過率" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, background: 'var(--text-3)' }} />業界の目安</span>
      </div>
      {bottleneck && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, background: 'color-mix(in srgb, var(--bad) 8%, transparent)', borderRadius: 9, padding: '9px 12px' }}>
          「{bottleneck.label}」が目安を下回っています（{pct(bottleneck.p)} ／ 目安 {pct(bottleneck.prior)}）。ここを改善するのが一番効きます。
        </div>
      )}
    </div>
  )
}

const card = { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', padding: '16px 18px', boxShadow: 'var(--card-shadow)' }
const cardTitle = { fontWeight: 800, fontSize: 13.5, color: 'var(--text)', letterSpacing: '-0.01em' }
