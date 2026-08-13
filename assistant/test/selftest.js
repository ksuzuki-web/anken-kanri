// アシスタントのセルフテスト。Chatwork APIのモックサーバーを立てて、
// 同期 → 重複排除 → ブリーフ生成 → 投稿 → 検索 の一連の動作を検証する。
// 実行: npm run cw:test （外部通信・APIキー不要）
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { runSync } from '../sync.js'
import { buildBrief, postBrief } from '../brief.js'
import { extractTerms } from '../ask.js'
import { stripTags, mentionsAccount, jstYmd } from '../lib/cwformat.js'

const now = Math.floor(Date.now() / 1000)

// ---------------------------------------------------------------------------
// モックChatworkサーバー
// ---------------------------------------------------------------------------
const mock = {
  roomsCalls: 0,
  room11LastUpdate: now - 3600,
  posted: [],
}

const seedMessages = [
  { message_id: '101', account: { account_id: 2, name: '高井' }, body: 'A社の面接、候補者の山田さんで調整中です', send_time: now - 7200, update_time: 0 },
  { message_id: '102', account: { account_id: 3, name: '藤島' }, body: '[info][title]共有[/title]B社から新規求人きました[/info]', send_time: now - 5400, update_time: 0 },
  { message_id: '103', account: { account_id: 2, name: '高井' }, body: '[To:1]鈴木さん 承諾書の件、確認お願いします', send_time: now - 3600, update_time: 0 },
]
const incrementalMessages = [
  { message_id: '103', account: { account_id: 2, name: '高井' }, body: '[To:1]鈴木さん 承諾書の件、確認お願いします', send_time: now - 3600, update_time: 0 }, // 重複
  { message_id: '104', account: { account_id: 3, name: '藤島' }, body: 'C社との定例は金曜に変更です', send_time: now - 600, update_time: 0 },
]

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const send = (code, data) => {
    res.writeHead(code, {
      'content-type': 'application/json',
      'x-ratelimit-remaining': '290',
      'x-ratelimit-reset': String(now + 300),
    })
    res.end(data == null ? '' : JSON.stringify(data))
  }
  assert.equal(req.headers['x-chatworktoken'], 'test-token', 'APIトークンヘッダが送られていること')

  if (url.pathname === '/me') return send(200, { account_id: 1, name: '鈴木' })
  if (url.pathname === '/rooms') {
    mock.roomsCalls++
    if (mock.roomsCalls === 2) mock.room11LastUpdate = now - 600 // 2回目は更新ありに見せる
    return send(200, [
      { room_id: 11, name: '営業定例', type: 'group', last_update_time: mock.room11LastUpdate },
      { room_id: 12, name: 'マイチャット', type: 'my', last_update_time: now - 86400 },
    ])
  }
  if (url.pathname === '/rooms/11/messages') {
    const force = url.searchParams.get('force')
    if (force === '1') return send(200, seedMessages)
    return send(200, incrementalMessages)
  }
  if (url.pathname === '/rooms/12/messages' && req.method === 'GET') return send(204, null)
  if (url.pathname === '/rooms/11/members') {
    return send(200, [
      { account_id: 1, name: '鈴木', role: 'admin' },
      { account_id: 2, name: '高井', role: 'member' },
      { account_id: 3, name: '藤島', role: 'member' },
    ])
  }
  if (url.pathname === '/my/tasks') {
    return send(200, [{
      task_id: 55,
      room: { room_id: 11, name: '営業定例' },
      assigned_by_account: { account_id: 2, name: '高井' },
      body: '承諾書を回収する',
      limit_time: now - 86400, // 期限超過
      status: 'open',
    }])
  }
  if (req.method === 'POST' && /^\/rooms\/\d+\/messages$/.test(url.pathname)) {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      mock.posted.push({ path: url.pathname, body })
      send(200, { message_id: '999' })
    })
    return
  }
  send(404, { errors: ['unknown path: ' + url.pathname] })
}

