'use strict';
// 付費文章會員到期通知信：不部署 Cloud Functions，由 GitHub Actions 每小時掃描，以 SMTP 寄出。
// 每一期到期只寄一封（_memberExpiryMail/{sha256} 為寄送紀錄）；寄信後不自動重試不確定的寄送。
const { createHash } = require('node:crypto');

const GRACE_DAYS = 7; // 與 functions/article-window.js 的 ARTICLE_WINDOW_GRACE_DAYS 相同
const DAY_MS = 24 * 60 * 60 * 1000;
const SITE_URL = 'https://lyyuan.tw';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const clean = (value, limit = 200) => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, limit);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function baseActive(record, email) {
  return normalizeEmail(record.email || email) === email
    && record.status === 'active'
    && record.paymentStatus === 'paid'
    && record.disabled !== true
    && record.suspended !== true
    && !record.revokedAt;
}

// 回傳 { label, expiresAt }；不是「有文章閱讀資格的付費會員」則回傳 null。
function articleMembership(collection, record = {}, email = '') {
  if (!baseActive(record, email)) return null;
  const expiresAt = toDate(record.expiresAt);
  if (!expiresAt) return null;
  if (collection === 'sponsorMemberAccess') {
    if (record.memberType !== 'sponsor-member' || record.articleAccess !== true) return null;
    return { label: '贊助專屬文章會員', expiresAt };
  }
  const lingji = record.memberLevel === 'lingji';
  if (record.memberType !== 'wellness-channel' || record.wellnessAccess !== true) return null;
  if (!['wellness', 'lingji'].includes(record.memberLevel)) return null;
  if (!(lingji || record.articleAccess === true)) return null;
  return { label: lingji ? '靈極會員' : '養生頻道會員', expiresAt };
}

// 找出「剛到期、仍在 7 天寬限期內」且尚未通知的會員資格。
function expiredMemberships(email, records, now = new Date()) {
  const memberships = Object.entries(records)
    .map(([collection, record]) => ({ collection, ...(articleMembership(collection, record, email) || {}), name: record?.name }))
    .filter((item) => item.expiresAt);
  // 另一種會員仍有效時，閱讀資格沒有中斷，不寄信。
  if (memberships.some((item) => item.expiresAt > now)) return [];
  return memberships.filter((item) => now - item.expiresAt <= GRACE_DAYS * DAY_MS);
}

function buildMail(email, item) {
  const expiredOn = formatDate(item.expiresAt);
  const graceUntil = formatDate(new Date(item.expiresAt.getTime() + GRACE_DAYS * DAY_MS));
  const name = clean(item.name, 40);
  const greeting = name ? `${name}　師兄/師姐您好：` : '師兄/師姐您好：';
  const key = digest(`${item.collection}:${email}:${item.expiresAt.getTime()}`);
  return {
    key,
    mail: {
      to: email,
      subject: `【靈元院】您的${item.label}資格已於 ${expiredOn} 到期`,
      text: `${greeting}

您的「靈元院${item.label}」資格已於 ${expiredOn} 到期，目前無法閱讀付費文章。

${graceUntil} 前重新加入：沿用原本的閱讀範圍，原本可以讀的文章，重新加入後就能繼續讀。
超過 ${graceUntil} 才重新加入：會從重新加入當天重新起算，可閱讀往前 30 天內發表的文章。

重新加入請至會員中心：
${SITE_URL}/member-dashboard.html

如果您已經完成付款，卻仍看到這封信，請直接回覆本信，由行政團隊協助確認。

祝福吉祥　母娘保佑
靈元院行政團隊`
    }
  };
}

async function deliver({ db, transport, from, item, email, timestamp }) {
  const receipt = db.collection('_memberExpiryMail').doc(item.key);
  const claimed = await db.runTransaction(async (tx) => {
    if ((await tx.get(receipt)).exists) return false;
    tx.create(receipt, { status: 'sending', collection: item.collection, startedAt: timestamp() });
    return true;
  });
  if (!claimed) return false;
  // SMTP 與 Firestore 無法原子提交：寄送結果不確定時保留紀錄，不自動重寄。
  try {
    const info = await transport.sendMail({ ...item.mail, from, messageId: `<${item.key}@lyyuan.tw>` });
    if (!info.accepted?.length || info.rejected?.length) throw new Error('SMTP did not accept recipient');
    await receipt.update({ status: 'sent', sentAt: timestamp() });
    return true;
  } catch {
    await receipt.update({ status: 'review-required', updatedAt: timestamp() });
    throw new Error('Delivery requires owner review; inspect _memberExpiryMail (no automatic retry).');
  }
}

