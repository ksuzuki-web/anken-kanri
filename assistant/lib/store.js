// データ保存層。
// Supabase（VITE_SUPABASE_URL/KEY があり supabase_assistant.sql 実行済み）ならSupabaseに、
// それ以外はローカルファイル（data/ と knowledge/）に保存する。インターフェースは共通。
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// ローカルファイル保存
// ---------------------------------------------------------------------------
class LocalStore {
  constructor({ dataDir, knowledgeDir }) {
    this.kind = 'local'
    this.dataDir = dataDir
    this.knowledgeDir = knowledgeDir
    this.msgDir = path.join(dataDir, 'messages')
    this.kvFile = path.join(dataDir, 'kv.json')
  }

  async init() {
    fs.mkdirSync(this.msgDir, { recursive: true })
    fs.mkdirSync(this.knowledgeDir, { recursive: true })
    return this
  }

  _readKv() {
    try { return JSON.parse(fs.readFileSync(this.kvFile, 'utf8')) } catch { return {} }
  }

  async getKV(key, def = null) {
    const kv = this._readKv()
    return kv[key] ?? def
  }

  async setKV(key, value) {
    const kv = this._readKv()
    kv[key] = value
    fs.writeFileSync(this.kvFile, JSON.stringify(kv, null, 2))
  }

  _roomFile(roomId) {
    return path.join(this.msgDir, `${roomId}.jsonl`)
  }

  _readRoomMessages(roomId) {
    const file = this._roomFile(roomId)
    if (!fs.existsSync(file)) return []
    const out = []
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { out.push(JSON.parse(line)) } catch { /* 壊れた行は無視 */ }
    }
    return out
  }

  /** メッセージ追記（message_idで重複排除）。追加できた件数を返す */
  async appendMessages(roomId, msgs) {
    if (!msgs?.length) return 0
    const existing = new Set(this._readRoomMessages(roomId).map(m => String(m.message_id)))
    const fresh = msgs.filter(m => !existing.has(String(m.message_id)))
    if (!fresh.length) return 0
    const lines = fresh.map(m => JSON.stringify(m)).join('\n') + '\n'
    fs.appendFileSync(this._roomFile(roomId), lines)
    return fresh.length
  }

  async getMessagesSince(sinceUnix, { roomId } = {}) {
    const files = roomId != null
      ? [this._roomFile(roomId)].filter(f => fs.existsSync(f))
      : fs.readdirSync(this.msgDir).filter(f => f.endsWith('.jsonl')).map(f => path.join(this.msgDir, f))
    const out = []
    for (const file of files) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          const m = JSON.parse(line)
          if ((m.send_time || 0) >= sinceUnix) out.push(m)
        } catch { /* 無視 */ }
      }
    }
    out.sort((a, b) => (a.send_time || 0) - (b.send_time || 0))
    return out
  }

  /** キーワード検索（含む数でスコアリング） */
  async searchMessages(terms, { limit = 60 } = {}) {
    if (!terms?.length) return []
    const all = await this.getMessagesSince(0)
    const scored = []
    for (const m of all) {
      const body = m.body || ''
      let score = 0
      for (const t of terms) {
        if (body.includes(t)) score++
      }
      if (score > 0) scored.push({ score, m })
    }
    scored.sort((a, b) => b.score - a.score || (b.m.send_time || 0) - (a.m.send_time || 0))
    return scored.slice(0, limit).map(s => s.m)
  }

  async messageCount() {
    let n = 0
    for (const f of fs.readdirSync(this.msgDir)) {
      if (!f.endsWith('.jsonl')) continue
      const text = fs.readFileSync(path.join(this.msgDir, f), 'utf8')
      n += text.split('\n').filter(l => l.trim()).length
    }
    return n
  }

  _docFile(key) {
    return path.join(this.knowledgeDir, key.replace(/[^A-Za-z0-9._-]/g, '-') + '.md')
  }

  async saveDoc(key, content) {
    fs.writeFileSync(this._docFile(key), content)
  }

  async getDoc(key) {
    const f = this._docFile(key)
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
  }

  async listDocs() {
    return fs.readdirSync(this.knowledgeDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
  }
}

// ---------------------------------------------------------------------------
// Supabase保存（PostgREST を直接fetch。supabase_assistant.sql のテーブルを使う）
// ---------------------------------------------------------------------------
class SupabaseStore {
  constructor({ supabaseUrl, supabaseKey }) {
    this.kind = 'supabase'
    this.base = supabaseUrl.replace(/\/$/, '') + '/rest/v1'
    this.key = supabaseKey
  }

  async init() { return this }

