// Chatworkの全ルームからメッセージ・タスクを取り込む。
// 使い方:
//   npm run cw:sync            … 新着分だけ取り込み（普段はこれ）
//   node assistant/sync.js --full        … 全ルームを最新100件から取り直す
//   node assistant/sync.js --rooms=20    … 更新が新しい20ルームだけ対象にする
//
// ※Chatwork APIの仕様上、一度に取れるのは各ルーム「最新100件」まで。
//   定期的に実行することで、それ以降の履歴が積み上がっていく。
import { pathToFileURL } from 'node:url'
import { loadEnv } from './lib/env.js'
import { ChatworkClient } from './lib/chatwork.js'
import { createStore } from './lib/store.js'

function normalizeMessage(roomId, m) {
  return {
    room_id: roomId,
    message_id: String(m.message_id),
    account_id: m.account?.account_id ?? null,
    account_name: m.account?.name ?? '',
    body: m.body ?? '',
    send_time: m.send_time ?? 0,
    update_time: m.update_time ?? 0,
  }
}

export async function runSync({ env, store, log = console.error, full = false, roomLimit = 0 }) {
  const cw = new ChatworkClient({ token: env.chatworkToken, base: env.chatworkApiBase })

  const state = await store.getState()
  if (!state.me) {
    state.me = await cw.me()
    log(`アカウント確認: ${state.me.name}（ID: ${state.me.account_id}）`)
  }

  const rooms = await cw.rooms()
  await store.saveRooms(rooms)
  state.rooms = state.rooms || {}

  let targets = [...rooms].sort((a, b) => (b.last_update_time || 0) - (a.last_update_time || 0))
  if (roomLimit > 0) targets = targets.slice(0, roomLimit)

  const members = await store.getMembers()
  let newTotal = 0
  let touched = 0

  for (const room of targets) {
    const rs = state.rooms[room.room_id] || {}
    // 前回同期から更新のないルームはリクエストを使わずスキップ
    if (!full && rs.seeded && rs.lastUpdateTime === room.last_update_time) continue

    let msgs
    if (!rs.seeded || full) {
      msgs = await cw.messages(room.room_id, { force: 1 })
      if (room.type === 'group' && !members[room.room_id]) {
        try { members[room.room_id] = await cw.roomMembers(room.room_id) } catch { /* 権限なし等は無視 */ }
      }
    } else {
      msgs = await cw.messages(room.room_id, { force: 0 })
    }

    let added = 0
    if (msgs?.length) {
      added = await store.appendMessages(room.room_id, msgs.map(m => normalizeMessage(room.room_id, m)))
    }
    newTotal += added
    touched++
    state.rooms[room.room_id] = { seeded: true, lastUpdateTime: room.last_update_time, name: room.name, type: room.type }
    if (added > 0) log(`  ${room.name}: +${added}件`)
  }

  await store.saveMembers(members)

  const tasks = (await cw.myTasks({ status: 'open' })) || []
  await store.saveTasks(tasks)

  state.lastSyncAt = Math.floor(Date.now() / 1000)
  await store.saveState(state)

  return {
    rooms: rooms.length,
    touched,
    newMessages: newTotal,
    openTasks: tasks.length,
    apiRequests: cw.requestCount,
  }
}

async function main() {
  const env = loadEnv()
  if (!env.chatworkToken) {
    console.error('CHATWORK_API_TOKEN が設定されていません。')
    console.error('Chatworkの右上プロフィール →「サービス連携」→「APIトークン」で発行し、.env に追記してください。')
    console.error('詳しくは assistant/README.md を参照。')
    process.exit(1)
  }
  const full = process.argv.includes('--full')
  const roomsArg = process.argv.find(a => a.startsWith('--rooms='))
  const roomLimit = roomsArg ? Number(roomsArg.split('=')[1]) || 0 : 0

  const store = await createStore(env)
  console.error(`同期を開始します（保存先: ${store.kind === 'supabase' ? 'Supabase' : 'ローカル(data/)'}）`)
  const result = await runSync({ env, store, full, roomLimit })
  const total = await store.messageCount()
  console.error('')
  console.error(`✅ 同期完了: ${result.rooms}ルーム中${result.touched}ルームを確認、新規メッセージ ${result.newMessages}件を保存`)
  console.error(`   蓄積メッセージ合計: ${total}件 / 未完了タスク: ${result.openTasks}件 / API使用: ${result.apiRequests}リクエスト`)
  if (result.newMessages > 0) {
    console.error('   次は `npm run cw:brief` でブリーフ生成、`npm run cw:learn` でナレッジ更新ができます。')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('エラー:', e.message); process.exit(1) })
}
