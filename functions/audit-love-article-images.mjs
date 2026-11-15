import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ID = 'love-universal-emotion-and-fidelity';
const DIR = `assets/articles/${ID}/`;
const names = ['01-multiple-loves.webp', '02-emotion-born-in-contact.webp', '03-universal-love.webp', '04-choice-and-boundaries.webp', '05-patterns-and-reflection.webp', '06-reading-and-understanding.webp', 'cover.webp', 'thumbnail-450x800.webp'];
const json = (label, body) => console.log(label + ' ' + JSON.stringify(body));
const paths = (text) => [...String(text || '').matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map(m => ({ alt: m[1], src: m[2] }));
const check = async (url) => {
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, mime: res.headers.get('content-type'), size: bytes.length, webp: bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP', effectiveUrl: res.url };
  } catch (e) { return { error: String(e).slice(0, 150) }; }
};

for (const file of names) {
  const path = DIR + file;
  const bytes = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
  const self = { path, localExists: !!bytes.length, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 14) };
  const live = await check(`https://lyyuan.tw/${path}?image_audit=20261115`);
  const github = await check(`https://lyyuan03.github.io/${path}?image_audit=20261115`);
  json('ASSET', { ...self, live, github });
}

let credentials = {};
try { credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'); } catch {}
if (!credentials.private_key) { json('FIREBASE', { skipped: 'No configured credential' }); process.exit(0); }
initializeApp({ credential: cert(credentials), projectId: 'lyyuan03-membership' });
const db = getFirestore();
const article = await db.doc(`articles/${ID}`).get();
if (!article.exists) { json('ARTICLE', { exists: false }); process.exit(0); }
const a = article.data() || {};
json('ARTICLE', {
  exists: true, status: a.status, accessType: a.accessType, title: a.title,
  coverImage: a.coverImage, thumbnailImage: a.thumbnailImage,
  privatePaidContent: a.privatePaidContent,
  contentHasMemberMarker: String(a.content || '').includes('<!-- member-only -->'),
  contentHasPaidMarker: String(a.content || '').includes('<!-- paid-only -->'),
  contentLength: String(a.content || '').length,
  publicImages: paths(a.content)
});
const settingsSnap = await db.doc('articles/__article-thumbnail-settings').get();
if (settingsSnap.exists) {
  const s = settingsSnap.data() || {};
  json('SETTINGS', { thumbnailSettings: s.settings?.[ID] || null, inlineSettings: s.inlineImageSettings?.[ID] || null });
}
const privateSnap = await db.doc(`paidArticleBodies/${ID}`).get();
if (privateSnap.exists) {
  const privateData = privateSnap.data() || {};
  json('PAID_BODY', { exists: true, status: privateData.status, contentLength: String(privateData.content || '').length, images: paths(privateData.content), contentVersion: privateData.contentVersion });
} else json('PAID_BODY', { exists: false });