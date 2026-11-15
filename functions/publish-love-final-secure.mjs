// One-article secure publisher. All private text stays inside an RSA/AES-GCM envelope
// until this trusted GitHub Actions job decrypts it using an existing Firebase service
// account private key. Never log plaintext or any key material.
import { readFileSync, existsSync } from 'node:fs';
import { createHash, constants, privateDecrypt, createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const VERSION = '20261115-final';
const encPath = 'secure-imports/love-universal-emotion-and-fidelity-20261115.final-rsa.json';
const b64 = s => Buffer.from(String(s), 'base64url');
const sha = s => createHash('sha256').update(s).digest('hex');
const sign = 'RIFF';
const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!creds.private_key) throw Error('Firebase publisher credential missing');
const envelope = JSON.parse(readFileSync(encPath, 'utf8'));
if (envelope.format !== 'RSA-OAEP-SHA256+AES-256-GCM+gzip' || envelope.articleId !== ARTICLE_ID) throw Error('Unexpected encrypted article envelope');
const key = privateDecrypt({ key: creds.private_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, b64(envelope.wrappedAesKey));
if (key.length !== 32) throw Error('Key length invalid');
const ciphertext = b64(envelope.ciphertext);
const decipher = createDecipheriv('aes-256-gcm', key, b64(envelope.iv));
decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
const compressed = Buffer.concat([decipher.update(ciphertext.subarray(0,-16)), decipher.final()]);
const clear = gunzipSync(compressed);
if (sha(clear) !== envelope.plaintextSha256 || clear.length !== envelope.plaintextLength) throw Error('Article decryption digest mismatch');
const p = JSON.parse(clear.toString('utf8'));
if (p.articleId !== ARTICLE_ID || p.slug !== ARTICLE_ID || p.accessType !== 'paid' || p.status !== 'published') throw Error('Article publication metadata mismatch');
const body = String(p.privateContent || '').trim(), preview = String(p.publicContent || '').trim();
if (body.length < 3000 || preview.length < 900 || body.includes('<!-- paid-only -->') || preview.includes('<!-- paid-only -->')) throw Error('Paid/public separation failed');
if (!body.includes('### 三、你口口聲聲講博愛') || !body.includes('### 四項心法，也要在日常生活中實踐') || !body.includes('## 我為什麼希望你讀一讀《請問愛》')) throw Error('Last revision is missing');
if ([body,preview].some(s=>s.includes('**') || s.includes('母娘'))) throw Error('Legacy formatting or deity wording remained');
if (!Array.isArray(p.expectedImagePaths) || p.expectedImagePaths.length!==6) throw Error('Six body image list invalid');
const paths=[...p.expectedImagePaths,p.coverImage,p.thumbnailImage];
if (paths.length!==8 || new Set(paths.map(x=>x.split('?')[0])).size!==8) throw Error('Expected eight distinct image assets');
const images = [...(preview + '\n' + body).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
if (images.length !== 6 || !images.every(s=>s.includes('?'+'v='+VERSION))) throw Error('Article inline image version or count mismatch');
for (const path of paths) {
  const filename=String(path).split('?')[0];
  if (!filename.startsWith('assets/articles/'+ARTICLE_ID+'/') || !filename.endsWith('.webp') || !existsSync(filename)) throw Error('Image missing: '+filename);
  const file=readFileSync(filename);if(file.subarray(0,4).toString()!==sign || file.subarray(8,12).toString()!=='WEBP') throw Error('Invalid WebP file '+filename);
}
const db = getFirestore(initializeApp({credential:cert(creds),projectId:'lyyuan03-membership'}));
const docRef=db.doc('articles/'+ARTICLE_ID);
const bodyRef=db.doc('paidArticleBodies/'+ARTICLE_ID);
const metadata=await docRef.get();
if (!metadata.exists) throw Error('Expected existing article id missing');
const old=metadata.data()||{};
if (old.status==='published' && old.accessType==='free') throw Error('Unexpected public free article; refusing replacement');
const prior=await bodyRef.get();
const prev=prior.exists ? prior.data()||{} : {};
const contentHash=sha(Buffer.from(body,'utf8'));
const newVersion=contentHash===prev.contentHash && prev.content===body ? Math.max(1, Number(prev.contentVersion||1)) : Math.max(0, Number(prev.contentVersion||0)) + 1;
const safePublic=preview+'\n\n<!-- paid-only -->';
// Always protect private body *before* updating the public article's status.
if (prev.content !== body || prev.status !== 'published') {
  await bodyRef.set({
    articleId:ARTICLE_ID, title:p.title, status:'published', active:true,
    previousContentBackup:String(prev.content||''), previousContentHashBackup:String(prev.contentHash||''),
    previousContentVersionBackup:Number(prev.contentVersion||0),
    content:body,contentHash,contentVersion:newVersion,
    source:'secure-rsa-github-publisher-20261115',updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
}
const protectedCheck=await bodyRef.get();
if (protectedCheck.data()?.content!==body || protectedCheck.data()?.status!=='published') throw Error('Private Firestore write verification failed');
const publicFields={
 id:ARTICLE_ID,slug:ARTICLE_ID,title:p.title,category:old.category||'worldly',displayCategory:old.displayCategory||'人生',series:old.series||'情愛與靈修',
 status:'published',accessType:'paid',hidden:false,systemRecord:false,
 privatePaidContent:true,paidContentHash:contentHash,paidContentVersion:newVersion,content:safePublic,
 coverImage:p.coverImage,thumbnailImage:p.thumbnailImage,thumbnailTitle:p.thumbnailTitle,
 excerpt:'從黃仁勳事件談情愛、博愛、創造力與三項靈修修煉法則，並回到家庭、事業與生活的實踐。',
 bookTitle:old.bookTitle||'請問愛：愛的真諦（上冊）',bookAuthor:old.bookAuthor||'宇色 Osel',
 bookPublisher:old.bookPublisher||'柿子文化',bookPurchaseUrl:old.bookPurchaseUrl||'https://www.books.com.tw/products/0011022589',
 updatedAt:FieldValue.serverTimestamp()
};
if(old.status!=='published'||!old.publishedAt)publicFields.publishedAt=FieldValue.serverTimestamp();
await docRef.set(publicFields,{merge:true});
const verify=await docRef.get();
const v=verify.data()||{};
if(v.accessType!=='paid'||v.status!=='published'||v.privatePaidContent!==true||v.content!==safePublic||v.paidContentHash!==contentHash||v.paidContentVersion!==newVersion)throw Error('Published metadata verification failed');
if(v.content.includes(body.slice(0,120))) throw Error('Private article leaked into public metadata');
// Preserve thumbnail settings for other posts. Update this article's dedicated entry.
const settingsRef=db.doc('articles/__article-thumbnail-settings');
const settings=(await settingsRef.get()).data()||{};
await settingsRef.set({settings:{[ARTICLE_ID]:{...(settings.settings?.[ARTICLE_ID]||{}),thumbnailImage:p.thumbnailImage}},updatedAt:FieldValue.serverTimestamp()},{merge:true});
const newSettings=(await settingsRef.get()).data()||{};
if(newSettings.settings?.[ARTICLE_ID]?.thumbnailImage!==p.thumbnailImage)throw Error('Thumbnail settings verification failed');
// Publish index must agree immediately, without waiting for someone to open admin.
const indexRef=db.doc('articleMetrics/__article-publication-status');
await indexRef.set({statuses:{[ARTICLE_ID]:{status:'published',hidden:false,systemRecord:false}},updatedAt:FieldValue.serverTimestamp()},{merge:true});
const currentIndex=(await indexRef.get()).data()||{};
if(currentIndex.statuses?.[ARTICLE_ID]?.status!=='published')throw Error('Publication index verification failed');
console.log('LOVE_FINAL_PUBLICATION_SUCCESS',JSON.stringify({id:ARTICLE_ID,status:v.status,accessType:v.accessType,privateProtected:true,bodyCharacters:body.length,previewCharacters:preview.length,privateVersion:newVersion,imageCount:images.length,allImagesVerified:true,latestMethods:true,thumbnailVerified:true,indexVerified:true}));