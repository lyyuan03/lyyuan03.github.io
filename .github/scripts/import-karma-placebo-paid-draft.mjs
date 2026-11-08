import assert from "node:assert/strict";
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, privateDecrypt, createDecipheriv, constants } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const PROJECT = "lyyuan03-membership";
const ID = "karma-as-placebo-self-awareness";
const BRANCH = "draft/karma-placebo-20261108";
const MARKER = "<!-- paid-only -->";
const ASSET_DIR = "assets/articles/" + ID;
const INPUT = "/tmp/karma-import/karma-as-placebo-20261108.enc.json";
const IMAGE_FOLDER = "/tmp/karma-images/images";
const SHA = (x) => createHash("sha256").update(x).digest("hex");
const str = (x) => ({stringValue:String(x)});
const bool = (x) => ({booleanValue:Boolean(x)});
const int = (x) => ({integerValue:String(x)});
const timestamp = (x) => ({timestampValue:x});
const array = (items) => ({arrayValue:{values:items.map(str)}});
const fileField = (v) => v?.stringValue || "";
const integerField = (v) => Number(v?.integerValue || 0);

function decryptEnvelope() {
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(service.project_id, PROJECT, "Unexpected Firebase project");
  assert.ok(service.private_key, "Publishing service key unavailable");
  const doc = JSON.parse(readFileSync(INPUT, "utf8"));
  assert.equal(doc.format, "lyyuan-paid-article-rsa-aes-gcm-v1");
  assert.equal(doc.articleId, ID);
  const der = createPublicKey(service.private_key).export({type:"spki",format:"der"});
  assert.equal(SHA(der), doc.recipientKeySha256, "Encrypted to another publishing key");
  const secret = privateDecrypt({key:service.private_key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},Buffer.from(doc.encryptedKey,"base64"));
  try {
    const decipher = createDecipheriv("aes-256-gcm",secret,Buffer.from(doc.iv,"base64"));
    decipher.setAAD(Buffer.from(ID));
    decipher.setAuthTag(Buffer.from(doc.authTag,"base64"));
    const clear = gunzipSync(Buffer.concat([decipher.update(Buffer.from(doc.ciphertext,"base64")),decipher.final()]));
    assert.equal(SHA(clear),doc.payloadSha256,"Encrypted article integrity mismatch");
    return JSON.parse(clear.toString("utf8"));
  } finally { secret.fill(0); }
}

function stageImages(payload) {
  assert.equal(payload.imageAssets.length,7);
  mkdirSync(ASSET_DIR,{recursive:true});
  for(const a of payload.imageAssets){
    assert.match(a.filename,/^[0-9]{2}-[a-z0-9-]+\.webp$/);
    const source=join(IMAGE_FOLDER,a.filename);
    const bytes=readFileSync(source);
    assert.equal(SHA(bytes),a.sha256,"Image checksum mismatch: "+a.filename);
    assert.ok(bytes.length>30000,"Image incomplete: "+a.filename);
    copyFileSync(source,join(ASSET_DIR,a.filename));
    console.log("VERIFIED_IMAGE",a.filename,bytes.length);
  }
  execFileSync("git",["config","user.name","github-actions[bot]"]);
  execFileSync("git",["config","user.email","41898282+github-actions[bot]@users.noreply.github.com"]);
  execFileSync("git",["add",ASSET_DIR]);
  const changes=execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim();
  if(changes){
    execFileSync("git",["commit","-m","Stage seven karma paid-draft images on isolated branch"]);
    execFileSync("git",["push","origin","HEAD:"+BRANCH]);
  }
  const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const dir="https://raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/"+commit+"/"+ASSET_DIR+"/";
  return new Map(payload.imageAssets.map(a=>[a.url,dir+a.filename]));
}

