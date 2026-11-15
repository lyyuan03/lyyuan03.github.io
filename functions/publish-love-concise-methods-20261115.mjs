// Secure, single-article surgical revision. Private replacement prose is stored only
// in an RSA-OAEP + AES-GCM envelope, never checked in as plaintext.
import { readFileSync } from 'node:fs';
import { constants, privateDecrypt, createDecipheriv, createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const REVISION = '20261115-concise-four-methods-v1';
const encPath = 'secure-imports/love-concise-four-methods-20261115.enc.json';
const base64url = value => Buffer.from(String(value), 'base64url');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!credentials.private_key) throw new Error('Firebase publishing credentials are missing');
const envelope = JSON.parse(readFileSync(encPath, 'utf8'));
if (envelope.format !== 'RSA-OAEP-SHA256+AES-256-GCM+gzip' || envelope.articleId !== ARTICLE_ID || envelope.revision !== REVISION) {
  throw new Error('Encrypted revision identity mismatch');
}
const aesKey = privateDecrypt({key: credentials.private_key,padding: constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},base64url(envelope.wrappedAesKey));
if (aesKey.length !== 32) throw new Error('Invalid protected revision AES key');
const cipherText = base64url(envelope.ciphertext);
const decoder = createDecipheriv('aes-256-gcm',aesKey,base64url(envelope.iv));
decoder.setAuthTag(cipherText.subarray(-16));
const compressed = Buffer.concat([decoder.update(cipherText.subarray(0,-16)),decoder.final()]);
const plaintext = gunzipSync(compressed);
if (plaintext.length !== envelope.plaintextLength || sha256(plaintext) !== envelope.plaintextSha256) {
  throw new Error('Protected revision digest mismatch');
}
const patch = JSON.parse(plaintext.toString('utf8'));
if (patch.articleId !== ARTICLE_ID || patch.revision !== REVISION ||
    patch.startMarker !== '### 四項心法，也要在日常生活中實踐' ||
    patch.endMarker !== '## 我為什麼希望你讀一讀《請問愛》' ||
    !patch.replacement.startsWith(patch.startMarker) ||
    patch.replacement.includes(patch.endMarker) ||
    patch.replacement.includes('**') || patch.replacement.includes('母娘') ||
    patch.replacement.length < 450 || patch.replacement.length > 1500) {
  throw new Error('Unexpected private revision scope or content');
}
const app = initializeApp({credential:cert(credentials),projectId:'lyyuan03-membership'});
const db = getFirestore(app);
const bodyRef = db.doc('paidArticleBodies/'+ARTICLE_ID);
const articleRef = db.doc('articles/'+ARTICLE_ID);
const images = text => [...String(text).matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(match=>match[1]);
let outcome = null;
await db.runTransaction(async tx => {
  const [bodySnap,articleSnap] = await Promise.all([tx.get(bodyRef),tx.get(articleRef)]);
  if (!bodySnap.exists || !articleSnap.exists) throw new Error('Expected published paid article is missing');
  const body = bodySnap.data() || {};
  const article = articleSnap.data() || {};
  if (article.accessType !== 'paid' || article.status !== 'published' || article.privatePaidContent !== true ||
      body.status !== 'published' || body.active !== true ||
      !String(article.content||'').includes('<!-- paid-only -->')) {
    throw new Error('Published paid-access contract changed; refuse edit');
  }
  const oldContent = String(body.content || '');
  const start = oldContent.indexOf(patch.startMarker);
  const end = oldContent.indexOf(patch.endMarker);
  if (start < 0 || end < 0 || end <= start ||
      oldContent.indexOf(patch.startMarker,start+1) !== -1 ||
      oldContent.indexOf(patch.endMarker,end+1) !== -1) {
    throw new Error('Expected section boundaries absent or duplicated');
  }
  const before = oldContent.slice(0,start);
  const after = oldContent.slice(end);
  const updated = before + patch.replacement.trim() + '\n\n' + after;
  if (oldContent.length < 3000 || updated.length < 3000 || updated.includes('**') || updated.includes('母娘') ||
      JSON.stringify(images(oldContent)) !== JSON.stringify(images(updated)) ||
      !updated.includes('### 三、你口口聲聲講博愛') ||
      !updated.includes(patch.startMarker) || !updated.includes(patch.endMarker)) {
    throw new Error('Content integrity verification failed');
  }
  if (oldContent === updated) {
    outcome = {changed:false,oldLength:oldContent.length,newLength:updated.length,version:body.contentVersion};
    return;
  }
  const currentHash = sha256(Buffer.from(oldContent,'utf8'));
  if (currentHash !== body.contentHash || (article.paidContentHash && currentHash !== article.paidContentHash)) {
    throw new Error('Paid article hash out of sync: refusing to overwrite');
  }
  const newHash = sha256(Buffer.from(updated,'utf8'));
  const version = Math.max(Number(body.contentVersion||0),Number(article.paidContentVersion||0))+1;
  tx.update(bodyRef,{
    previousContentBackup:oldContent,previousContentHashBackup:body.contentHash||'',
    previousContentVersionBackup:Number(body.contentVersion||0),previousBackupAt:FieldValue.serverTimestamp(),
    content:updated,contentHash:newHash,contentVersion:version,
    source:'secure-surgical-revision-20261115',updatedAt:FieldValue.serverTimestamp()
  });
  tx.update(articleRef,{paidContentHash:newHash,paidContentVersion:version,updatedAt:FieldValue.serverTimestamp()});
  outcome={changed:true,oldLength:oldContent.length,newLength:updated.length,version,hash:newHash};
});
const [verifiedBody,verifiedArticle]=await Promise.all([bodyRef.get(),articleRef.get()]);
const b=verifiedBody.data()||{},a=verifiedArticle.data()||{};
if (b.contentHash !== outcome.hash && outcome.changed) throw new Error('Post-commit body hash mismatch');
if (a.paidContentHash !== b.contentHash || Number(a.paidContentVersion) !== Number(b.contentVersion) ||
    a.status !== 'published' || a.accessType !== 'paid' || a.privatePaidContent !== true ||
    !String(b.content||'').includes(patch.replacement.trim()) ||
    !String(a.content||'').includes('<!-- paid-only -->')) {
  throw new Error('Post-commit protected body/public metadata verification failed');
}
console.log('LOVE_CONCISE_FOUR_METHODS_PUBLISHED',JSON.stringify({
  articleId:ARTICLE_ID,changed:outcome.changed,articleStatus:a.status,accessType:a.accessType,
  protectedBodyVerified:true,version:b.contentVersion,previousLength:outcome.oldLength,
  latestLength:outcome.newLength,imageCount:images(b.content).length,
  previewUnchanged:true,quoteAndImageReferencesPreserved:true
}));