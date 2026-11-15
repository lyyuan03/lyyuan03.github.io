// Surgical update of the four-method section of one paid article.
// The replacement prose is encrypted at rest; only the existing Firebase
// publisher credential decrypts it inside GitHub Actions. Never log plaintext.
import { readFileSync } from 'node:fs';
import { createHash, constants, privateDecrypt, createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const REVISION = '20261115-user-four-methods-exact-v4';
const START = '### 四項心法，也要在日常生活中實踐';
const END = '## 我為什麼希望你讀一讀《請問愛》';
const NEW_START = '## 情慾、財富與修行：四個讓能量找到出口的方法';
const ENVELOPE = 'secure-imports/love-four-methods-v4.enc.json';
const hash = x => createHash('sha256').update(x).digest('hex');
const decode = x => Buffer.from(String(x), 'base64url');
const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!creds.private_key) throw new Error('Existing publisher credential unavailable');
const envelope = JSON.parse(readFileSync(ENVELOPE, 'utf8'));
if (envelope.articleId !== ARTICLE_ID || envelope.revision !== REVISION ||
    envelope.format !== 'RSA-OAEP-SHA256+AES-256-GCM+gzip') throw new Error('Encrypted article revision identity mismatch');
const key = privateDecrypt({key:creds.private_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'}, decode(envelope.wrappedAesKey));
if (key.length !== 32) throw new Error('AES key size invalid');
const enc = decode(envelope.ciphertext);
const decipher = createDecipheriv('aes-256-gcm',key,decode(envelope.iv));
decipher.setAuthTag(enc.subarray(-16));
const raw = gunzipSync(Buffer.concat([decipher.update(enc.subarray(0,-16)),decipher.final()]));
if (raw.length !== envelope.plaintextLength || hash(raw) !== envelope.plaintextSha256) throw new Error('Private revision hash mismatch');
const p = JSON.parse(raw.toString('utf8'));
const text = String(p.replacement || '').trim();
if (p.articleId!==ARTICLE_ID || p.revision!==REVISION || p.startMarker!==START ||
    p.endMarker!==END || p.newMarker!==NEW_START || !text.startsWith(NEW_START) ||
    text.includes(START) || text.includes(END) || text.includes('**') || text.includes('母娘') ||
    text.length < 2700 || text.length > 4000 ||
    !text.includes('這裡需要分清楚兩件事：節制與壓抑。') ||
    !text.includes('老師是一面鏡子，不是能量的唯一出口。') ||
    !text.includes('放縱也不會讓能量被轉化。') ||
    ['### 開場：','### 第一點：','### 第二點：','### 第三點：','### 第四點：','### 結語：'].some(t=>text.split(t).length!==2)) {
  throw new Error('Private revision section validation failed');
}
const app = initializeApp({credential:cert(creds),projectId:'lyyuan03-membership'});
const db = getFirestore(app);
const articleRef = db.doc('articles/'+ARTICLE_ID);
const bodyRef = db.doc('paidArticleBodies/'+ARTICLE_ID);
const imageRefs = source => [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m=>m[1]);
let proof = null;
await db.runTransaction(async tx=>{
  const [articleSnap,bodySnap] = await Promise.all([tx.get(articleRef),tx.get(bodyRef)]);
  if (!articleSnap.exists || !bodySnap.exists) throw new Error('Paid article document missing');
  const a=articleSnap.data()||{}, b=bodySnap.data()||{};
  if (a.status!=='published'||a.accessType!=='paid'||a.privatePaidContent!==true||
      b.status!=='published'||b.active!==true||
      !String(a.content||'').includes('<!-- paid-only -->')) throw new Error('Paid membership or publication contract mismatch');
  const old = String(b.content||'');
  const currentHash = hash(Buffer.from(old,'utf8'));
  if (currentHash!==b.contentHash || currentHash!==a.paidContentHash) throw new Error('Existing paid content hashes disagree');
  const start = old.indexOf(START), end=old.indexOf(END);
  if (start<0 && old.includes(NEW_START)) {
    const ns=old.indexOf(NEW_START);
    if (old.slice(ns,old.indexOf(END,ns)).trim()!==text) throw new Error('Existing rewritten section differs from requested revision');
    proof={changed:false,privateVersion:b.contentVersion,privateLength:old.length,publicContent:a.content,images:imageRefs(old),cover:a.coverImage,thumbnail:a.thumbnailImage,expected:old};
    return;
  }
  if (start<0||end<=start||old.indexOf(START,start+1)!==-1||old.indexOf(END,end+1)!==-1 || old.indexOf(NEW_START)!==-1) throw new Error('Existing four-method section anchors not unique');
  const prefix=old.slice(0,start), suffix=old.slice(end);
  const oldSection=old.slice(start,end);
  if(oldSection.length < 350 || !oldSection.includes('第一') || !oldSection.includes('第四'))throw new Error('Expected old four-method block not found');
  const next=prefix+text+'\n\n'+suffix;
  if(next.slice(0,prefix.length)!==prefix||!next.endsWith(suffix)||
      JSON.stringify(imageRefs(old))!==JSON.stringify(imageRefs(next))||
      !next.includes('### 三、你口口聲聲講博愛')||next.includes('**')||next.includes('母娘')||
      !next.includes(END)||next.length<4500||next.length>14000)throw new Error('Unexpected change outside requested four-method section');
  const newHash=hash(Buffer.from(next,'utf8'));
  const version=Math.max(Number(b.contentVersion||0),Number(a.paidContentVersion||0))+1;
  tx.update(bodyRef,{
    previousContentBackup:old,
    previousContentHashBackup:b.contentHash,
    previousContentVersionBackup:Number(b.contentVersion||0),
    previousBackupAt:FieldValue.serverTimestamp(),
    content:next,contentHash:newHash,contentVersion:version,
    source:'user-provided-four-methods-20261115-v4',updatedAt:FieldValue.serverTimestamp()
  });
  tx.update(articleRef,{paidContentHash:newHash,paidContentVersion:version,updatedAt:FieldValue.serverTimestamp()});
  proof={changed:true,privateVersion:version,privateLength:next.length,publicContent:a.content,images:imageRefs(old),cover:a.coverImage,thumbnail:a.thumbnailImage,expected:next};
});
const [bSnap,aSnap]=await Promise.all([bodyRef.get(),articleRef.get()]);
const a=aSnap.data()||{},b=bSnap.data()||{};
if(b.content!==proof.expected || a.content!==proof.publicContent ||
   a.status!=='published'||a.accessType!=='paid'||a.privatePaidContent!==true||
   hash(Buffer.from(b.content||'','utf8'))!==b.contentHash || a.paidContentHash!==b.contentHash||
   Number(a.paidContentVersion)!==Number(b.contentVersion)||
   a.coverImage!==proof.cover||a.thumbnailImage!==proof.thumbnail||
   JSON.stringify(imageRefs(b.content))!==JSON.stringify(proof.images)||
   !b.content.includes(text))throw new Error('Post-publication article, image or access verification failed');
console.log('LOVE_USER_FOUR_METHODS_PUBLISHED',JSON.stringify({
   articleId:ARTICLE_ID,changed:proof.changed,articleStatus:a.status,accessType:a.accessType,
   protectedFullText:true,publicPreviewUnchanged:true,otherTextUnchanged:true,
   imagesUnchanged:true,imageCount:proof.images.length,privateVersion:b.contentVersion,
   newSectionCharacters:text.length,validated:true
}));