async function main(){
  assert.equal(process.env.GITHUB_REF,"refs/heads/"+BRANCH,"Never import from another branch");
  const payload=decryptEnvelope();
  assert.equal(payload.id,ID);
  assert.equal(payload.slug,ID);
  assert.equal(payload.status,"draft");
  assert.equal(payload.accessType,"paid");
  assert.equal(payload.privatePaidContent,true);
  assert.ok(payload.publicContent.length>1200);
  assert.ok(payload.privateContent.length>5000);
  assert.ok(payload.privateContent.includes("## Q11｜"));
  assert.ok(payload.privateContent.includes("無極瑤池金母"));
  assert.ok(!payload.publicContent.includes(MARKER));
  assert.ok(!payload.privateContent.includes(MARKER));
  const replacements=stageImages(payload);
  let publicContent=payload.publicContent,privateContent=payload.privateContent;
  for(const [from,to] of replacements){
    publicContent=publicContent.replaceAll(from,to);
    privateContent=privateContent.replaceAll(from,to);
  }
  const imageUrls=[...replacements.values()];
  const markdownImages=[...((publicContent+"\n"+privateContent).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g))].map(m=>m[1]);
  assert.equal(markdownImages.length,6,"Exactly six inline images required");
  assert.deepEqual(new Set(markdownImages),new Set(imageUrls.slice(1)),"All inline images must be the chosen six files");
  const coverUrl=imageUrls[0];
  assert.ok(!markdownImages.includes(coverUrl),"Cover must not repeat inside body");
  const safeContent=(publicContent.trim()+"\n\n"+MARKER);
  assert.ok(!safeContent.includes("會員深度問答"),"Paid Q&A must not appear in public preview");
  const hash=SHA(Buffer.from(privateContent,"utf8"));
  const token=execFileSync("gcloud",["auth","print-access-token"],{encoding:"utf8"}).trim();
  assert.ok(token);
  const base="https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)/documents";
  const req=async(path,{method="GET",body,allow404=false}={})=>{
    const resp=await fetch(base+path,{method,headers:{"Authorization":"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
    if(allow404 && resp.status===404) return null;
    if(!resp.ok) throw Error("Firestore HTTP "+resp.status+" "+path+" : "+(await resp.text()).slice(0,700));
    return resp.json();
  };
  const pubPath="/articles/"+ID,privPath="/paidArticleBodies/"+ID;
  const [existingArticle,existingPrivate]=await Promise.all([req(pubPath,{allow404:true}),req(privPath,{allow404:true})]);
  if(existingArticle){
    assert.equal(existingArticle.fields?.status?.stringValue,"draft","Existing published article must not be overwritten");
    assert.equal(existingArticle.fields?.accessType?.stringValue,"paid","Existing nonpaid article must not be overwritten");
  }
  if(existingPrivate){
    assert.equal(existingPrivate.fields?.status?.stringValue,"draft","Existing published paid body must not be overwritten");
  }
  const oldPriv=existingPrivate?.fields||{};
  const oldHash=fileField(oldPriv.contentHash);
  const oldVersion=integerField(oldPriv.contentVersion);
  const unchanged=oldHash===hash && fileField(oldPriv.content)===privateContent;
  const version=unchanged?Math.max(1,oldVersion):oldVersion+1;
  const now=new Date().toISOString();
  const pub={
    id:str(ID),title:str(payload.title),slug:str(ID),category:str(payload.category),displayCategory:str(payload.displayCategory),
    status:str("draft"),accessType:str("paid"),privatePaidContent:bool(true),
    excerpt:str(payload.excerpt),coverImage:str(coverUrl),thumbnailImage:str(coverUrl),
    content:str(safeContent),paidContentHash:str(hash),paidContentVersion:int(version),
    series:str(payload.series),readingLevel:str(payload.readingLevel),topics:array(payload.topics),
    bookTitle:str(payload.bookTitle||""),bookAuthor:str(payload.bookAuthor||""),
    bookPublisher:str(payload.bookPublisher||""),bookPurchaseUrl:str(payload.bookPurchaseUrl||""),
    bookCoverImage:str(payload.bookCoverImage||""),eventId:str(""),eventName:str(""),
    updatedAt:timestamp(now),createdAt:existingArticle?.fields?.createdAt||timestamp(now)
  };
  const priv={
    articleId:str(ID),title:str(payload.title),status:str("draft"),active:bool(true),
    content:str(privateContent),contentHash:str(hash),contentVersion:int(version),
    source:str("github-actions-encrypted-paid-draft-20261108"),updatedAt:timestamp(now),
    createdAt:oldPriv.createdAt||timestamp(now)
  };
  if(existingPrivate&&!unchanged){
    priv.previousContentBackup=str(fileField(oldPriv.content));
    priv.previousContentHashBackup=str(oldHash);
    priv.previousContentVersionBackup=int(oldVersion);
    priv.previousBackupAt=timestamp(now);
  }
  const projectPath="projects/"+PROJECT+"/databases/(default)/documents";
  const makeWrite=(collection,fields,existing)=>{
    const w={update:{name:projectPath+"/"+collection+"/"+ID,fields},updateMask:{fieldPaths:Object.keys(fields)}};
    w.currentDocument=existing?{updateTime:existing.updateTime}:{exists:false};
    return w;
  };
  await req(":commit",{method:"POST",body:{writes:[makeWrite("articles",pub,existingArticle),makeWrite("paidArticleBodies",priv,existingPrivate)]}});
  const [verifiedArticle,verifiedPrivate]=await Promise.all([req(pubPath),req(privPath)]);
  assert.equal(fileField(verifiedArticle.fields.status),"draft");
  assert.equal(fileField(verifiedArticle.fields.accessType),"paid");
  assert.equal(verifiedArticle.fields.privatePaidContent.booleanValue,true);
  assert.equal(fileField(verifiedArticle.fields.content),safeContent);
  assert.equal(fileField(verifiedArticle.fields.coverImage),coverUrl);
  assert.equal(fileField(verifiedPrivate.fields.status),"draft");
  assert.equal(fileField(verifiedPrivate.fields.content),privateContent);
  assert.equal(fileField(verifiedPrivate.fields.contentHash),hash);
  assert.equal(integerField(verifiedPrivate.fields.contentVersion),version);
  const guest=await fetch(base+privPath,{signal:AbortSignal.timeout(15000)});
  assert.equal(guest.status,403,"The protected sponsor body must not be anonymously readable");
  const report={articleId:ID,status:"draft",accessType:"paid",privatePaidContent:true,publicPreviewChars:publicContent.length,privateContentChars:privateContent.length,inlineImageCount:markdownImages.length,coverImage:coverUrl,paidContentVersion:version,privateBodySHA256:hash,guestReadStatus:guest.status,verified:true,draftPreview:"https://lyyuan.tw/articles.html?id="+ID};
  writeFileSync("/tmp/karma-import-report.json",JSON.stringify(report,null,2));
  console.log("KARMA_DRAFT_WRITE_VERIFY_OK "+JSON.stringify(report));
}
main().catch(e=>{console.error("KARMA_DRAFT_WRITE_FAILED",String(e.stack||e));process.exitCode=1;});