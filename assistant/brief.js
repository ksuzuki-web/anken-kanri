// 朝ブリーフ: 自分宛ての未返信メンション / タスク期限 / 昨日の動き / 案件ボードの状況を1枚に。
// 使い方:
//   npm run cw:brief                 … コンソールに表示
//   node assistant/brief.js --post   … Chatwork（マイチャット or 指定ルーム）に投稿
//   node assistant/brief.js --no-ai  … AI要約を使わない
import { pathToFileURL } from 'node:url'
import { loadEnv } from './lib/env.js'
import { ChatworkClient } from './lib/chatwork.js'
import { createStore } from './lib/store.js'
import { aiEnabled, chatClaude } from './lib/claude.js'
import { fetchCandidates, summarizeAnken, renderAnkenLines } from './lib/anken.js'
import {
  stripTags, mentionsAccount, truncate, nowUnix,
  jstStamp, jstMd, jstHeader, jstWeekday, jstYmd, jstEndOfToday,
} from './lib/cwformat.js'

function roomNameOf(rooms, state, roomId) {
  const r = rooms.find(x => String(x.room_id) === String(roomId))
  return r?.name || state.rooms?.[roomId]?.name || `ルーム${roomId}`
}

/** 直近ログからAIダイジェストを作る（AIキーがなければnull） */
async function buildAiDigest(env, msgs, rooms, state) {
  if (!aiEnabled(env) || !msgs.length) return null

  // ルームごとにまとめて、量をトークン上限内に収める
  const byRoom = new Map()
  for (const m of msgs) {
    if (!byRoom.has(m.room_id)) byRoom.set(m.room_id, [])
    byRoom.get(m.room_id).push(m)
  }
  const roomsSorted = [...byRoom.entries()].sort((a, b) => b[1].length - a[1].length)

  let transcript = ''
  for (const [roomId, list] of roomsSorted) {
    let section = `\n### ルーム: ${roomNameOf(rooms, state, roomId)}\n`
    for (const m of list.slice(-80)) {
      section += `[${jstStamp(m.send_time)}] ${m.account_name}: ${truncate(stripTags(m.body), 220)}\n`
    }
    if (transcript.length + section.length > 26000) break
    transcript += section
  }

  const prompt = `以下は直近のChatworkログです。朝の始業前に読むダイジェストとして、次の3セクションを日本語で出力してください。マークダウン記号は使わず、プレーンテキストで簡潔に。

■ 昨日の要点（重要なものだけ、ルームごとに1行、最大6行）
■ 見落とし・リスク（返信漏れ・期限・候補者/企業の温度感の変化など、最大3行。なければ「特になし」）
■ 今日の提案（具体的なアクションを優先順に最大3つ）

--- ログここから ---
${transcript}`

  try {
    return await chatClaude(env, {
      system: `あなたは${env.companyContext}の社内アシスタントです。`,
      prompt,
      maxTokens: 1500,
    })
  } catch (e) {
    return `（AI要約は失敗しました: ${e.message}）`
  }
}

