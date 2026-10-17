import assert from 'node:assert/strict';
import { createDecipheriv, createHash, createPublicKey, privateDecrypt, constants } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { collectiveUnconsciousElectionPart2Article as currentStatic } from '../../article-collective-unconscious-election-part-2.js';

const ID = 'collective-unconscious-election-2026-part-2';
const TITLE = '眾心所向，時勢所生（下）：從占卜看臺灣、臺北、臺中與高雄的集體意識';
const PROJECT = 'lyyuan03-membership';
const MARKER = '<!-- paid-only -->';
const ENVELOPE = 'secure-imports/collective-unconscious-election-2026-part-2-20261017.enc.json';
const ASSET_PATH = `assets/articles/${ID}/`;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const str = value => ({ stringValue: String(value) });
const time = value => ({ timestampValue: value });
const bool = value => ({ booleanValue: Boolean(value) });
const int = value => ({ integerValue: String(Number(value)) });
const field = value => Array.isArray(value) ? ({ arrayValue: { values: value.map(str) } }) : typeof value === 'boolean' ? bool(value) : str(value);

function decrypt(envelope, privateKey) {
  assert.equal(envelope.format, 'lyyuan-paid-article-rsa-aes-gcm-v1');
  assert.equal(envelope.articleId, ID);
  const pub = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  assert.equal(sha256(pub), envelope.recipientKeySha256);
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(envelope.encryptedKey, 'base64'));
  try {
    assert.equal(key.length, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(ID));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const clear = gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]));
    assert.equal(sha256(clear), envelope.payloadSha256);
    return JSON.parse(clear.toString('utf8'));
  } finally { key.fill(0); }
}

function validate(payload) {
  assert.equal(payload.id, ID);
  assert.equal(payload.slug, ID);
  assert.equal(payload.title, TITLE);
  assert.equal(payload.category, 'worldly');
  assert.equal(payload.accessType, 'paid');
  assert.equal(payload.privatePaidContent, true);
  const parts = String(payload.content || '').split(MARKER);
  assert.equal(parts.length, 2, 'Article must have one paid-only marker.');
  const publicContent = parts[0].trim();
  const privateContent = parts[1].trim();
  assert.ok(publicContent.length > 2300 && privateContent.length > 4300);
  assert.ok(!publicContent.includes('## 臺中：'));
  assert.ok(privateContent.includes('## 臺中：') && privateContent.includes('## 高雄：'));
  assert.ok(privateContent.includes('從選舉的集體意識，看見我們自己的選擇'));
  assert.equal(payload.imageAssets.length, 6);
  const fileNames = ['00-cover.jpeg','01-taipei.jpeg','02-taichung.jpeg','03-kaohsiung.jpeg','04-conclusion.jpeg','thumbnail-450x800.jpeg'];
  for (let i = 0; i < fileNames.length; i++) {
    const asset = payload.imageAssets[i];
    assert.equal(asset.filename, fileNames[i]);
    assert.equal(asset.url, `https://lyyuan.tw/${ASSET_PATH}${fileNames[i]}`);
    assert.equal(sha256(readFileSync(ASSET_PATH + fileNames[i])), asset.sha256, `${fileNames[i]} content mismatch`);
  }
  assert.equal(payload.coverImage, payload.imageAssets[0].url);
  assert.equal(payload.thumbnailImage, payload.imageAssets[5].url);
  assert.ok(!payload.content.includes(payload.coverImage));
  const images = [...payload.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]);
  assert.deepEqual(images, payload.imageAssets.slice(1, 5).map(a => a.url));
  for (const k of ['bookTitle','bookPurchaseUrl','bookCoverImage','sharePath']) assert.ok(payload[k]);
  return { publicContent, privateContent, safeContent: `${publicContent}\n\n${MARKER}`, hash: sha256(privateContent) };
}

