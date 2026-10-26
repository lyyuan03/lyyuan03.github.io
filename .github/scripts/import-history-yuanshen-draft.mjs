import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createDecipheriv,createHash,createPublicKey,privateDecrypt,constants} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const ID='historical-yuanshen-destiny-cultivation';
const hash=v=>createHash('sha256').update(v).digest('hex');
assert.equal(process.env.GITHUB_REF,'refs/heads/draft/history-yuanshen-20261026');
const service=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
assert.equal(service.project_id,'lyyuan03-membership');
const e=JSON.parse([0,1,2].map(i=>readFileSync('.github/draft-imports/history-yuanshen-20261026.enc.json.part'+String(i).padStart(2,'0'),'utf8')).join(''));
assert.equal(e.articleId,ID);
assert.equal(hash(createPublicKey(service.private_key).export({type:'spki',format:'der'})),e.recipientKeySha256);
const key=privateDecrypt({key:service.private_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(e.encryptedKey,'base64'));
const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));
decipher.setAAD(Buffer.from(ID));decipher.setAuthTag(Buffer.from(e.authTag,'base64'));
const clear=gunzipSync(Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()]));key.fill(0);
assert.equal(hash(clear),e.payloadSha256);
const payload=JSON.parse(clear);
assert.equal(payload.id,ID);assert.equal(payload.status,'draft');assert.equal(payload.accessType,'paid');
assert.equal(payload.assets.length,4);
const token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
const headers={Authorization:`Bearer ${token}`};
const base='https://firestore.googleapis.com/v1/projects/lyyuan03-membership/databases/(default)/documents';
async function request(suffix,options={}){
 const response=await fetch(base+suffix,{...options,headers:{...headers,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)});
 assert.ok(response.ok,`Firestore HTTP ${response.status}`);return response.json();
}
// Refuse to overwrite an existing article; this task only creates a new draft.
const existing=await fetch(`${base}/articles/${ID}`,{headers,signal:AbortSignal.timeout(30000)});
assert.equal(existing.status,404,'Article ID already exists; refusing overwrite.');
const bodyExisting=await fetch(`${base}/paidArticleBodies/${ID}`,{headers,signal:AbortSignal.timeout(30000)});
assert.equal(bodyExisting.status,404,'Private body already exists; refusing overwrite.');
const bucket='lyyuan03-membership.firebasestorage.app';
for(const asset of payload.assets){
 const bytes=Buffer.from(asset.data,'base64');assert.equal(hash(bytes),asset.sha256);
 assert.ok(asset.object.startsWith(`articles/${ID}/`));
 const boundary=`draft-${asset.sha256.slice(0,24)}`;
 const metadata={name:asset.object,contentType:'image/jpeg',cacheControl:'public,max-age=31536000,immutable',metadata:{firebaseStorageDownloadTokens:asset.token,articleId:ID,generationMethod:'ChatGPT-imagegen'}};
 const prefix=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`);
 const response=await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`,{method:'POST',headers:{...headers,'Content-Type':`multipart/related; boundary=${boundary}`},body:Buffer.concat([prefix,bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]),signal:AbortSignal.timeout(60000)});
 assert.ok(response.ok,`Image upload HTTP ${response.status}`);
 const visible=await fetch(asset.url,{signal:AbortSignal.timeout(30000)});
 assert.ok(visible.ok,`Image read HTTP ${visible.status}`);assert.equal(hash(Buffer.from(await visible.arrayBuffer())),asset.sha256);
}
const parts=payload.content.split('<!-- paid-only -->');assert.equal(parts.length,2);
const preview=parts[0].trim(),privateBody=parts[1].trim();assert.ok(preview.length>1000&&privateBody.length>5000);
assert.equal(hash(payload.originalText),payload.originalTextSha256);
// Formatting and inserted illustrations must not remove or rewrite original text.
const restore=payload.content.replace(/!\[[^\]]*\]\([^\n]*\)\n*/g,'').replace('<!-- paid-only -->','').replace(/^##? /gm,'').replace(/\s/g,'');
const original=payload.originalText.replace(/^##? /gm,'').replace(/\s/g,'');assert.equal(restore,original);
assert.ok(!payload.content.includes(payload.coverImage));
const now=new Date().toISOString();
const field=v=>typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:String(v)};
const articleFields={};
for(const k of ['id','slug','title','category','excerpt','coverImage','thumbnailImage','bookTitle','bookAuthor','bookPublisher','bookPurchaseUrl','bookCoverImage','relatedArticleId'])articleFields[k]=field(payload[k]);
Object.assign(articleFields,{status:field('draft'),accessType:field('paid'),privatePaidContent:field(true),content:field(`${preview}\n\n<!-- paid-only -->`),paidContentHash:field(hash(privateBody)),paidContentVersion:field(1),eventId:field(''),eventName:field(''),createdAt:{timestampValue:now},updatedAt:{timestampValue:now}});
const privateFields={articleId:field(ID),title:field(payload.title),status:field('draft'),active:field(true),content:field(privateBody),contentHash:field(hash(privateBody)),contentVersion:field(1),source:field('encrypted-github-draft-import:20261026'),createdAt:{timestampValue:now},updatedAt:{timestampValue:now}};
const root='projects/lyyuan03-membership/databases/(default)/documents';
await request(':commit',{method:'POST',body:JSON.stringify({writes:[{update:{name:`${root}/articles/${ID}`,fields:articleFields},currentDocument:{exists:false}},{update:{name:`${root}/paidArticleBodies/${ID}`,fields:privateFields},currentDocument:{exists:false}}]})});
const [a,b]=await Promise.all([request(`/articles/${ID}`),request(`/paidArticleBodies/${ID}`)]);
assert.equal(a.fields.status.stringValue,'draft');assert.equal(a.fields.accessType.stringValue,'paid');
assert.equal(b.fields.status.stringValue,'draft');assert.equal(b.fields.content.stringValue,privateBody);
assert.equal(a.fields.content.stringValue,`${preview}\n\n<!-- paid-only -->`);
assert.ok(!a.fields.publishedAt,'Draft must have no first publication time.');
const guest=await Promise.all(['articles','paidArticleBodies'].map(async c=>(await fetch(`${base}/${c}/${ID}`,{signal:AbortSignal.timeout(30000)})).status));
assert.deepEqual(guest,[403,403]);
const report={articleId:ID,status:'draft',accessType:'paid',imageCount:4,coverDimensions:[1536,864],inlineImageCount:2,thumbnailDimensions:[450,800],originalTextPreserved:true,anonymousArticleStatus:guest[0],anonymousBodyStatus:guest[1],publishedAt:null,previewUrl:`https://lyyuan.tw/articles.html?id=${ID}`,adminUrl:'https://lyyuan.tw/admin.html'};
writeFileSync('/tmp/history-yuanshen-draft-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