export async function buildBrief({ env, store, now = new Date(), useAi = true }) {
  const state = await store.getState()
  const rooms = await store.getRooms()
  const myId = state.me?.account_id

  if (!rooms.length) {
    throw new Error('データがまだありません。先に `npm run cw:sync` を実行してください。')
  }

  // 月曜は週末をまたいで72時間、それ以外は26時間さかのぼる
  const lookbackH = jstWeekday(now) === 'Mon' ? 72 : 26
  const since = Math.floor(now.getTime() / 1000) - lookbackH * 3600
  const msgs = await store.getMessagesSince(since)
  const othersMsgs = msgs.filter(m => m.account_id !== myId)

  const lines = []
  lines.push(`🌅 朝ブリーフ ${jstHeader(now)}`)
  lines.push('')

  // --- 自分宛てメンション ---
  const mentions = othersMsgs.filter(m => mentionsAccount(m.body, myId))
  const mentionLines = []
  for (const m of mentions.slice(-12)) {
    const replied = msgs.some(x =>
      x.room_id === m.room_id && x.account_id === myId && (x.send_time || 0) > (m.send_time || 0))
    const mark = replied ? '✓' : '⚠'
    mentionLines.push(`${mark} ${jstStamp(m.send_time)} [${roomNameOf(rooms, state, m.room_id)}] ${m.account_name}: ${truncate(stripTags(m.body), 80)}`)
  }
  const unreplied = mentionLines.filter(l => l.startsWith('⚠')).length
  lines.push(`■ あなた宛てメンション（直近${lookbackH}時間: ${mentions.length}件${unreplied ? `、うち未返信 ${unreplied}件` : ''}）`)
  lines.push(...(mentionLines.length ? mentionLines : ['なし 🎉']))
  lines.push('')

  // --- Chatworkタスク ---
  const tasks = await store.getTasks()
  const nowU = nowUnix()
  const endToday = jstEndOfToday(now)
  const overdue = tasks.filter(t => t.limit_time > 0 && t.limit_time < nowU)
  const dueToday = tasks.filter(t => t.limit_time >= nowU && t.limit_time <= endToday)
  const rest = tasks.length - overdue.length - dueToday.length
  lines.push(`■ Chatworkタスク（未完了 ${tasks.length}件）`)
  if (!tasks.length) {
    lines.push('なし 🎉')
  } else {
    for (const t of overdue.slice(0, 6)) {
      lines.push(`🔴 期限超過(${jstMd(t.limit_time)}): ${truncate(stripTags(t.body), 60)} [${t.room?.name || ''}${t.assigned_by_account?.name ? `・${t.assigned_by_account.name}さんから` : ''}]`)
    }
    for (const t of dueToday.slice(0, 6)) {
      lines.push(`🟡 本日期限: ${truncate(stripTags(t.body), 60)} [${t.room?.name || ''}]`)
    }
    if (rest > 0) lines.push(`・期限なし・今後のタスク: ${rest}件`)
  }
  lines.push('')

  // --- 昨日の動き ---
  const actByRoom = new Map()
  for (const m of othersMsgs) {
    if (!actByRoom.has(m.room_id)) actByRoom.set(m.room_id, { count: 0, people: new Map() })
    const a = actByRoom.get(m.room_id)
    a.count++
    a.people.set(m.account_name, (a.people.get(m.account_name) || 0) + 1)
  }
  const actSorted = [...actByRoom.entries()].sort((a, b) => b[1].count - a[1].count)
  lines.push(`■ 昨日の動き（${othersMsgs.length}件 / ${actSorted.length}ルーム）`)
  if (!actSorted.length) {
    lines.push('動きなし')
  } else {
    for (const [roomId, a] of actSorted.slice(0, 8)) {
      const top = [...a.people.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([n]) => n).join('、')
      lines.push(`・${roomNameOf(rooms, state, roomId)}: ${a.count}件（${top}${a.people.size > 2 ? ' ほか' : ''}）`)
    }
    if (actSorted.length > 8) lines.push(`・ほか ${actSorted.length - 8}ルーム`)
  }
  lines.push('')

  // --- 案件ボード（Supabase未設定・失敗時はセクションごと省略） ---
  try {
    const candidates = await fetchCandidates(env)
    if (candidates) {
      lines.push('■ 案件ボード')
      lines.push(...renderAnkenLines(summarizeAnken(candidates, jstYmd(now))))
      lines.push('')
    }
  } catch { /* 案件ボード連携は任意機能 */ }

  // --- AIまとめ ---
  if (useAi) {
    const digest = await buildAiDigest(env, othersMsgs, rooms, state)
    if (digest) {
      lines.push('◆ AIまとめ')
      lines.push(digest)
      lines.push('')
    }
  }

  const text = lines.join('\n').trim()
  const chatworkText = `[info][title]🌅 朝ブリーフ ${jstYmd(now)}[/title]${text.replace(/^🌅 朝ブリーフ[^\n]*\n*/, '')}[/info]`.slice(0, 20000)
  return {
    text,
    chatworkText,
    stats: { messages: othersMsgs.length, mentions: mentions.length, unreplied, openTasks: tasks.length },
  }
}

/** ブリーフをChatworkへ投稿。投稿先ルームIDを返す */
export async function postBrief(env, store, chatworkText) {
  const cw = new ChatworkClient({ token: env.chatworkToken, base: env.chatworkApiBase })
  let roomId = env.briefRoomId
  if (!roomId) {
    const rooms = await store.getRooms()
    const myRoom = rooms.find(r => r.type === 'my')
    if (!myRoom) throw new Error('投稿先が見つかりません。.env の CHATWORK_BRIEF_ROOM_ID にルームIDを設定してください。')
    roomId = myRoom.room_id
  }
  await cw.postMessage(roomId, chatworkText, { selfUnread: 1 })
  return roomId
}

async function main() {
  const env = loadEnv()
  const post = process.argv.includes('--post')
  const useAi = !process.argv.includes('--no-ai')

  const store = await createStore(env)
  const { text, chatworkText, stats } = await buildBrief({ env, store, useAi })

  console.log(text)

  // 履歴として保存（Supabaseならチームからも見える）
  try { await store.saveDoc(`brief-${jstYmd()}`, text) } catch { /* 保存失敗は無視 */ }

  if (post) {
    const roomId = await postBrief(env, store, chatworkText)
    console.error('')
    console.error(`✅ Chatwork（ルームID: ${roomId}）に投稿しました`)
  } else {
    console.error('')
    console.error(`（メンション${stats.mentions}件・未返信${stats.unreplied}件・タスク${stats.openTasks}件。--post を付けるとChatworkに投稿します）`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('エラー:', e.message); process.exit(1) })
}
