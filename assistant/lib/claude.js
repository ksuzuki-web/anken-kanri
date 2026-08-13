// Claude API クライアント（fetchのみ）。AI機能はANTHROPIC_API_KEYがある場合だけ有効。
const sleep = ms => new Promise(r => setTimeout(r, ms))

export function aiEnabled(env) {
  return Boolean(env.anthropicKey)
}

/**
 * Claudeに1回問い合わせてテキストを返す。
 * @param {object} env loadEnv()の戻り値
 * @param {object} opts { system, prompt, model, maxTokens }
 */
export async function chatClaude(env, { system, prompt, model, maxTokens = 3000 }) {
  if (!env.anthropicKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')
  const payload = {
    model: model || env.model,
    max_tokens: maxTokens,
    system: system || undefined,
    messages: [{ role: 'user', content: prompt }],
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(env.anthropicApiBase + '/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      if (attempt === 4) throw new Error(`Claude API が混雑しています (HTTP ${res.status})`)
      await sleep(2000 * 2 ** attempt)
      continue
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Claude API が失敗 (HTTP ${res.status}): ${text.slice(0, 300)}`)
    }
    const data = await res.json()
    return (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()
  }
  throw new Error('Claude API: リトライ上限に達しました')
}
