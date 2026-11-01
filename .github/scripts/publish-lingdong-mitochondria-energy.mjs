import assert from 'node:assert/strict';
import { createDecipheriv, createHash, createPublicKey, privateDecrypt, constants } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { lingdongMitochondriaEnergyArticle as staticArticle } from '../../article-lingdong-mitochondria-energy-public.js';

const ID = 'lingdong-mitochondria-energy';
const PROJECT = 'lyyuan03-membership';
const MARKER = '<!-- paid-only -->';
const ENVELOPE = `secure-imports/${ID}-20261101.enc.json`;
const sha = x => createHash('sha256').update(x).digest('hex');
const str = x => ({stringValue:String(x)});
const bool = x => ({booleanValue:Boolean(x)});
const int = x => ({integerValue:String(Number(x))});
const ts = x => ({timestampValue:x});
const field = x => Array.isArray(x) ? ({arrayValue:{values:x.map(field)}}) : typeof x==='boolean' ? bool(x) : str(x);

function decryptEnvelope(envelope, privateKey) {
  assert.equal(envelope.format,'lyyuan-paid-article-rsa-aes-gcm-v1');
  assert.equal(envelope.articleId,ID);
  const der=createPublicKey(privateKey).export({type:'spki',format:'der'});
  assert.equal(sha(der),envelope.recipientKeySha256,'Firestore publisher identity mismatch');
  const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.encryptedKey,'base64'));
  try {
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
    decipher.setAAD(Buffer.from(ID));
    decipher.setAuthTag(Buffer.from(envelope.authTag,'base64'));
    const plain=gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]));
    assert.equal(sha(plain),envelope.payloadSha256,'Paid content hash mismatch');
    return JSON.parse(plain.toString('utf8'));
  } finally {key.fill(0)}
}
function validate(payload) {
  assert.equal(payload.id,ID);
  assert.equal(payload.slug,ID);
  assert.equal(payload.accessType,'paid');
  assert.equal(payload.privatePaidContent,true);
  assert.equal(payload.category,'spiritual');
  assert.equal(payload.title,staticArticle.title);
  assert.equal(payload.imageAssets?.length,6);
  assert.equal(staticArticle.accessType,'paid');
  const parts=payload.content.split(MARKER);
  assert.equal(parts.length,2,'Require one public/private boundary');
  const preview=parts[0].trim(),privateBody=parts[1].trim();
  assert.ok(preview.length>1200 && privateBody.length>2000);
  assert.equal(staticArticle.content.trim(),`${preview}\n\n${MARKER}`);
  const urls=payload.imageAssets.map(x=>x.url);
  assert.equal(new Set(urls).size,6);
  for (const asset of payload.imageAssets) {
    const path=`assets/articles/${ID}/${asset.filename}`;
    const bytes=readFileSync(path);
    assert.equal(sha(bytes),asset.sha256,`Image changed: ${asset.filename}`);
    assert.equal(asset.url,`https://lyyuan.tw/${path}`);
  }
  assert.equal(payload.coverImage,urls[0]);
  assert.equal(payload.thumbnailImage,urls[5]);
  assert.ok(!payload.content.includes(payload.coverImage),'Cover repeats inside article');
  const bodyImages=[...payload.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(x=>x[1]);
  assert.deepEqual(bodyImages,urls.slice(1,5),'All four article illustrations must appear once in intended order');
  assert.ok(!privateBody.includes('000000000'), 'Prevent obvious draft placeholders');
  assert.ok(payload.bookPurchaseUrl && payload.bookCoverImage);
  return {preview,privateBody,safeContent:`${preview}\n\n${MARKER}`,hash:sha(privateBody)};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  assert.equal(process.env.GITHUB_REF,'refs/heads/main');
  const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
  assert.equal(sa.project_id,PROJECT);
  assert.ok(sa.private_key,'Missing existing Firestore service account');
  const payload=decryptEnvelope(JSON.parse(readFileSync(ENVELOPE,'utf8')),sa.private_key);
  // 出版前移除正文中多餘的 Markdown 粗體星號；保留圖片、標題與條列語法。
  payload.content = String(payload.content || '').replace(/\*\*/g, '');
  const split=validate(payload);
  // GitHub Pages deployment runs separately. Require all image bytes to exist publicly before publication.
  let imagesVerified=false;
  for(let attempt=0;attempt<90;attempt++){
    const checks=await Promise.all(payload.imageAssets.map(async asset=>{
      try{const r=await fetch(asset.url,{signal:AbortSignal.timeout(12000),cache:'no-store'});
      return r.ok && sha(Buffer.from(await r.arrayBuffer()))===asset.sha256;}catch{return false;}
    }));
    if(checks.every(Boolean)){imagesVerified=true;break;}
    await wait(5000);
  }
  assert.ok(imagesVerified,'Site image assets not all live and byte-matched. Firestore publication stopped.');
  const accessToken=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
  const base=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const req=async(path,{method='GET',data,auth=true,allow404=false}={})=>{
    const r=await fetch(base+path,{method,headers:{...(auth?{Authorization:`Bearer ${accessToken}`}:{}) ,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});
    if(allow404 && r.status===404)return null;
    assert.ok(r.ok,`Firestore HTTP ${r.status}`);
    return r.json();
  };
  const pubPath=`/articles/${ID}`;
  const privPath=`/paidArticleBodies/${ID}`;
  const [oldPub,oldPrivate]=await Promise.all([req(pubPath,{allow404:true}),req(privPath,{allow404:true})]);
  if(oldPub)assert.equal(oldPub.fields?.accessType?.stringValue,'paid','Would overwrite non-paid article');
  const now=new Date().toISOString();
  const oPub=oldPub?.fields||{},oPrivate=oldPrivate?.fields||{};
  const same=oPrivate.contentHash?.stringValue===split.hash && oPrivate.content?.stringValue===split.privateBody;
  const oldVersion=Number(oPrivate.contentVersion?.integerValue||0);
  const version=same?Math.max(1,oldVersion):oldVersion+1;
  const fields={};
  for(const key of ['id','slug','title','category','displayCategory','excerpt','coverImage','thumbnailImage','series','topics','readingLevel','sharePath','bookTitle','bookAuthor','bookPublisher','bookPurchaseUrl','bookCoverImage']) {
    if(payload[key]!==undefined)fields[key]=field(payload[key]);
  }
  Object.assign(fields,{
    status:str('published'),accessType:str('paid'),privatePaidContent:bool(true),
    content:str(split.safeContent),paidContentHash:str(split.hash),paidContentVersion:int(version),
    createdAt:oPub.createdAt?.timestampValue?oPub.createdAt:ts(now),
    publishedAt:oPub.publishedAt?.timestampValue?oPub.publishedAt:ts(now),updatedAt:ts(now)
  });
  const privateFields={...oPrivate,
    articleId:str(ID),title:str(payload.title),status:str('published'),content:str(split.privateBody),
    contentHash:str(split.hash),contentVersion:int(version),active:bool(true),
    source:str('github-encrypted-paid-publication:20261101'),updatedAt:ts(now),
    createdAt:oPrivate.createdAt?.timestampValue?oPrivate.createdAt:ts(now)
  };
  const root=`projects/${PROJECT}/databases/(default)/documents`;
  const write=(coll,data,prev)=>({update:{name:`${root}/${coll}/${ID}`,fields:data},currentDocument:prev?{updateTime:prev.updateTime}:{exists:false}});
  await req(':commit',{method:'POST',data:{writes:[write('articles',fields,oldPub),write('paidArticleBodies',privateFields,oldPrivate)]}});
  const [pub,priv]=await Promise.all([req(pubPath),req(privPath)]);
  assert.equal(pub.fields.accessType.stringValue,'paid');
  assert.equal(pub.fields.content.stringValue,split.safeContent);
  assert.equal(priv.fields.content.stringValue,split.privateBody);
  assert.equal(priv.fields.contentHash.stringValue,split.hash);
  const guest=await fetch(base+privPath,{signal:AbortSignal.timeout(20000)});
  assert.equal(guest.status,403,'Private paid article must not be anonymously readable');
  const report={id:ID,status:'published',accessType:'paid',imageCount:6,imagesVerified,publicPreviewChars:split.preview.length,privateBodyChars:split.privateBody.length,privateBodyVerified:true,guestPrivateReadStatus:guest.status,url:`https://lyyuan.tw/articles.html?id=${ID}`};
  writeFileSync('/tmp/lingdong-publication-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
main().catch(e=>{console.error('Publication blocked:',e.code||e.message);process.exitCode=1;});