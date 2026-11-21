// 丙午年．無極老母至尊聖誕福壽康寧祝壽懺儀：把「緣起」之後的完整內容寫入受保護的 Firestore 文件。
// 全文以既有發布服務帳號的公鑰加密存放於 secure-imports/wuji-chanyi-2026.enc.json，
// 只在 GitHub Actions 內以既有 FIREBASE_SERVICE_ACCOUNT 解密；不得輸出明文。
// 寫入（比照 admin-zodiac-lamp.js 的生肖專屬內容格式，沿用既有 eventArticleBodies 規則，不改 firestore.rules）：
//   articles/wuji-2026-chanyi            公開外殼：已發布、隱藏、系統紀錄、content 為空
//   eventArticleBodies/wuji-2026-chanyi  受保護全文：requiredPermission = wuji-2026-chanyi
import { readFileSync } from 'node:fs';
import { createHash, constants, privateDecrypt, createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ID = 'wuji-2026-chanyi';
const REVISION = '20261121-v3-1';
const ENVELOPE = 'secure-imports/wuji-chanyi-2026.enc.json';
const TITLE = '丙午年．無極老母至尊聖誕福壽康寧祝壽懺儀・懺儀完整內容';
const hash = (x) => createHash('sha256').update(x).digest('hex');
const decode = (x) => Buffer.from(String(x), 'base64url');

const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!creds.private_key) throw new Error('Existing publisher credential unavailable');
const envelope = JSON.parse(readFileSync(ENVELOPE, 'utf8'));
if (envelope.articleId !== ID || envelope.revision !== REVISION || envelope.format !== 'RSA-OAEP-SHA256+AES-256-GCM+gzip') {
  throw new Error('Encrypted revision identity mismatch');
}
const key = privateDecrypt({ key: creds.private_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, decode(envelope.wrappedAesKey));
if (key.length !== 32) throw new Error('AES key size invalid');
const enc = decode(envelope.ciphertext);
const decipher = createDecipheriv('aes-256-gcm', key, decode(envelope.iv));
decipher.setAuthTag(enc.subarray(-16));
const raw = gunzipSync(Buffer.concat([decipher.update(enc.subarray(0, -16)), decipher.final()]));
if (raw.length !== envelope.plaintextLength || hash(raw) !== envelope.plaintextSha256) throw new Error('Private revision hash mismatch');
const p = JSON.parse(raw.toString('utf8'));
const content = String(p.content || '');
if (p.articleId !== ID || p.revision !== REVISION || p.format !== 'html-fragment'
  || content.length < 15000 || content.length > 30000
  || /<script|<style|<iframe|\son[a-z]+=|javascript:/i.test(content)
  || !['id="teaching"', 'id="deities"', 'id="causes"', 'id="schedule"', 'id="join"', 'id="ritual"', 'id="reflect"', 'id="closing"', '靈元院 敬啟'].every((m) => content.includes(m))
  || content.includes('再續靈程')) {
  throw new Error('Private revision validation failed');
}

const app = initializeApp({ credential: cert(creds), projectId: 'lyyuan03-membership' });
const db = getFirestore(app);
const shellRef = db.doc('articles/' + ID);
const bodyRef = db.doc('eventArticleBodies/' + ID);
const contentHash = hash(Buffer.from(content, 'utf8'));
await db.runTransaction(async (tx) => {
  const [shellSnap, bodySnap] = await Promise.all([tx.get(shellRef), tx.get(bodyRef)]);
  if (bodySnap.exists && bodySnap.data().contentHash === contentHash && bodySnap.data().revision === REVISION) return;
  tx.set(shellRef, {
    title: TITLE, slug: ID, status: 'published', hidden: true, systemRecord: true, systemType: 'ceremonyLayer',
    accessType: 'event', eventId: ID, requiredPermission: ID, accessBadge: '懺儀登記專屬', content: '',
    updatedAt: FieldValue.serverTimestamp(),
    ...(shellSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), publishedAt: FieldValue.serverTimestamp() })
  }, { merge: true });
  tx.set(bodyRef, {
    articleId: ID, title: TITLE, requiredPermission: ID, status: 'published', active: true,
    format: 'html-fragment', revision: REVISION, contentHash, content, updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
});
const [s, b] = await Promise.all([shellRef.get(), bodyRef.get()]);
const sd = s.data() || {}, bd = b.data() || {};
if (sd.status !== 'published' || sd.requiredPermission !== ID || sd.content !== '' || sd.hidden !== true
  || bd.requiredPermission !== ID || bd.active !== true || bd.status !== 'published' || bd.contentHash !== contentHash) {
  throw new Error('Post-write verification failed');
}
console.log(JSON.stringify({ ok: true, id: ID, revision: REVISION, contentLength: content.length, contentHash: contentHash.slice(0, 12) }));