async function main() {
  const dependencies = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
  const { initializeApp, applicationDefault } = dependencies('firebase-admin/app');
  const { getFirestore, FieldValue } = dependencies('firebase-admin/firestore');
  const nodemailer = dependencies('nodemailer');
  initializeApp({ credential: applicationDefault(), projectId: 'lyyuan03-membership' });
  const db = getFirestore();
  const dryRun = process.env.SEND_MEMBER_EXPIRY_MAIL !== 'true';
  let transport;
  let from;
  let smtpStatus = 'not-checked';
  // 只回報錯誤代碼（例如 EAUTH、ECONNECTION），不輸出帳號、密碼、主機或信箱。
  const safeCode = (error) => String(error?.code || error?.responseCode || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);
  let config = {};
  try { config = JSON.parse(process.env.SMTP_CONFIG || '{}'); } catch { config = null; }
  if (!dryRun) {
    if (config === null) throw new Error('Invalid SMTP_CONFIG JSON');
    if (!config.host || !config.user || !config.pass) throw new Error('Owner must configure GitHub Actions SMTP_CONFIG secret. No mail sent.');
  }
  if (config && config.host && config.user && config.pass) {
    transport = nodemailer.createTransport({
      host: config.host, port: Number(config.port || 465), secure: config.secure !== false,
      auth: { user: config.user, pass: config.pass }, logger: false, debug: false,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000
    });
    from = config.from || `LYY靈元院行政團隊 <${config.user}>`;
    try { await transport.verify(); smtpStatus = 'ok'; } catch (error) {
      smtpStatus = `failed:${safeCode(error)}`;
      if (!dryRun) { console.error(JSON.stringify({ smtp: smtpStatus })); throw new Error('SMTP verify failed'); }
    }
  } else {
    smtpStatus = config === null ? 'invalid-config-json' : 'not-configured';
  }

  const [sponsorSnapshot, wellnessSnapshot] = await Promise.all([
    db.collection('sponsorMemberAccess').get(),
    db.collection('memberAccess').get()
  ]);
  const byEmail = new Map();
  for (const doc of sponsorSnapshot.docs) byEmail.set(normalizeEmail(doc.id), { ...(byEmail.get(normalizeEmail(doc.id)) || {}), sponsorMemberAccess: doc.data() });
  for (const doc of wellnessSnapshot.docs) byEmail.set(normalizeEmail(doc.id), { ...(byEmail.get(normalizeEmail(doc.id)) || {}), memberAccess: doc.data() });

  const now = new Date();
  let candidates = 0;
  let pending = 0;
  let sent = 0;
  for (const [email, records] of byEmail) {
    for (const entry of expiredMemberships(email, records, now)) {
      candidates++;
      const item = { ...buildMail(email, entry), collection: entry.collection };
      if (dryRun) { pending++; continue; }
      const receiptExists = (await db.collection('_memberExpiryMail').doc(item.key).get()).exists;
      if (receiptExists) continue;
      pending++;
      if (await deliver({ db, transport, from, item, email, timestamp: () => FieldValue.serverTimestamp() })) sent++;
    }
  }
  // 紀錄只輸出總數，不輸出信箱或內容。
  console.log(JSON.stringify({ dryRun, smtp: smtpStatus, members: byEmail.size, candidates, pending, sent }));
  transport?.close();
}

module.exports = { GRACE_DAYS, articleMembership, expiredMemberships, buildMail, deliver };
if (require.main === module) main().catch(() => {
  console.error('Member expiry mail failed. Check SMTP_CONFIG, service account permissions and delivery receipts.');
  process.exitCode = 1;
});
