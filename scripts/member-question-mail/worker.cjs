'use strict';
const { createHash } = require('node:crypto');
const clean = (s, n = 5000) => String(s || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, n);
const digest = s => createHash('sha256').update(s).digest('hex');

function messages(id, data, user) {
  // Resolve the recipient from Firebase Auth, never accept an arbitrary address from a document.
  if (!user || user.disabled || !user.email || user.email.toLowerCase() !== String(data.email || '').toLowerCase()) return [];
  const url = `https://lyyuan.tw/articles.html?id=${encodeURIComponent(data.articleId)}`;
  const title = clean(data.articleTitle, 300);
  const question = clean(data.question, 2000);
  const reply = clean(data.reply);
  const result = [];
  if (!data.adminNotifiedAt) result.push({
    key: digest(`${id}:question`), kind: 'question',
    mail: { to: 'lyyuan03@gmail.com', replyTo: user.email,
      subject: `【會員專屬提問】${clean(title, 80)}`,
      text: `會員：${user.email}\n文章：${title}\n${url}\n\n提問：\n${question}\n\n請至管理後台回覆：https://lyyuan.tw/admin.html#member-questions` }
  });
  if (reply && (data.memberNotificationReplyHash ? data.memberNotificationReplyHash !== digest(reply) : (!data.memberNotifiedAt || (data.repliedAt?.toMillis() || 0) > data.memberNotifiedAt.toMillis()))) result.push({
    key: digest(`${id}:reply:${reply}`), kind: 'reply', replyHash: digest(reply),
    mail: { to: user.email, subject: `靈元院已回覆您的提問｜${clean(title, 80)}`,
      text: `您好：\n\n文章：${title}\n\n您的提問：\n${question}\n\n靈元院回覆：\n${reply}\n\n登入後也可查看：${url}\n\nLYY靈元院` }
  });
  return result;
}

async function deliver({ db, transport, from, doc, item, timestamp }) {
  const receipt = db.collection('_memberQuestionMail').doc(item.key);
  const claimed = await db.runTransaction(async tx => {
    if ((await tx.get(receipt)).exists) return false;
    tx.create(receipt, { status: 'sending', questionId: doc.id, kind: item.kind, startedAt: timestamp() });
    return true;
  });
  if (!claimed) return false;
  // SMTP and Firestore cannot commit atomically. Never retry an uncertain delivery automatically.
  // A crash leaves 'sending'; SMTP errors leave 'review-required'. Owner checks Gmail before retrying.
  try {
    const info = await transport.sendMail({ ...item.mail, from, messageId: `<${item.key}@lyyuan.tw>` });
    if (!info.accepted?.length || info.rejected?.length) throw new Error('SMTP did not accept recipient');
    const batch = db.batch();
    batch.update(receipt, { status: 'sent', sentAt: timestamp() });
    batch.update(doc.ref, { [item.kind === 'question' ? 'adminNotifiedAt' : 'memberNotifiedAt']: timestamp(),
      ...(item.kind === 'reply' ? { memberNotificationReplyHash: item.replyHash } : {}) });
    await batch.commit();
    return true;
  } catch {
    await receipt.update({ status: 'review-required', updatedAt: timestamp() });
    throw new Error('Delivery requires owner review; inspect _memberQuestionMail (no automatic retry).');
  }
}

async function main() {
  const dependencies = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
  const { initializeApp, applicationDefault } = dependencies('firebase-admin/app');
  const { getFirestore, FieldValue, FieldPath } = dependencies('firebase-admin/firestore');
  const { getAuth } = dependencies('firebase-admin/auth');
  const nodemailer = dependencies('nodemailer');
  initializeApp({ credential: applicationDefault(), projectId: 'lyyuan03-membership' });
  const db = getFirestore();
  const auth = getAuth();
  const dryRun = process.env.SEND_MEMBER_QUESTION_MAIL !== 'true';
  let transport, from;
  if (!dryRun) {
    let config;
    try { config = JSON.parse(process.env.SMTP_CONFIG || '{}'); } catch { throw new Error('Invalid SMTP_CONFIG JSON'); }
    if (!config.host || !config.user || !config.pass) throw new Error('Owner must configure GitHub Actions SMTP_CONFIG secret. No mail sent.');
    transport = nodemailer.createTransport({ host: config.host, port: Number(config.port || 465), secure: config.secure !== false,
      auth: { user: config.user, pass: config.pass }, logger: false, debug: false,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
    from = config.from || `LYY靈元院行政團隊 <${config.user}>`;
    await transport.verify();
  }
  const stateRef = db.collection('_memberQuestionMail').doc('_cursor');
  let cursor = dryRun ? undefined : (await stateRef.get()).data()?.lastId;
  let scanned = 0, pending = 0, sent = 0;
  while (scanned < 500) {
    let query = db.collection('memberQuestions').orderBy(FieldPath.documentId()).limit(Math.min(200, 500 - scanned));
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) { cursor = ''; break; }
    for (const doc of page.docs) {
      scanned++;
      const data = doc.data();
      let user;
      try { user = await auth.getUser(data.uid); } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-uid') continue;
        throw new Error('Unable to verify question recipient in Firebase Auth');
      }
      for (const item of messages(doc.id, data, user)) {
        pending++;
        if (!dryRun && await deliver({ db, transport, from, doc, item, timestamp: () => FieldValue.serverTimestamp() })) sent++;
      }
    }
    cursor = page.docs.at(-1).id;
  }
  if (!dryRun) await stateRef.set({ lastId: cursor || '', updatedAt: FieldValue.serverTimestamp() });
  console.log(JSON.stringify({ dryRun, scanned, pending, sent }));
  transport?.close();
}
module.exports = { messages, deliver };
if (require.main === module) main().catch(() => {
  // Never print SMTP errors, configuration, email addresses or question/reply content into public logs.
  console.error('Member question mail failed. Check SMTP_CONFIG, service account permissions and delivery receipts.');
  process.exitCode = 1;
});
