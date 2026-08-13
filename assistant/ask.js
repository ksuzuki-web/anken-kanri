// 蓄積したChatworkログ・ナレッジ・案件データを根拠に質問へ答える。
// 使い方:
//   npm run cw:ask -- "○○社の件、どうなってた？"
//   node assistant/ask.js --grep "キーワード"   … AIを使わず該当メッセージだけ表示
import { pathToFileURL } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createStore } from './lib/store.js'
import { aiEnabled, chatClaude } from './lib/claude.js'
import { fetchCandidates, summarizeAnken } from './lib/anken.js'
import { stripTags, truncate, jstStamp } from './lib/cwformat.js'

/** 質問文から検索キーワードを抜き出す（漢字・カタカナ・英数の連続を拾う） */
export function extractTerms(question) {
  const matches = question.match(/[A-Za-z0-9][A-Za-z0-9.\-]+|[一-龠々]{2,}|[ァ-ヴー]{2,}/g) || []
  const stop = new Set(['どう', 'なに', '何', 'こと', 'それ', 'これ', 'さん', 'ください', 'して', 'した', 'です', 'ます', 'ある', 'いる', '教え', '確認'])
  const seen = new Set()
  const out = []
  for (const m of matches) {
    if (stop.has(m) || seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out.slice(0, 6)
}

function formatHit(m, roomName) {
  return `[${roomName}] ${jstStamp(m.send_time)} ${m.account_name}: ${truncate(stripTags(m.body), 200)}`
}

async function main() {
  const env = loadEnv()
  const grepMode = process.argv.includes('--grep')
  const question = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ').trim()
  if (!question) {
    console.error('使い方: npm run cw:ask -- "質問文"')
    console.error('例:     npm run cw:ask -- "A社の求人の件、直近の動きは？"')
    process.exit(1)
  }

  const store = await createStore(env)
  const state = await store.getState()
  const rooms = await store.getRooms()
  const roomName = id => rooms.find(r => String(r.room_id) === String(id))?.name || state.rooms?.[id]?.name || `ルーム${id}`

  const terms = extractTerms(question)
  const hits = terms.length ? await store.searchMessages(terms, { limit: 60 }) : []

  if (grepMode || !aiEnabled(env)) {
    if (!aiEnabled(env) && !grepMode) {
      console.error('（ANTHROPIC_API_KEY が未設定のため、キーワード検索の結果のみ表示します。AI回答を使うには .env にキーを設定してください）\n')
    }
    if (!hits.length) {
      console.log(`「${terms.join(' / ')}」に該当するメッセージは見つかりませんでした。`)
      return
    }
    console.log(`該当メッセージ ${hits.length}件（新しい順・最大60件）:\n`)
    for (const m of [...hits].sort((a, b) => (b.send_time || 0) - (a.send_time || 0))) {
      console.log(formatHit(m, roomName(m.room_id)))
    }
    return
  }

  // --- AI回答用のコンテキストを組み立てる ---
  let context = ''

  const profile = await store.getDoc('company-profile')
  if (profile) context += `# 社内ナレッジ（自動生成）\n${profile.slice(0, 8000)}\n\n`

  // 質問に関係しそうなルームノートも添える
  const docKeys = await store.listDocs()
  for (const key of docKeys.filter(k => k.startsWith('room-')).slice(0, 30)) {
    const doc = await store.getDoc(key)
    if (doc && terms.some(t => doc.includes(t))) {
      context += `# ${key}\n${doc.slice(0, 4000)}\n\n`
      if (context.length > 24000) break
    }
  }

  if (hits.length) {
    context += '# 関連するChatworkメッセージ（検索結果）\n'
    for (const m of hits) {
      context += formatHit(m, roomName(m.room_id)) + '\n'
      if (context.length > 40000) break
    }
    context += '\n'
  }

  try {
    const candidates = await fetchCandidates(env)
    if (candidates) {
      const sum = summarizeAnken(candidates)
      context += `# 案件ボードの現況\n進行中${sum.activeCount}件（${sum.countsLabel}）/ 停滞${sum.alerts.length}件: ${sum.alerts.join('、') || 'なし'}\n`
      const named = candidates.filter(c => terms.some(t => (c.candidate_name || '').includes(t) || (c.company || '').includes(t)))
      for (const c of named.slice(0, 10)) {
        context += `・${c.candidate_name}（${c.company || '企業未定'} / ${c.status} / 担当${c.assigned_ca || '-'} / 面接日${c.interview_date || '-'} / 次: ${c.next_action || '-'} / メモ: ${truncate(c.memo, 100)}）\n`
      }
    }
  } catch { /* 案件ボード連携は任意機能 */ }

  const myName = state.me?.name || 'ユーザー'
  const answer = await chatClaude(env, {
    system: `あなたは${env.companyContext}の社内アシスタント「宅建Jobアシスタント」です。
${myName}さんの質問に、提供されたChatworkログ・社内ナレッジ・案件データの範囲で答えてください。
- 回答の根拠となるルーム名・日付を添える
- 手元の情報にないことは正直に「手元のログには見当たりません」と言う（推測で断定しない）
- 簡潔に。必要なら箇条書きで`,
    prompt: `# 質問\n${question}\n\n# 手元の情報\n${context || '（関連情報が見つかりませんでした）'}`,
    maxTokens: 2000,
  })

  console.log(answer)
  console.error(`\n（検索キーワード: ${terms.join(' / ') || 'なし'} / 該当メッセージ ${hits.length}件を参照）`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('エラー:', e.message); process.exit(1) })
}
