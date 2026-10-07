// ===== 連絡文ジェネレーター =====
// 案件の状況（ステータス・面接日・停滞日数）から、
// 求職者向け（LINE想定）と企業向け（メール想定）の文面を自動で組み立てる。
// 【 】で囲んだ部分は送信前に埋める箇所。
import { CLOSED_STATUSES, INTERVIEW_STATUSES, BRAND_NAME } from './constants'
import { toDate, daysBetween, addDays } from './forecast'

const WEEK = '日月火水木金土'

export function fmtDateJ(d) {
  const x = toDate(d)
  if (!x) return '【日付】'
  return `${x.getMonth() + 1}月${x.getDate()}日（${WEEK[x.getDay()]}）`
}
function fmtShort(d) {
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`
}
// 明日以降の平日を n 件（日程候補の例示用）
function nextBusinessDays(today, n) {
  const out = []
  for (let i = 1; out.length < n && i < 30; i++) {
    const d = addDays(today, i)
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d)
  }
  return out
}
// 「山田 太郎」→「山田様」。スペースが無ければフルネーム＋様
export function honorific(name) {
  const n = (name || '').trim()
  if (!n) return '【お名前】様'
  const parts = n.split(/[\s　]+/)
  return `${parts.length > 1 ? parts[0] : n}様`
}
const STAGE = { interview1: '一次', interview2: '二次', interviewFinal: '最終' }
const NEXT_STAGE = { interview1: '次の選考', interview2: '最終面接', interviewFinal: '内定' }

function relDay(diff) {
  if (diff === 0) return '本日'
  if (diff === 1) return '明日'
  if (diff === 2) return '明後日'
  return null
}

export function buildMessages(c, { sender, today = new Date() } = {}) {
  const me = sender || '【担当者名】'
  const name = honorific(c.candidateName)
  const fullName = (c.candidateName || '').trim() ? `${c.candidateName.trim()}様` : '【お名前】様'
  const company = (c.company || '').trim() || '【企業名】'
  const stage = STAGE[c.status] || ''
  const isInterview = INTERVIEW_STATUSES.includes(c.status)
  const iv = toDate(c.interviewDate)
  const ivDiff = iv ? daysBetween(today, iv) : null // 正=未来
  const ivDate = iv ? fmtDateJ(iv) : '【日時】'
  const changed = toDate(c.statusChangedAt)
  const daysIn = changed ? Math.max(0, daysBetween(changed, today)) : 0
  const candidates3 = nextBusinessDays(today, 3).map(fmtShort)

  const hello = `${name}\n\nお世話になっております。${BRAND_NAME}の${me}です。`
  const coHead = `${company}\n採用ご担当者様\n\nいつもお世話になっております。\n${BRAND_NAME}の${me}です。`
  const coSign = `\n\n──────────────\n${BRAND_NAME}\n${me}\n──────────────`

  const T = {}

  // ===== 求職者向け =====
  T.proposal = {
    audience: 'candidate', title: '求人のご提案',
    body: `${hello}\n先日お伺いしたご希望をもとに、${company}様の求人をご紹介させてください。\n\n■おすすめポイント\n・【ポイント1】\n・【ポイント2】\n\nご興味があれば、このまま応募の手続きを進めさせていただきます。\n気になる点があれば何でもお気軽にご連絡ください。`,
  }
  T.docSubmitted = {
    audience: 'candidate', title: '書類提出のご報告',
    body: `${hello}\n${company}様へ応募書類を提出いたしました。\n\n結果が分かり次第すぐにご連絡いたします。\n通常1週間前後で結果が出ることが多いです。\nその間に他にも気になる求人があれば、お気軽にお知らせください。`,
  }
  T.docPassed = {
    audience: 'candidate', title: '書類通過・日程調整',
    body: `${hello}\n${company}様の書類選考を通過しました！おめでとうございます。\n\n続いて面接の日程調整に進みます。\nご都合のよい日時を3つほどいただけますでしょうか。\n\n例）\n${candidates3.map(d => `・${d} 【時間帯】`).join('\n')}`,
  }
  if (isInterview) {
    T.ivConfirmed = {
      audience: 'candidate', title: '面接日程確定のご連絡',
      body: `${hello}\n${company}様の${stage}面接の日程が確定しましたのでご連絡いたします。\n\n■日時：${ivDate} 【時間】\n■場所：【住所／オンラインURL】\n■持ち物：【履歴書・職務経歴書 など】\n\n事前の面接対策も可能ですので、ご希望があればお知らせください。`,
    }
    const rel = ivDiff != null && ivDiff >= 0 ? relDay(ivDiff) : null
    T.ivReminder = {
      audience: 'candidate', title: '面接前のリマインド',
      body: `${name}\n\n${me}です。${rel ? (ivDiff > 0 ? `${rel} ${ivDate}` : rel) : ivDate}は${company}様の${stage}面接ですね。\n\n念のため最終確認です。\n・開始10分前には到着（オンラインは5分前に入室）\n・志望動機と、一番伝えたいご経験を1つ\n・逆質問を2〜3個\n\n緊張されるかと思いますが、${name.replace(/様$/, 'さん')}らしさが伝われば大丈夫です。\n終わりましたら、手応えを一言いただけると嬉しいです！`,
    }
    T.ivFollowup = {
      audience: 'candidate', title: '面接後のヒアリング',
      body: `${name}\n\n${ivDiff === 0 ? '本日' : '先日'}は${company}様の${stage}面接、お疲れさまでした！\n\nよろしければ、以下を教えていただけますか。\n1. 面接の手応え（10段階でいうと？）\n2. 印象に残った質問・やりとり\n3. 現時点での志望度（高い／普通／迷っている）\n4. 懸念点や確認したいこと\n\nいただいた内容をもとに、企業様へのフォローもさせていただきます。`,
    }
    if (c.status !== 'interviewFinal') {
      T.ivPassed = {
        audience: 'candidate', title: '選考通過のご連絡',
        body: `${name}\n\n${me}です。うれしいご報告です！\n${company}様の${stage}面接、通過となりました。おめでとうございます！\n\n次は${NEXT_STAGE[c.status]}です。日程調整を進めたいので、ご都合のよい日時を3つほどいただけますか。\n\n例）\n${candidates3.map(d => `・${d} 【時間帯】`).join('\n')}`,
      }
    }
  }
  T.rejected = {
    audience: 'candidate', title: '見送りのご連絡',
    body: `${hello}\n${company}様の選考結果ですが、残念ながら今回は見送りとのご連絡をいただきました。\n\nお力になりきれず申し訳ありません。\n今回の結果も踏まえて、より${name}に合う求人を改めてご提案させてください。\nご希望条件に変化があれば、あわせて教えていただけると助かります。`,
  }
  T.offer = {
    audience: 'candidate', title: '内定のご連絡・意向確認',
    body: `${name}\n\n${me}です。おめでとうございます！\n${company}様より内定のご連絡をいただきました！\n\n条件面（年収・入社日・勤務地など）は追って書面でご案内します。\n率直に、現時点のお気持ちはいかがでしょうか？\n不安な点や確認したいことがあれば、どんな小さなことでもお聞かせください。\n\nなお、お返事の期限は【◯月◯日】となっております。`,
  }
  T.offerPush = {
    audience: 'candidate', title: '内定承諾の後押し',
    body: `${name}\n\n${me}です。${company}様の内定の件、その後いかがでしょうか。\n\n迷われているポイントがあれば、一緒に整理させてください。\n・条件面（年収・休日・勤務地）\n・仕事内容や配属\n・ご家族のご意見\n・他社の選考状況\n\nお電話で10分ほどお話しできるとスムーズです。ご都合のよい時間を教えてください。`,
  }
  T.won = {
    audience: 'candidate', title: '入社前フォロー',
    body: `${name}\n\n${me}です。改めて、${company}様へのご入社決定おめでとうございます！\n\n入社日までに不安なことや手続きで分からないことがあれば、いつでもご連絡ください。\n入社後も、困ったことがあればお気軽にご相談くださいね。`,
  }
  T.checkin = {
    audience: 'candidate', title: 'ご様子伺い',
    body: `${hello}\nその後、転職活動の状況はいかがでしょうか。\n\n${company}様の件も含め、気になることがあればお気軽にお知らせください。\n新しい求人も随時ご紹介できますので、ご希望に変化があれば教えてください。`,
  }

  // ===== 企業向け =====
  T.coRecommend = {
    audience: 'company', title: '推薦文',
    subject: `【ご推薦】${fullName}のご紹介`,
    body: `${coHead}\n\n貴社の求人に、${fullName}をご推薦いたします。\n\n■推薦理由\n【この方を推す理由を2〜3行で】\n\n■保有資格\n・【宅地建物取引士 など】\n\n■希望条件\n・【希望年収／入社可能時期】\n\nご検討のほど、何卒よろしくお願いいたします。${coSign}`,
  }
  T.coDocResult = {
    audience: 'company', title: '書類選考結果のご確認',
    subject: `【ご確認】${fullName} 書類選考の結果について`,
    body: `${coHead}\n\n${changed ? fmtDateJ(changed) : '先日'}にご推薦いたしました${fullName}の書類選考につきまして、\nその後の進捗はいかがでしょうか。\n\nご本人も結果を心待ちにされております。\nお忙しいところ恐縮ですが、ご確認のほどよろしくお願いいたします。${coSign}`,
  }
  if (isInterview) {
    T.coSchedule = {
      audience: 'company', title: '面接日程のご調整',
      subject: `【日程調整】${fullName} ${stage}面接について`,
      body: `${coHead}\n\n${fullName}の${stage}面接につきまして、下記日程でご都合はいかがでしょうか。\n\n${candidates3.map(d => `・${d} 【時間帯】`).join('\n')}\n\n上記以外でも調整可能ですので、候補日をいただけましたら幸いです。\n何卒よろしくお願いいたします。${coSign}`,
    }
    T.coIvResult = {
      audience: 'company', title: '面接結果のご確認',
      subject: `【ご確認】${fullName} ${stage}面接の結果について`,
      body: `${coHead}\n\n${iv ? `${ivDate}に` : '先日'}${stage}面接のお時間をいただきました${fullName}につきまして、\n選考結果はいかがでしょうか。\n\nご本人からは「【面接の感想】」との声をいただいております。\n合否にかかわらず、評価いただいた点・懸念点もお聞かせいただけますと、\n今後のご紹介の精度向上に活かしてまいります。${coSign}`,
    }
  }
  T.coOffer = {
    audience: 'company', title: '内定条件のご確認',
    subject: `【ご確認】${fullName} 内定条件について`,
    body: `${coHead}\n\nこの度は${fullName}に内定のご連絡をいただき、誠にありがとうございます。\nご本人へお伝えするにあたり、以下をご教示いただけますでしょうか。\n\n・提示年収（月給・賞与の内訳）\n・入社予定日\n・配属先・勤務地\n・内定承諾の回答期限\n\n労働条件通知書をお送りいただけますと幸いです。${coSign}`,
  }

  // ===== 状況に合わせて並べる（先頭＝おすすめ）=====
  let order, recommended
  if (CLOSED_STATUSES.includes(c.status)) {
    order = c.status === 'withdrawn' ? ['checkin', 'proposal'] : ['rejected', 'checkin', 'proposal']
  } else if (c.status === 'lead') {
    order = ['proposal', 'coRecommend', 'checkin']
  } else if (c.status === 'screening') {
    order = daysIn >= 3
      ? ['coDocResult', 'docSubmitted', 'docPassed', 'rejected', 'coRecommend']
      : ['docSubmitted', 'coRecommend', 'coDocResult', 'docPassed', 'rejected']
  } else if (isInterview) {
    if (!iv) order = ['coSchedule', 'ivConfirmed', 'ivReminder']
    else if (ivDiff >= 2) order = ['ivConfirmed', 'ivReminder', 'coSchedule']
    else if (ivDiff >= 1) order = ['ivReminder', 'ivConfirmed']
    else if (ivDiff === 0) order = ['ivReminder', 'ivFollowup', 'coIvResult']
    else order = ivDiff <= -2 ? ['coIvResult', 'ivFollowup'] : ['ivFollowup', 'coIvResult']
    order = [...order, 'ivPassed', 'rejected', 'checkin']
  } else if (c.status === 'offer') {
    order = daysIn >= 3 ? ['offerPush', 'offer', 'coOffer'] : ['offer', 'coOffer', 'offerPush']
  } else if (c.status === 'won') {
    order = ['won']
  } else {
    order = ['checkin']
  }
  recommended = order[0]
  const seen = new Set()
  const list = []
  for (const id of order) {
    if (!T[id] || seen.has(id)) continue
    seen.add(id)
    list.push({ id, ...T[id], recommended: id === recommended })
  }
  return list
}

// コピー用の最終テキスト（企業向けは件名を先頭に）
export function messageText(m) {
  return m.subject ? `件名：${m.subject}\n\n${m.body}` : m.body
}

// 「件名：〜」行を分離（件名の【ご確認】などは埋める箇所ではないので本文と分けて扱う）
export function splitSubject(text) {
  const m = text.match(/^件名：(.*)\n+/)
  return m ? { subject: m[1].trim(), body: text.slice(m[0].length) } : { subject: '', body: text }
}

// 送信前に埋める必要がある【 】の数（本文のみ）
export function countPlaceholders(text) {
  return (splitSubject(text).body.match(/【[^】]*】/g) || []).length
}
