import React, { useState, useRef, useLayoutEffect } from 'react'
import { CA_MEMBERS } from '../constants'
import { pathProb, GATES } from '../forecast'
import { LEVELS, TARGET_P } from '../matching'
import { yen } from '../report'

const CA_COLOR = { [CA_MEMBERS[0]]: '#3b82f6', [CA_MEMBERS[1]]: '#10b981', [CA_MEMBERS[2]]: '#8b5cf6' }
const STAGE_SHORT = { lead: 'リード', screening: '書類', interview1: '一次', interview2: '二次', interviewFinal: '最終', offer: '内定', won: '成約' }
const pct = x => `${Math.round((x || 0) * 100)}%`
const TONE = { bad: 'var(--bad)', warn: 'var(--warn)', good: 'var(--good)' }

export default function StrategyView({ companies, diagnosis: diagAll, fc, caFilter, currentUser, isAdmin, onCompose, onAddApplication, onOpenCandidate, isMobile }) {
  const [tab, setTab] = useState('stock')
  const diag = caFilter === 'all' ? diagAll : diagAll.filter(d => d.ca === caFilter)
  const canEditCa = ca => isAdmin || ca === currentUser

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🧭 作戦ボード</span>
          <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>誰を、どこに出せば決まるか</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--surface-hover)', borderRadius: 8, padding: 3 }}>
          {[['stock', '🧩 持ち駒診断'], ['companies', '🏢 企業カルテ']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--text)' : 'var(--muted)', boxShadow: tab === k ? 'var(--card-shadow)' : 'none' }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'stock'
        ? <StockTab diag={diag} fc={fc} isMobile={isMobile} canEditCa={canEditCa} onCompose={onCompose} onAddApplication={onAddApplication} onOpenCandidate={onOpenCandidate} scopeLabel={caFilter === 'all' ? 'ユニット全体' : `${caFilter}さん`} />
        : <CompanyTab companies={companies} fc={fc} isMobile={isMobile} onCompose={onCompose} onOpenCandidate={onOpenCandidate} />}
    </div>
  )
}

// ======================= 持ち駒診断 =======================
function StockTab({ diag, fc, isMobile, canEditCa, onCompose, onAddApplication, onOpenCandidate, scopeLabel }) {
  const [open, setOpen] = useState({ safe: false, placed: false })
  const [zeroAll, setZeroAll] = useState(false)
  const inProcess = diag.filter(d => ['low', 'mid', 'safe'].includes(d.level))
  const avgStock = inProcess.length ? inProcess.reduce((s, d) => s + d.activeRows.length, 0) / inProcess.length : 0
  const needAction = diag.filter(d => d.level === 'low' || d.level === 'zero').length
  const placedN = diag.filter(d => d.level === 'placed').length
  const future = diag.filter(d => d.level !== 'placed').reduce((s, d) => s + d.P, 0)
  const order = ['low', 'zero', 'mid', 'safe', 'placed']

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
        <Tile label="選考中の求職者" value={`${inProcess.length}名`} sub={scopeLabel} />
        <Tile label="平均の持ち駒" value={`${avgStock.toFixed(1)}社`} sub="1人あたりの並行選考数" />
        <Tile label="要アクション" value={`${needAction}名`} sub="持ち駒不足＋再提案" tone={needAction ? 'bad' : null} />
        <Tile label="今後の決定見込み" value={`${future.toFixed(1)}名`} sub={`決定済み ${placedN}名は別`} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, background: 'var(--surface)', border: '1px solid var(--border-card)', borderRadius: 12, padding: '10px 14px' }}>
        <b>決定確率</b>は、いま選考中のどこか1社でも成約する確率です（各社の成約確率から計算）。
        1社だけに頼ると決定確率は上がりません。目安の <b>{pct(TARGET_P)}</b> を下回る人には、まだ応募していない企業を書類1件あたりの期待売上が高い順に「提案候補」として出します（％は書類提出から成約までの確率）。タップすると提案文の作成や応募の追加ができます。
      </div>

      {order.map(level => {
        const items = diag.filter(d => d.level === level)
        if (!items.length) return null
        const L = LEVELS[level]
        const collapsible = level === 'safe' || level === 'placed'
        const isOpen = !collapsible || open[level]
        const shown = level === 'zero' && !zeroAll ? items.slice(0, 6) : items
        return (
          <section key={level} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div onClick={collapsible ? () => setOpen(o => ({ ...o, [level]: !o[level] })) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: collapsible ? 'pointer' : 'default' }}>
              <LevelBadge level={level} />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{items.length}名</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{L.desc}</span>
              {collapsible && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted-2)' }}>{isOpen ? '▾ 閉じる' : '▸ 表示'}</span>}
            </div>
            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {shown.map(d => (
                  <StockCard key={d.key} d={d} fc={fc} editable={canEditCa(d.ca)} onCompose={onCompose} onAddApplication={onAddApplication} onOpenCandidate={onOpenCandidate} />
                ))}
              </div>
            )}
            {level === 'zero' && items.length > 6 && (
              <button onClick={() => setZeroAll(v => !v)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                {zeroAll ? '▴ たたむ' : `▾ ほか${items.length - 6}名を表示`}
              </button>
            )}
          </section>
        )
      })}
      {diag.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>対象の求職者がいません</div>}
    </>
  )
}