// ---------------------------------------------------------------------------
// テスト本体
// ---------------------------------------------------------------------------
async function main() {
  let passed = 0
  const ok = name => { passed++; console.log(`  ✅ ${name}`) }

  // 1) 記法整形・メンション判定
  assert.equal(
    stripTags('[To:1]鈴木さん[info][title]共有[/title]本文[/info]'),
    '@鈴木さん【共有】本文')
  assert.equal(stripTags('[qt][qtmeta aid=2 time=1]引用文[/qt]あり'), '『引用文』あり')
  assert.equal(mentionsAccount('[To:1]お願いします', 1), true)
  assert.equal(mentionsAccount('[To:15]お願いします', 1), false)
  assert.equal(mentionsAccount('[rp aid=1 to=11-100]返信', 1), true)
  assert.equal(mentionsAccount('[toall]全員向け', 1), true)
  ok('Chatwork記法の整形とメンション判定')

  // 2) 質問からのキーワード抽出
  const terms = extractTerms('A社の山田さんの面接、どうなってた？')
  assert.ok(terms.some(t => t.includes('山田')), `キーワードに山田が含まれること: ${terms}`)
  assert.ok(terms.some(t => t.includes('面接')), `キーワードに面接が含まれること: ${terms}`)
  ok('質問からのキーワード抽出')

  // モックサーバー起動
  const server = http.createServer(handler)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const port = server.address().port

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-assistant-test-'))
  const env = {
    chatworkToken: 'test-token',
    chatworkApiBase: `http://127.0.0.1:${port}`,
    anthropicKey: '',
    supabaseUrl: '',
    supabaseKey: '',
    briefRoomId: '',
    dataDir: path.join(tmp, 'data'),
    knowledgeDir: path.join(tmp, 'knowledge'),
    companyContext: 'テスト会社',
  }

  try {
    const { createStore } = await import('../lib/store.js')
    const s = await createStore(env) // Supabase未設定なのでLocalStoreになる

    // 3) 初回同期（force=1でシード）
    const r1 = await runSync({ env, store: s, log: () => {} })
    assert.equal(r1.newMessages, 3, '初回同期で3件保存されること')
    assert.equal(r1.openTasks, 1, '未完了タスクが1件取得できること')
    const state1 = await s.getState()
    assert.equal(state1.me.account_id, 1)
    assert.ok(state1.rooms['11']?.seeded ?? state1.rooms[11]?.seeded, 'ルーム11がシード済みになること')
    ok('初回同期（最新100件シード＋タスク取得）')

    // 4) 2回目同期（force=0の差分取得・重複排除）
    const r2 = await runSync({ env, store: s, log: () => {} })
    assert.equal(r2.newMessages, 1, '差分同期では新規1件だけ追加されること（重複は排除）')
    assert.equal(await s.messageCount(), 4, '蓄積合計が4件になること')
    ok('差分同期と重複排除')

    // 5) 3回目同期（更新がないルームはスキップ）
    const before = (await s.getState()).rooms
    const r3 = await runSync({ env, store: s, log: () => {} })
    assert.equal(r3.newMessages, 0)
    assert.equal(r3.touched, 0, '更新のないルームはAPIを呼ばずスキップされること')
    assert.deepEqual((await s.getState()).rooms, before)
    ok('未更新ルームのスキップ')

    // 6) 検索
    const hits = await s.searchMessages(['山田'])
    assert.equal(hits.length, 1)
    assert.ok(hits[0].body.includes('山田'))
    ok('キーワード検索')

    // 7) ブリーフ生成（AIなし）
    const { text, chatworkText, stats } = await buildBrief({ env, store: s, useAi: false })
    assert.ok(text.includes('朝ブリーフ'), 'タイトルが含まれること')
    assert.ok(text.includes('営業定例'), 'ルーム名が含まれること')
    assert.ok(text.includes('承諾書'), '自分宛てメンションの本文が含まれること')
    assert.ok(/⚠.*承諾書/.test(text), '未返信メンションに⚠が付くこと')
    assert.ok(text.includes('期限超過'), '期限超過タスクが表示されること')
    assert.equal(stats.unreplied >= 1, true)
    assert.ok(chatworkText.startsWith('[info][title]'), 'Chatwork投稿用の形式になっていること')
    ok('朝ブリーフ生成（メンション・タスク・動き）')

    // 8) Chatworkへの投稿（マイチャットへ自動フォールバック）
    const roomId = await postBrief(env, s, chatworkText)
    assert.equal(String(roomId), '12', 'CHATWORK_BRIEF_ROOM_ID未設定時はマイチャットに投稿されること')
    assert.equal(mock.posted.length, 1)
    assert.ok(decodeURIComponent(mock.posted[0].body).includes('朝ブリーフ'))
    ok('Chatworkへのブリーフ投稿')

    // 9) ブリーフの履歴保存
    await s.saveDoc(`brief-${jstYmd()}`, text)
    assert.ok((await s.getDoc(`brief-${jstYmd()}`)).includes('朝ブリーフ'))
    ok('ナレッジ/履歴の保存と読み出し')

    console.log(`\n🎉 セルフテスト ${passed}項目すべて成功`)
  } finally {
    server.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch(e => {
  console.error('\n❌ セルフテスト失敗:', e.message)
  process.exit(1)
})