async function main() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only the merged main branch may publish this article.');
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
  assert.equal(service.project_id, PROJECT);
  assert.ok(service.private_key);
  const payload = decrypt(JSON.parse(readFileSync(ENVELOPE, 'utf8')), service.private_key);
  const original = validate(payload);
  // The encrypted payload remains the authority for all protected member-only text.
  // The refreshed public preview adds one real divination photo; never publish
  // private body text into a static JS file or overwrite paid article permissions.
  const publicWithPhoto = String(currentStatic.content || '').trim();
  const photoLine = '![本次臺灣地方選舉集體意識占卜的塔羅牌實拍](https://lyyuan.tw/assets/articles/collective-unconscious-election-2026-part-2/01-tarot-divination.jpeg?v=20261017-2)';
  const thumbUrl = 'https://lyyuan.tw/assets/articles/collective-unconscious-election-2026-part-2/thumbnail-taiwan-450x800.jpeg?v=20261017-2';
  assert.equal(currentStatic.id, ID);
  assert.equal(currentStatic.accessType, 'paid');
  assert.equal(currentStatic.privatePaidContent, true);
  assert.equal(currentStatic.coverImage, payload.coverImage);
  assert.equal(currentStatic.thumbnailImage, thumbUrl);
  assert.equal(publicWithPhoto.split(photoLine).length, 2, 'Exactly one real divination photo must be present.');
  assert.equal(publicWithPhoto.replace('\\n\\n' + photoLine, ''), `${original.publicContent}\\n\\n${MARKER}`, 'The original article preview may only gain one photo.');
  assert.ok(!publicWithPhoto.includes(payload.coverImage), 'Cover must not repeat in the article body.');
  const assetPhoto='collective-unconscious-election-2026-part-2';
  const newFiles=[
    ['assets/articles/' + assetPhoto + '/01-tarot-divination.jpeg', 'https://lyyuan.tw/assets/articles/' + assetPhoto + '/01-tarot-divination.jpeg?v=20261017-2'],
    ['assets/articles/' + assetPhoto + '/thumbnail-taiwan-450x800.jpeg', thumbUrl]
  ];
  assert.equal(sha256(readFileSync(newFiles[0][0])), '6c321da24e00c7092af6352ece75985838b72e3006b592fef7925d975bcb8620', 'Tarot photo differs from the original upload.');
  for (const [filepath] of newFiles) assert.ok(readFileSync(filepath).length > 20000);
  // GitHub Pages deployment is concurrent with Firestore publication.
  // Wait until both files are live and byte-identical before referencing them in Firestore.
  let live=false;
  for (let attempt=0; attempt<72 && !live; attempt++) {
    const checks=await Promise.all(newFiles.map(async ([filepath,url])=>{
      try {
        const response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});
        return response.ok && sha256(Buffer.from(await response.arrayBuffer()))===sha256(readFileSync(filepath));
      } catch {return false;}
    }));
    live=checks.every(Boolean);
    if (!live) await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.ok(live,'The verified tarot photo and new Taiwan thumbnail must be live before publication.');
  const publicContent=publicWithPhoto.slice(0, publicWithPhoto.lastIndexOf(MARKER)).trim();
  const split={...original, publicContent, safeContent:publicWithPhoto};
  const token = process.env.FIRESTORE_ACCESS_TOKEN || execFileSync('gcloud', ['auth','print-access-token'], { encoding: 'utf8' }).trim();
  assert.ok(token);
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const request = async (suffix, { method='GET', data, authenticated=true, allow404=false }={}) => {
    const res = await fetch(base+suffix, { method, headers: { ...(authenticated ? {Authorization:`Bearer ${token}`} : {}), ...(data ? {'Content-Type':'application/json'} : {}) }, body:data?JSON.stringify(data):undefined, signal:AbortSignal.timeout(30000) });
    if (allow404 && res.status===404) return null;
    assert.ok(res.ok, `Firestore request failed (HTTP ${res.status}).`);
    return res.json();
  };
  const articlePath = `/articles/${ID}`;
  const bodyPath = `/paidArticleBodies/${ID}`;
  const [priorPub, priorPrivate] = await Promise.all([request(articlePath,{allow404:true}),request(bodyPath,{allow404:true})]);
  if (priorPub) {
    assert.equal(priorPub.fields?.accessType?.stringValue,'paid','A preexisting nonpaid article must not be overwritten.');
  }
  const oldPub = priorPub?.fields||{};
  const oldPriv = priorPrivate?.fields||{};
  const same = oldPriv.contentHash?.stringValue===split.hash && oldPriv.content?.stringValue===split.privateContent;
  const oldVersion = Number(oldPriv.contentVersion?.integerValue||0);
  const version = same ? Math.max(1,oldVersion) : oldVersion+1;
  const now = new Date().toISOString();
  const pubFields = {};
  const keys = ['id','slug','title','category','displayCategory','excerpt','coverImage','thumbnailImage','thumbnailTitle','series','topics','readingLevel','sharePath','bookTitle','bookAuthor','bookPublisher','bookPurchaseUrl','bookCoverImage'];
  for(const key of keys) if(payload[key]!==undefined) pubFields[key]=field(payload[key]);
  pubFields.thumbnailImage = str(thumbUrl);
  Object.assign(pubFields,{
    status:str('published'),accessType:str('paid'),privatePaidContent:bool(true),content:str(split.safeContent),
    paidContentHash:str(split.hash),paidContentVersion:int(version),eventId:str(''),eventName:str(''),
    encryptedContent:str(''),eventIv:str(''),encryption:str(''),magicLinkAccess:{mapValue:{fields:{}}},
    updatedAt:time(now),createdAt:oldPub.createdAt?.timestampValue?oldPub.createdAt:time(now),
    publishedAt:oldPub.publishedAt?.timestampValue?oldPub.publishedAt:time(now)
  });
  const privateFields={
    ...oldPriv,articleId:str(ID),title:str(TITLE),status:str('published'),content:str(split.privateContent),
    contentHash:str(split.hash),contentVersion:int(version),active:bool(true),
    source:str('github-encrypted-paid-publication:20261017'),
    updatedAt:time(now),createdAt:oldPriv.createdAt?.timestampValue?oldPriv.createdAt:time(now)
  };
  if(priorPrivate&&!same)Object.assign(privateFields,{previousContentBackup:str(oldPriv.content?.stringValue||''),previousContentHashBackup:str(oldPriv.contentHash?.stringValue||''),previousContentVersionBackup:int(oldVersion),previousBackupAt:time(now)});
  const documentRoot=`projects/${PROJECT}/databases/(default)/documents`;
  const makeWrite=(collection,fields,prior)=>({update:{name:`${documentRoot}/${collection}/${ID}`,fields},currentDocument:prior?{updateTime:prior.updateTime}:{exists:false}});
  await request(':commit',{method:'POST',data:{writes:[makeWrite('articles',pubFields,priorPub),makeWrite('paidArticleBodies',privateFields,priorPrivate)]}});
  const [checkPublic,checkPrivate]=await Promise.all([request(articlePath),request(bodyPath)]);
  assert.equal(checkPublic.fields.content.stringValue,split.safeContent);
  assert.equal(checkPublic.fields.accessType.stringValue,'paid');
  assert.equal(checkPublic.fields.status.stringValue,'published');
  assert.equal(checkPrivate.fields.content.stringValue,split.privateContent);
  assert.equal(checkPrivate.fields.contentHash.stringValue,split.hash);
  const guest=await fetch(base+bodyPath,{signal:AbortSignal.timeout(15000)});
  assert.equal(guest.status,403,'Anonymous paid body access must be denied.');
  const report={articleId:ID,status:'published',accessType:'paid',imageCount:7,tarotPhotoFirst:true,taiwanThumbnail:true,privateStored:true,publicPreviewChars:split.publicContent.length,privateChars:split.privateContent.length,version,anonymousPrivateReadStatus:guest.status,url:`https://lyyuan.tw/articles.html?id=${ID}`,publishedAt:checkPublic.fields.publishedAt?.timestampValue};
  writeFileSync('/tmp/election-member-publication-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
main().catch(err=>{console.error('Paid publication failed:',err.code||err.message);process.exitCode=1;});