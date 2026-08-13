// Chatwork記法の整形・日時ユーティリティ（すべて日本時間基準）
const TZ = 'Asia/Tokyo'

/** Chatworkの装飾タグ（[To:]や[info]等）を読みやすいテキストに変換 */
export function stripTags(body) {
  if (!body) return ''
  let t = body
  t = t.replace(/\[qtmeta[^\]]*\]/g, '')
  t = t.replace(/\[qt\]/g, '『').replace(/\[\/qt\]/g, '』')
  t = t.replace(/\[info\]\[title\]([\s\S]*?)\[\/title\]/g, '【$1】')
  t = t.replace(/\[info\]/g, '').replace(/\[\/info\]/g, '')
  t = t.replace(/\[title\]/g, '【').replace(/\[\/title\]/g, '】')
  t = t.replace(/\[To:\d+\]\s*/g, '@')
  t = t.replace(/\[rp aid=\d+[^\]]*\]\s*/g, '@')
  t = t.replace(/\[piconname:\d+\]/g, '')
  t = t.replace(/\[picon:\d+\]/g, '')
  t = t.replace(/\[hr\]/g, '――')
  t = t.replace(/\[dtext:[^\]]*\]/g, '')
  t = t.replace(/\[download:[^\]]*\]([\s\S]*?)\[\/download\]/g, '📎$1')
  t = t.replace(/\[preview[^\]]*\]/g, '')
  t = t.replace(/\[code\]/g, '').replace(/\[\/code\]/g, '')
  t = t.replace(/\[toall\]/g, '@全員 ')
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  return t
}

/** 自分宛てのメンション（[To:自分] / 自分への返信 / 全員宛て）か判定 */
export function mentionsAccount(body, accountId) {
  if (!body || accountId == null) return false
  const id = String(accountId)
  if (body.includes(`[To:${id}]`)) return true
  if (new RegExp(`\\[rp aid=${id}(?:\\s|\\])`).test(body)) return true
  if (body.includes('[toall]')) return true
  return false
}

/** 空白を潰して指定文字数に丸める */
export function truncate(s, n) {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export function nowUnix() {
  return Math.floor(Date.now() / 1000)
}

/** 'YYYY-MM-DD'（日本時間） */
export function jstYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** '8/13 18:42' 形式（日本時間） */
export function jstStamp(unixSec) {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(unixSec * 1000))
}

/** '8/13' 形式（日本時間） */
export function jstMd(unixSec) {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: TZ, month: 'numeric', day: 'numeric' }).format(new Date(unixSec * 1000))
}

/** '2026/8/14(金) 07:00' 形式（日本時間） */
export function jstHeader(date = new Date()) {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

/** 曜日 'Mon' 等（日本時間） */
export function jstWeekday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(date)
}

/** 日本時間での本日23:59:59のunix秒 */
export function jstEndOfToday(date = new Date()) {
  return Math.floor(Date.parse(`${jstYmd(date)}T23:59:59+09:00`) / 1000)
}
