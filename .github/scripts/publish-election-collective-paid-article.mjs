import assert from 'node:assert/strict';
import { createDecipheriv, createHash, createPublicKey, privateDecrypt, constants } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

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
  const split = validate(payload);
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
  const report={articleId:ID,status:'published',accessType:'paid',imageCount:6,privateStored:true,publicPreviewChars:split.publicContent.length,privateChars:split.privateContent.length,version,anonymousPrivateReadStatus:guest.status,url:`https://lyyuan.tw/articles.html?id=${ID}`,publishedAt:checkPublic.fields.publishedAt?.timestampValue};
  writeFileSync('/tmp/election-member-publication-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
main().catch(err=>{console.error('Paid publication failed:',err.code||err.message);process.exitCode=1;});