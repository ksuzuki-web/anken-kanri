// 蓄積したChatworkログから「会社まるごと理解ドキュメント」を自動生成する。
// ルームごとのノート（目的・参加者・進行中の話題・用語）を作り、全体を統合した
// 会社プロファイル（company-profile）に仕上げる。ask.js が回答時の知識として使う。
//
// 使い方:
//   npm run cw:learn                  … 新着があったルームだけ更新（差分学習）
//   node assistant/learn.js --force   … 全ルームを作り直す
//
// ※ANTHROPIC_API_KEY が必要（AI機能）。
import { pathToFileURL } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createStore } from './lib/store.js'
import { aiEnabled, chatClaude } from './lib/claude.js'
import { fetchCandidates, summarizeAnken } from './lib/anken.js'
import { stripTags, truncate, jstStamp, jstYmd } from './lib/cwformat.js'

const MIN_MESSAGES = 15 // これ未満のルームはノート化しない

function buildTranscript(msgs) {
  let out = ''
  for (const m of msgs.slice(-500)) {
    out += `[${jstStamp(m.send_time)}] ${m.account_name}: ${truncate(stripTags(m.body), 300)}\n`
  }
  // 長すぎる場合は新しい方を優先して切り詰める
  return out.length > 30000 ? out.slice(-30000) : out
}

export async function runLearn({ env, store, log = console.error, force = false }) {
  const state = await store.getState()
  const rooms = await store.getRooms()
  const roomName = id => rooms.find(r => String(r.room_id) === String(id))?.name || state.rooms?.[id]?.name || `ルーム${id}`

  const all = await store.getMessagesSince(0)
  if (!all.length) throw new Error('メッセージがまだありません。先に `npm run cw:sync` を実行してください。')

  const byRoom = new Map()
  for (const m of all) {
    if (!byRoom.has(m.room_id)) byRoom.set(m.room_id, [])
    byRoom.get(m.room_id).push(m)
  }

  state.learn = state.learn || {}
  let updated = 0
  let skipped = 0

  const targets = [...byRoom.entries()]
    .filter(([, list]) => list.length >= MIN_MESSAGES)
    .sort((a, b) => b[1].length - a[1].length)

  for (const [roomId, list] of targets) {
    const name = roomName(roomId)
    const lastTime = Math.max(...list.map(m => m.send_time || 0))
    if (!force && state.learn[roomId]?.lastTime === lastTime) { skipped++; continue }

    log(`  ルームノート更新中: ${name}（${list.length}件）`)
    const note = await chatClaude(env, {
      model: env.lightModel,
      system: `あなたは${env.companyContext}の社内アシスタントです。`,
      prompt: `以下はChatworkルーム「${name}」の直近ログです。AIアシスタントが後で参照するためのルームノートを作成してください。

# 出力形式（マークダウン）
## このルームの目的
## 主な参加者と役割
## 進行中の話題・案件
## 決まっていること・ルール
## 用語・略語メモ
## 直近の注意点

事実ベースで簡潔に。ログから読み取れないことは書かない。推測には（推測）と付ける。

--- ログここから ---
${buildTranscript(list)}`,
      maxTokens: 2000,
    })
    await store.saveDoc(`room-${roomId}`, `# ルームノート: ${name}\n（自動生成 ${jstYmd()} / 対象${list.length}件）\n\n${note}`)
    state.learn[roomId] = { lastTime, name }
    updated++
  }

  // --- 全ルームノートを統合して会社プロファイルを作る ---
  let notes = ''
  for (const key of await store.listDocs()) {
    if (!key.startsWith('room-')) continue
    const doc = await store.getDoc(key)
    if (!doc) continue
    notes += doc.slice(0, 5000) + '\n\n---\n\n'
    if (notes.length > 60000) break
  }

  let ankenNote = ''
  try {
    const candidates = await fetchCandidates(env)
    if (candidates) {
      const sum = summarizeAnken(candidates)
      ankenNote = `\n# 案件ボードの現況\n進行中${sum.activeCount}件（${sum.countsLabel}）、停滞アラート${sum.alerts.length}件`
    }
  } catch { /* 任意機能 */ }

  if (updated > 0 || force || !(await store.getDoc('company-profile'))) {
    log('  会社プロファイルを統合中…')
    const profile = await chatClaude(env, {
      system: `あなたは${env.companyContext}の社内アシスタントです。`,
      prompt: `以下は各Chatworkルームの自動生成ノートと案件ボードの状況です。これらを統合し、AIアシスタントが業務サポートに使う「会社まるごと理解ドキュメント」を作成してください。

# 出力形式（マークダウン）
# 会社プロファイル（自動生成）
## 事業と組織
## 人物メモ（誰が何を担当し、どういう動き方か）
## 進行中の重要案件・クライアント
## 社内の定例・ルール・使用ツール
## 用語集
## アシスタントとして気をつけること

重複を整理し、事実ベースで。推測には（推測）と付ける。

--- ルームノートここから ---
${notes}${ankenNote}`,
      maxTokens: 4000,
    })
    await store.saveDoc('company-profile', `${profile}\n\n_（最終更新: ${jstYmd()}）_`)
  }

  return { updated, skipped, totalRooms: targets.length }
}

async function main() {
  const env = loadEnv()
  if (!aiEnabled(env)) {
    console.error('ANTHROPIC_API_KEY が設定されていないため、ナレッジ学習は実行できません。')
    console.error('https://console.anthropic.com でAPIキーを発行し、.env に追記してください。')
    process.exit(1)
  }
  const force = process.argv.includes('--force')
  const store = await createStore(env)
  console.error(`ナレッジ学習を開始します（保存先: ${store.kind === 'supabase' ? 'Supabase' : 'ローカル(knowledge/)'}）`)
  const result = await runLearn({ env, store, force })
  console.error('')
  console.error(`✅ 学習完了: ルームノート更新 ${result.updated}件 / 変化なしスキップ ${result.skipped}件`)
  const profile = await store.getDoc('company-profile')
  if (profile) {
    console.log('\n===== 会社プロファイル（先頭部分） =====\n')
    console.log(profile.slice(0, 1500))
    console.log('\n（全文は ' + (store.kind === 'supabase' ? 'Supabaseのcw_docsテーブル' : 'knowledge/company-profile.md') + ' にあります。cw:ask が自動で参照します）')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('エラー:', e.message); process.exit(1) })
}
