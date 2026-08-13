// Chatwork API クライアント（fetchのみ・レート制限対応）
// レート制限: 300リクエスト/5分。残数はレスポンスヘッダで返る。
const sleep = ms => new Promise(r => setTimeout(r, ms))

export class ChatworkClient {
  constructor({ token, base = 'https://api.chatwork.com/v2' }) {
    if (!token) throw new Error('CHATWORK_API_TOKEN が設定されていません（.env を確認してください）')
    this.token = token
    this.base = base.replace(/\/$/, '')
    this.remaining = null // x-ratelimit-remaining
    this.resetAt = null   // x-ratelimit-reset（unix秒）
    this.requestCount = 0
  }

  async request(method, apiPath, { params, form } = {}) {
    const url = new URL(this.base + apiPath)
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== '') url.searchParams.set(k, String(v))
    }
    const headers = { 'x-chatworktoken': this.token }
    let body
    if (form) {
      body = new URLSearchParams(form).toString()
      headers['content-type'] = 'application/x-www-form-urlencoded'
    }

    for (let attempt = 1; attempt <= 5; attempt++) {
      // 残数が尽きかけていたらリセットまで待つ
      if (this.remaining !== null && this.remaining < 3 && this.resetAt) {
        const waitMs = this.resetAt * 1000 - Date.now() + 1000
        if (waitMs > 0 && waitMs < 6 * 60 * 1000) {
          console.error(`  (Chatwork APIのレート制限間近: ${Math.ceil(waitMs / 1000)}秒待機)`)
          await sleep(waitMs)
        }
      }

      let res
      try {
        res = await fetch(url, { method, headers, body })
      } catch (e) {
        if (attempt === 5) throw e
        await sleep(1000 * 2 ** attempt)
        continue
      }
      this.requestCount++
      const rem = res.headers.get('x-ratelimit-remaining')
      const reset = res.headers.get('x-ratelimit-reset')
      if (rem != null) this.remaining = Number(rem)
      if (reset != null) this.resetAt = Number(reset)

      if (res.status === 204) return null // データなし（新着メッセージ0件など）
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 5) throw new Error(`Chatwork API が混雑しています (HTTP ${res.status})。時間をおいて再実行してください。`)
        let waitMs = 1000 * 2 ** attempt
        if (res.status === 429 && this.resetAt) {
          waitMs = Math.max(waitMs, this.resetAt * 1000 - Date.now() + 1000)
        }
        await sleep(Math.min(waitMs, 6 * 60 * 1000))
        continue
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Chatwork API ${method} ${apiPath} が失敗 (HTTP ${res.status}): ${text.slice(0, 300)}`)
      }
      const text = await res.text()
      return text ? JSON.parse(text) : null
    }
    throw new Error(`Chatwork API ${method} ${apiPath}: リトライ上限に達しました`)
  }

  /** 自分のアカウント情報 */
  me() { return this.request('GET', '/me') }

  /** 参加している全ルーム一覧 */
  rooms() { return this.request('GET', '/rooms') }

  /** ルームのメンバー一覧 */
  roomMembers(roomId) { return this.request('GET', `/rooms/${roomId}/members`) }

  /**
   * ルームのメッセージ取得。
   * force=0: このAPIトークンで未取得のメッセージのみ（最大100件）
   * force=1: 未取得かどうかに関わらず最新100件
   */
  messages(roomId, { force = 0 } = {}) {
    return this.request('GET', `/rooms/${roomId}/messages`, { params: { force } })
  }

  /** 自分に割り当てられたタスク一覧 */
  myTasks({ status = 'open' } = {}) {
    return this.request('GET', '/my/tasks', { params: { status } })
  }

  /** ルームへメッセージを投稿 */
  postMessage(roomId, body, { selfUnread = 0 } = {}) {
    return this.request('POST', `/rooms/${roomId}/messages`, { form: { body, self_unread: selfUnread } })
  }
}