function StockCard({ d, fc, editable, onCompose, onAddApplication, onOpenCandidate }) {
  const [selKey, setSelKey] = useState(null)
  const selCo = d.recs.find(co => co.key === selKey)
  const L = LEVELS[d.level]
  const tone = TONE[L.tone]
  const base = d.apps[0]
  const advice = d.level === 'placed' ? '決定済み。入社までのフォローを続けましょう。'
    : d.level === 'zero' ? `全社見送り。早めに新しい求人を提案しましょう（${d.need}社の書類提出で決定確率 ${pct(d.reach)}）。`
    : d.level === 'safe' ? 'このまま内定・承諾までのフォローに集中しましょう。'
    : d.need > 0 ? `あと${d.need}社の書類提出で、決定確率 ${pct(d.reach)}（目安 ${pct(TARGET_P)} 以上）。`
    : '目安ラインは超えています。並行応募を1社足すとさらに安定します。'
  const showRecs = d.recs.length > 0 && (d.level === 'low' || d.level === 'zero' || d.level === 'mid')

  return (
    <div style={{ ...card, padding: '14px 16px', borderTop: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{d.name}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: CA_COLOR[d.ca] || '#64748b' }} />{d.ca}</span>
        {d.priority > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>★{d.priority}</span>}
        <span style={{ marginLeft: 'auto' }}><LevelBadge level={d.level} /></span>
      </div>

      {d.level !== 'zero' && d.level !== 'placed' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>決定確率</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{pct(d.P)}</span>
            <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>持ち駒 {d.activeRows.length}社{d.closedCount ? `・見送り/離脱 ${d.closedCount}社` : ''}</span>
          </div>
          <div style={{ position: 'relative', height: 8, background: 'var(--yomi-track)', borderRadius: 4, marginTop: 6 }}>
            <div className="grow-x" style={{ width: `${Math.max(d.P * 100, 2)}%`, height: '100%', background: tone, borderRadius: 4 }} />
            <div title={`目安 ${pct(TARGET_P)}`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${TARGET_P * 100}%`, width: 2, background: 'var(--text-3)', borderRadius: 1 }} />
          </div>
        </div>
      )}

      {d.activeRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {d.activeRows.map(r => (
            <button key={r.c.id} onClick={() => onOpenCandidate(r.c)} className="yomi-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 7, border: 'none', background: 'var(--surface-sub)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 9, background: 'var(--surface-hover)', color: 'var(--text-3)', flexShrink: 0 }}>{STAGE_SHORT[r.c.status]}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.c.company || '企業未設定'}</span>
              <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{pct(r.prob)}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>▶ {advice}</div>

      {showRecs && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>提案候補</span>
            {d.recs.map(co => {
              const on = co.key === selKey
              return (
                <button key={co.key} onClick={() => setSelKey(k => k === co.key ? null : co.key)} title={`${co.name}：書類提出→成約 ${pct(co.pDoc)}`} className="pill-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 14, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)', color: 'var(--text-2)' }}>
                  {co.short}<span className="num" style={{ fontWeight: 600, color: 'var(--muted)' }}>{pct(co.pDoc)}</span>
                </button>
              )
            })}
          </div>
          {selCo && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'var(--surface-sub)', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>{selCo.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>書類→成約 {pct(selCo.pDoc)}・平均 {yen(selCo.feeUsed)}・書類1件あたり {Math.round(selCo.evPerDoc)}万円</div>
              </div>
              <button title="この企業の求人提案文をつくる" onClick={() => onCompose({ ...base, id: `proposal_${selCo.key}`, company: selCo.name, status: 'lead', interviewDate: null, statusChangedAt: null, fee: selCo.avgFee, memo: '', nextAction: '' })}
                className="pill-btn" style={miniBtn}>💬 提案文</button>
              {editable && (
                <button title="この企業への応募を追加" onClick={() => onAddApplication({ candidateName: d.name, company: selCo.name, assignedCA: d.ca })} className="pill-btn" style={miniBtn}>＋ 応募を追加</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LevelBadge({ level }) {
  const L = LEVELS[level]
  const c = TONE[L.tone]
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 10, color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, whiteSpace: 'nowrap' }}>{L.label}</span>
}

// ======================= 企業カルテ =======================
function CompanyTab({ companies, fc, isMobile, onCompose, onOpenCandidate }) {
  const [selected, setSelected] = useState(null)
  const listRef = useRef(null)
  const unitP = pathProb('screening', fc.rates)
  const overdue = companies.flatMap(co => co.overdue.map(w => ({ ...w, co })))
  const pick = key => {
    setSelected(key)
    setTimeout(() => listRef.current?.querySelector(`[data-co="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }

  if (!companies.length) return <div style={{ ...card, textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>企業名の入った案件がまだありません</div>

  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, background: 'var(--surface)', border: '1px solid var(--border-card)', borderRadius: 12, padding: '10px 14px' }}>
        ユニット全体の実績から、企業ごとの<b>通りやすさ</b>と<b>書類1件あたりの期待売上</b>（書類提出から成約までの確率 × 平均紹介料）を出しています。
        応募が少ない企業はユニット平均に寄せて推定しています。
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={cardTitle}>企業マップ</span>
          <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>右上ほど「通りやすく単価も高い」＝提案の狙い目。点の大きさは応募数。タップで詳細へ</span>
        </div>
        <CompanyMap companies={companies} unitP={unitP} avgFee={fc.avgFee} onPick={pick} selected={selected} />
      </div>

      {overdue.length > 0 && (
        <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--warn) 45%, var(--border-card))' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={cardTitle}>⏳ 書類結果の待ちが長い案件</span>
            <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>その企業のいつもの結果日数を過ぎたもの</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdue.map(({ c, days, co }) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'var(--surface-sub)' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-2)' }}>
                  <b>{c.candidateName}</b> × {co.name}
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>提出から{days}日（この企業の目安 {co.docSpeed != null ? `${Math.round(co.docSpeed)}日` : '—'}）</span>
                </div>
                <button onClick={() => onCompose(c)} className="pill-btn" style={miniBtn}>💬 督促文</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={listRef} style={{ ...card, padding: isMobile ? '12px' : '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={cardTitle}>企業ランキング</span>
          <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>書類1件あたりの期待売上が高い順</span>
        </div>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: COMPANY_COLS, gap: 10, padding: '6px 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted-2)', borderBottom: '1px solid var(--border-soft)' }}>
            <span>#</span><span>企業</span><span style={{ textAlign: 'right' }}>応募</span><span style={{ textAlign: 'right' }}>書類通過</span><span style={{ textAlign: 'right' }}>一次通過</span><span style={{ textAlign: 'right' }}>書類→成約</span><span style={{ textAlign: 'right' }}>平均紹介料</span><span>書類1件の期待売上</span><span style={{ textAlign: 'right' }}>結果まで</span>
          </div>
        )}
        {companies.map((co, i) => (
          <CompanyRow key={co.key} co={co} rank={i + 1} maxEv={companies[0].evPerDoc} isMobile={isMobile} open={selected === co.key}
            onToggle={() => setSelected(s => s === co.key ? null : co.key)} onCompose={onCompose} onOpenCandidate={onOpenCandidate} />
        ))}
      </div>
    </>
  )
}

const COMPANY_COLS = '24px minmax(140px,1.6fr) 56px 64px 64px 72px 72px minmax(120px,1.2fr) 56px'

function CompanyRow({ co, rank, maxEv, isMobile, open, onToggle, onCompose, onOpenCandidate }) {
  const r = co.rates
  const frac = (g) => r[g].n ? `${r[g].pass}/${r[g].n}` : '—'
  const evBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--yomi-track)', borderRadius: 4, minWidth: 40 }}>
        <div style={{ width: `${(co.evPerDoc / maxEv) * 100}%`, height: '100%', background: 'var(--yomi-expected)', borderRadius: 4 }} />
      </div>
      <span className="num" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>{Math.round(co.evPerDoc)}万円</span>
    </div>
  )
  return (
    <div data-co={co.key} style={{ borderBottom: '1px solid var(--border-soft)', background: open ? 'var(--surface-sub)' : undefined, borderRadius: open ? 8 : 0 }}>
      {isMobile ? (
        <div onClick={onToggle} className="yomi-row" style={{ padding: '10px 6px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-2)', width: 18 }}>{rank}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>{co.name}</span>
            {co.overdue.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warn)' }}>⏳{co.overdue.length}</span>}
          </div>
          <div style={{ marginTop: 6 }}>{evBar}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
            <span>書類通過 <b style={{ color: 'var(--text-2)' }}>{pct(r.doc.p)}</b></span>
            <span>書類→成約 <b style={{ color: 'var(--text-2)' }}>{pct(co.pDoc)}</b></span>
            <span>平均 <b style={{ color: 'var(--text-2)' }}>{yen(co.feeUsed)}</b></span>
          </div>
        </div>
      ) : (
        <div onClick={onToggle} className="yomi-row" style={{ display: 'grid', gridTemplateColumns: COMPANY_COLS, gap: 10, alignItems: 'center', padding: '9px 8px', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-3)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-2)' }}>{rank}</span>
          <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {co.name}{co.overdue.length > 0 && <span title="書類結果の待ちが長い案件あり" style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: 'var(--warn)' }}>⏳{co.overdue.length}</span>}
          </span>
          <span className="num" style={{ textAlign: 'right' }}>{co.total}<span style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>（{co.active.length}）</span></span>
          <span className="num" style={{ textAlign: 'right' }} title={`実績 ${frac('doc')}`}>{pct(r.doc.p)}</span>
          <span className="num" style={{ textAlign: 'right' }} title={`実績 ${frac('first')}`}>{pct(r.first.p)}</span>
          <span className="num" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-2)' }}>{pct(co.pDoc)}</span>
          <span className="num" style={{ textAlign: 'right' }}>{yen(co.feeUsed)}{co.feeEstimated && <span style={{ fontSize: 10, color: 'var(--warn)' }}>推定</span>}</span>
          {evBar}
          <span className="num" style={{ textAlign: 'right' }}>{co.docSpeed != null ? `${Math.round(co.docSpeed)}日` : '—'}</span>
        </div>
      )}
      {open && <CompanyDetail co={co} onCompose={onCompose} onOpenCandidate={onOpenCandidate} />}
    </div>
  )
}