  async _rest(method, pathq, { body, prefer } = {}) {
    const headers = {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
    }
    if (prefer) headers.prefer = prefer
    const res = await fetch(this.base + pathq, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Supabase ${method} ${pathq} が失敗 (HTTP ${res.status}): ${text.slice(0, 300)}`)
    }
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }

  /** アシスタント用テーブルが存在するか確認 */
  async probe() {
    try {
      await this._rest('GET', '/cw_state?select=key&limit=1')
      return true
    } catch {
      return false
    }
  }

  async getKV(key, def = null) {
    const rows = await this._rest('GET', `/cw_state?key=eq.${encodeURIComponent(key)}&select=value`)
    return rows?.[0]?.value ?? def
  }

  async setKV(key, value) {
    await this._rest('POST', '/cw_state?on_conflict=key', {
      body: [{ key, value, updated_at: new Date().toISOString() }],
      prefer: 'resolution=merge-duplicates',
    })
  }

  async appendMessages(roomId, msgs) {
    if (!msgs?.length) return 0
    let added = 0
    for (let i = 0; i < msgs.length; i += 400) {
      const chunk = msgs.slice(i, i + 400).map(m => ({
        room_id: Number(roomId),
        message_id: String(m.message_id),
        account_id: m.account_id ?? null,
        account_name: m.account_name ?? '',
        body: m.body ?? '',
        send_time: m.send_time ?? 0,
        update_time: m.update_time ?? 0,
      }))
      const inserted = await this._rest('POST', '/cw_messages?on_conflict=room_id,message_id', {
        body: chunk,
        prefer: 'resolution=ignore-duplicates,return=representation',
      })
      added += inserted?.length ?? 0
    }
    return added
  }

  async getMessagesSince(sinceUnix, { roomId } = {}) {
    const out = []
    const page = 1000
    for (let offset = 0; offset < 20000; offset += page) {
      let q = `/cw_messages?send_time=gte.${sinceUnix}&order=send_time.asc&limit=${page}&offset=${offset}`
      if (roomId != null) q += `&room_id=eq.${roomId}`
      const rows = await this._rest('GET', q)
      out.push(...(rows || []))
      if (!rows || rows.length < page) break
    }
    return out
  }

  async searchMessages(terms, { limit = 60 } = {}) {
    const clean = (terms || []).map(t => t.replace(/[,()*%"\\]/g, '')).filter(Boolean).slice(0, 5)
    if (!clean.length) return []
    const ors = clean.map(t => `body.ilike.*${t}*`).join(',')
    const url = new URL(this.base + '/cw_messages')
    url.searchParams.set('or', `(${ors})`)
    url.searchParams.set('order', 'send_time.desc')
    url.searchParams.set('limit', String(limit))
    const res = await fetch(url, {
      headers: { apikey: this.key, authorization: `Bearer ${this.key}` },
    })
    if (!res.ok) return []
    return res.json()
  }

  async messageCount() {
    const res = await fetch(this.base + '/cw_messages?select=message_id&limit=1', {
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        prefer: 'count=estimated',
        'range-unit': 'items',
        range: '0-0',
      },
    })
    const range = res.headers.get('content-range') || ''
    const total = range.split('/')[1]
    return total && total !== '*' ? Number(total) : 0
  }

  async saveDoc(key, content) {
    await this._rest('POST', '/cw_docs?on_conflict=key', {
      body: [{ key, content, updated_at: new Date().toISOString() }],
      prefer: 'resolution=merge-duplicates',
    })
  }

  async getDoc(key) {
    const rows = await this._rest('GET', `/cw_docs?key=eq.${encodeURIComponent(key)}&select=content`)
    return rows?.[0]?.content ?? null
  }

  async listDocs() {
    const rows = await this._rest('GET', '/cw_docs?select=key')
    return (rows || []).map(r => r.key)
  }
}

// ---------------------------------------------------------------------------
// 共通のKVラッパー（state / rooms / members / tasks）
// ---------------------------------------------------------------------------
function withHelpers(store) {
  store.getState = () => store.getKV('sync', {})
  store.saveState = s => store.setKV('sync', s)
  store.getRooms = () => store.getKV('rooms', [])
  store.saveRooms = r => store.setKV('rooms', r)
  store.getMembers = () => store.getKV('members', {})
  store.saveMembers = m => store.setKV('members', m)
  store.getTasks = () => store.getKV('my_tasks', [])
  store.saveTasks = t => store.setKV('my_tasks', t)
  return store
}

/**
 * 保存先を自動選択して初期化。
 * Supabase設定があってもテーブル未作成ならローカルにフォールバック。
 */
export async function createStore(env, { log = console.error } = {}) {
  if (env.supabaseUrl && env.supabaseKey) {
    const s = new SupabaseStore(env)
    if (await s.probe()) {
      return withHelpers(await s.init())
    }
    log('※ Supabaseにアシスタント用テーブルが見つかりません。supabase_assistant.sql をSQL Editorで実行すると、チーム共有と自動実行時のデータ永続化が有効になります。今回はローカル保存で続行します。')
  }
  const l = new LocalStore(env)
  return withHelpers(await l.init())
}

export { LocalStore, SupabaseStore }
