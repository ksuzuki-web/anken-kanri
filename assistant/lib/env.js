// .env の読み込みと設定の一元管理（依存パッケージなし）
// プロジェクト直下の .env と、実行時の環境変数（GitHub Actionsのsecrets等）の両方に対応。
// 環境変数が優先。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

export function loadEnv() {
  const fileEnv = parseEnvFile(path.join(ROOT, '.env'))
  const get = (...names) => {
    for (const n of names) {
      if (process.env[n] != null && process.env[n] !== '') return process.env[n]
      if (fileEnv[n] != null && fileEnv[n] !== '') return fileEnv[n]
    }
    return ''
  }
  return {
    // Chatwork
    chatworkToken: get('CHATWORK_API_TOKEN'),
    chatworkApiBase: get('CHATWORK_API_BASE') || 'https://api.chatwork.com/v2',
    briefRoomId: get('CHATWORK_BRIEF_ROOM_ID'),
    // Claude（AI機能。未設定でも同期・検索・ブリーフの基本機能は動く）
    anthropicKey: get('ANTHROPIC_API_KEY'),
    anthropicApiBase: get('ANTHROPIC_API_BASE') || 'https://api.anthropic.com',
    model: get('ASSISTANT_MODEL') || 'claude-sonnet-5',
    lightModel: get('ASSISTANT_LIGHT_MODEL') || 'claude-haiku-4-5-20251001',
    // Supabase（案件管理アプリと同じプロジェクトを使い回す）
    supabaseUrl: get('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    supabaseKey: get('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'),
    // 保存先（通常は変更不要。テスト時に上書きする）
    dataDir: get('ASSISTANT_DATA_DIR') || path.join(ROOT, 'data'),
    knowledgeDir: get('ASSISTANT_KNOWLEDGE_DIR') || path.join(ROOT, 'knowledge'),
    // AIに渡す会社の前提知識（必要なら .env で上書き）
    companyContext: get('ASSISTANT_COMPANY_CONTEXT') ||
      '不動産業界特化の人材紹介サービス「宅建Jobエージェント」を運営する会社。' +
      'CA（キャリアアドバイザー）の鈴木・高井・藤島を中心としたユニットで、候補者の選考進捗を案件管理アプリで共有している。',
  }
}