function CompanyDetail({ co, onCompose, onOpenCandidate }) {
  const r = co.rates
  return (
    <div style={{ padding: '4px 12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      <div>
        <div style={detailTitle}>関門ごとの通過率（推定・実績）</div>
        {GATES.filter(g => g.key !== 'apply').map(g => (
          <div key={g.key} style={{ display: 'flex', fontSize: 12, color: 'var(--text-3)', padding: '2px 0' }}>
            <span style={{ width: 70 }}>{g.label}</span>
            <span className="num" style={{ fontWeight: 700, color: 'var(--text-2)', width: 44, textAlign: 'right' }}>{pct(r[g.key].p)}</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted-2)' }}>{r[g.key].n ? `実績 ${r[g.key].pass}/${r[g.key].n}` : '実績なし'}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={detailTitle}>担当別</div>
        {co.byCa.map(x => (
          <div key={x.ca} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', padding: '2px 0' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CA_COLOR[x.ca] || '#64748b' }} />
            <span style={{ width: 40 }}>{x.ca}</span>
            <span>応募 {x.apps}・成約 <b>{x.won}</b></span>
          </div>
        ))}
        {co.losses.length > 0 && (
          <>
            <div style={{ ...detailTitle, marginTop: 10 }}>失注の内訳</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{co.losses.map(l => `${l.label} ${l.n}`).join('・')}</div>
          </>
        )}
      </div>
      <div>
        <div style={detailTitle}>選考中（{co.active.length}件）</div>
        {co.active.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)' }}>なし</div>}
        {co.active.map(c => {
          const w = co.waiting.find(x => x.c.id === c.id)
          const late = w && w.days >= co.slowAfter
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <button onClick={() => onOpenCandidate(c)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}>
                {c.candidateName}<span style={{ fontSize: 10.5, color: late ? 'var(--warn)' : 'var(--muted-2)', marginLeft: 6 }}>{STAGE_SHORT[c.status]}{w ? `・${w.days}日` : ''}</span>
              </button>
              <button onClick={() => onCompose(c)} title="連絡文" className="pill-btn" style={{ ...miniBtn, padding: '3px 8px' }}>💬</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- 企業マップ（散布図） ----------
function useWidth(ref) {
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const update = () => setW(ref.current.clientWidth || 600)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function CompanyMap({ companies, unitP, avgFee, onPick, selected }) {
  const wrapRef = useRef(null)
  const W = useWidth(wrapRef)
  const [hover, setHover] = useState(null)
  const H = W < 480 ? 260 : 300
  const m = { l: 46, r: 14, t: 26, b: 34 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const maxP = Math.max(...companies.map(c => c.pDoc), unitP) * 1.12
  const xMax = Math.max(0.1, Math.ceil(maxP * 20) / 20)
  const maxFee = Math.max(...companies.map(c => c.feeUsed), avgFee)
  const yStep = maxFee > 150 ? 50 : 20
  const yMax = Math.ceil((maxFee * 1.1) / yStep) * yStep
  const x = p => m.l + (p / xMax) * iw
  const y = f => m.t + ih - (f / yMax) * ih
  const xTicks = []
  const xStep = xMax > 0.3 ? 0.1 : 0.05
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(Math.round(v * 100) / 100)
  const yTicks = []
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v)
  const rOf = co => Math.min(13, 4.5 + Math.sqrt(co.total) * 1.8)
  const isHot = co => co.pDoc >= unitP && co.feeUsed >= avgFee

  // ラベル：期待売上の上位を優先し、重なるものは省く
  const fs = W < 480 ? 10 : 11
  // 点そのものも障害物にして、ラベルが点に重ならないようにする
  const placed = companies.map(co => { const cx = x(co.pDoc), cy = y(co.feeUsed), rr = rOf(co) + 1; return { x1: cx - rr, x2: cx + rr, y1: cy - rr, y2: cy + rr } })
  const labels = []
  const byEv = [...companies].sort((a, b) => b.evPerDoc - a.evPerDoc).slice(0, W < 480 ? 5 : 8)
  for (const co of byEv) {
    const cx = x(co.pDoc), cy = y(co.feeUsed), rr = rOf(co)
    const text = co.short.length > 9 ? co.short.slice(0, 8) + '…' : co.short
    const tw = text.length * fs * 0.98
    const cands = [
      { tx: cx + rr + 4, ty: cy + fs * 0.35, anchor: 'start', bx: cx + rr + 4 },
      { tx: cx - rr - 4, ty: cy + fs * 0.35, anchor: 'end', bx: cx - rr - 4 - tw },
      { tx: cx, ty: cy - rr - 5, anchor: 'middle', bx: cx - tw / 2 },
      { tx: cx, ty: cy + rr + fs + 2, anchor: 'middle', bx: cx - tw / 2 },
    ]
    for (const p of cands) {
      const box = { x1: p.bx - 2, x2: p.bx + tw + 2, y1: p.ty - fs, y2: p.ty + 3 }
      if (box.x1 < m.l || box.x2 > W - 2 || box.y1 < m.t || box.y2 > m.t + ih) continue
      if (placed.some(b => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2))) continue
      placed.push(box)
      labels.push({ key: co.key, text, ...p })
      break
    }
  }

  const hv = hover && companies.find(c => c.key === hover)
  return (
    <div ref={wrapRef} style={{ position: 'relative', marginTop: 10 }}>
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }} role="img" aria-label="企業マップ：横軸は書類提出から成約までの確率、縦軸は平均紹介料">
        {/* 狙い目ゾーン */}
        <rect x={x(unitP)} y={m.t} width={Math.max(0, m.l + iw - x(unitP))} height={Math.max(0, y(avgFee) - m.t)} fill="var(--yomi-expected)" opacity="0.07" />
        <text x={m.l + iw - 4} y={m.t + 12} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--muted)">狙い目</text>
        {/* グリッド */}
        {yTicks.map(v => (
          <g key={`y${v}`}>
            <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke="var(--border-soft)" strokeWidth="1" />
            <text x={m.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-2)" className="num">{v}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={`x${v}`}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={m.t + ih} stroke="var(--border-soft)" strokeWidth="1" />
            <text x={x(v)} y={m.t + ih + 14} textAnchor="middle" fontSize="10" fill="var(--muted-2)" className="num">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="var(--border)" strokeWidth="1" />
        {/* ユニット平均 */}
        <line x1={x(unitP)} x2={x(unitP)} y1={m.t} y2={m.t + ih} stroke="var(--muted-2)" strokeWidth="1" />
        <line x1={m.l} x2={m.l + iw} y1={y(avgFee)} y2={y(avgFee)} stroke="var(--muted-2)" strokeWidth="1" />
        <text x={x(unitP) + 4} y={m.t + ih - 4} fontSize="9.5" fill="var(--muted)">平均 {pct(unitP)}</text>
        <text x={m.l + 4} y={y(avgFee) + 12} fontSize="9.5" fill="var(--muted)">平均 {avgFee}万</text>
        <text x={m.l + iw} y={H - 3} textAnchor="end" fontSize="10" fill="var(--muted)">書類提出→成約の確率 →</text>
        <text x={4} y={11} fontSize="10" fill="var(--muted)">紹介料（万円）</text>
        {/* 点 */}
        {companies.map(co => {
          const cx = x(co.pDoc), cy = y(co.feeUsed), rr = rOf(co)
          const hot = isHot(co)
          const active = hover === co.key || selected === co.key
          return (
            <g key={co.key} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(co.key)} onMouseLeave={() => setHover(h => h === co.key ? null : h)}
              onClick={() => onPick(co.key)}>
              <circle cx={cx} cy={cy} r={rr + 8} fill="transparent" />
              <circle cx={cx} cy={cy} r={rr} fill={hot ? 'var(--yomi-expected)' : 'var(--muted-2)'} fillOpacity={hot ? 0.9 : 0.55} stroke="var(--surface)" strokeWidth="2" />
              {active && <circle cx={cx} cy={cy} r={rr + 3} fill="none" stroke="var(--text)" strokeWidth="1.5" />}
            </g>
          )
        })}
        {labels.map(l => (
          <text key={l.key} x={l.tx} y={l.ty} textAnchor={l.anchor} fontSize={fs} fontWeight="700" fill="var(--text-2)" style={{ pointerEvents: 'none' }}>{l.text}</text>
        ))}
      </svg>
      {hv && (
        <div style={{ position: 'absolute', left: Math.min(Math.max(x(hv.pDoc) - 105, 0), W - 214), top: y(hv.feeUsed) > 130 ? y(hv.feeUsed) - rOf(hv) - 112 : y(hv.feeUsed) + rOf(hv) + 10, width: 210, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, boxShadow: 'var(--card-shadow-hover)', padding: '8px 10px', fontSize: 11.5, color: 'var(--text-3)', pointerEvents: 'none', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 12.5 }}>{hv.name}</div>
          <div>書類→成約 <b>{pct(hv.pDoc)}</b>・平均 <b>{yen(hv.feeUsed)}</b></div>
          <div>書類1件あたり <b>{Math.round(hv.evPerDoc)}万円</b></div>
          <div>応募 {hv.total}件（選考中 {hv.active.length}）</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--yomi-expected)' }} />狙い目（両方ともユニット平均以上）</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--muted-2)', opacity: 0.6 }} />その他</span>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, tone }) {
  const c = tone ? TONE[tone] : null
  return (
    <div style={{ ...card, padding: '12px 14px', borderTop: c ? `2px solid ${c}` : undefined }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 2, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 1 }}>{sub}</div>
    </div>
  )
}

const card = { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', padding: '16px 18px', boxShadow: 'var(--card-shadow)' }
const cardTitle = { fontWeight: 800, fontSize: 13.5, color: 'var(--text)', letterSpacing: '-0.01em' }
const detailTitle = { fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }
const miniBtn = { flexShrink: 0, fontSize: 11.5, padding: '5px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }
