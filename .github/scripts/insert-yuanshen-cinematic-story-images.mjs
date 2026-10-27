import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ARTICLE_ID = "historical-yuanshen-destiny-cultivation";
const PROJECT_ID = "lyyuan03-membership";
const IMAGE_ROOT = "https://lyyuan.tw/assets/articles/" + ARTICLE_ID + "/";
const YUAN_IMAGE = IMAGE_ROOT + "05-yuan-shikai-toad-legend.png";
const MARKET_IMAGE = IMAGE_ROOT + "06-night-market-woman-lucidity.png";
const PAID_MARKER = "<!-- paid-only -->";

const YUAN_ANCHOR = "小廝當場嚇得魂飛魄散，手中的玉杯掉落地面，摔得粉碎。";
const MARKET_ANCHOR = "這個案例最值得討論的地方，就是元神與後天識神之間的落差。";

const YUAN_BLOCK = [
  "![袁世凱蟾蜍元神民間傳說的 AI 電影感情境重現](" + YUAN_IMAGE + ")",
  "圖｜袁世凱的蟾蜍元神傳說：小廝進房奉茶，看見臥榻上的巨大蟾蜍，驚嚇之餘摔碎玉杯。AI 情境重現，並非真實歷史影像。"
].join("\n\n");

const MARKET_BLOCK = [
  "![夜市女子偶爾清醒的瞬間，AI 電影感情境示意](" + MARKET_IMAGE + ")",
  "圖｜夜市女子的元神與後天識神：在熙攘夜市中短暫清醒的一刻。AI 情境示意，並非當事人的真實照片。"
].join("\n\n");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stringField = (value) => ({ stringValue: String(value) });
const intField = (value) => ({ integerValue: String(value) });
const timeField = (value) => ({ timestampValue: value });
const count = (text, needle) => text.split(needle).length - 1;

function insertAfterParagraph(content, anchor, block) {
  assert.equal(count(content, anchor), 1, "A story paragraph is missing or repeated; refusing to change article.");
  const pos = content.indexOf(anchor);
  const nextBreak = content.indexOf("\n\n", pos + anchor.length);
  const end = nextBreak < 0 ? content.length : nextBreak;
  const paragraph = content.slice(content.lastIndexOf("\n\n",pos)+2,end);
  assert.ok(paragraph.includes(anchor), "Cannot uniquely identify the story paragraph.");
  // Keep everything before and after the paragraph byte-for-byte identical.
  const inserted = "\n\n" + block;
  const result = content.slice(0,end) + inserted + content.slice(end);
  assert.equal(result.replace(inserted,""), content, "Image insertion must preserve all original article text.");
  return result;
}

function migrate(content) {
  assert.ok(content.length > 500, "Protected article text appears unexpectedly short.");
  assert.ok(!content.includes(PAID_MARKER), "Private body must not contain the public paywall boundary.");
  const oldYuan = count(content,YUAN_IMAGE);
  const oldMarket = count(content,MARKET_IMAGE);
  if (oldYuan || oldMarket) {
    assert.equal(oldYuan,1,"The Yuan legend illustration is already duplicated.");
    assert.equal(oldMarket,1,"The night market illustration is already duplicated or missing.");
    assert.equal(count(content,YUAN_BLOCK),1,"Yuan image must have its intended caption once.");
    assert.equal(count(content,MARKET_BLOCK),1,"Night market image must have its intended caption once.");
    assert.ok(content.indexOf(YUAN_ANCHOR)<content.indexOf(YUAN_IMAGE));
    assert.ok(content.indexOf(MARKET_ANCHOR)<content.indexOf(MARKET_IMAGE));
    return {content,changed:false};
  }
  let updated=insertAfterParagraph(content,YUAN_ANCHOR,YUAN_BLOCK);
  updated=insertAfterParagraph(updated,MARKET_ANCHOR,MARKET_BLOCK);
  assert.equal(count(updated,YUAN_IMAGE),1);
  assert.equal(count(updated,MARKET_IMAGE),1);
  assert.ok(updated.indexOf(YUAN_ANCHOR)<updated.indexOf(YUAN_IMAGE)
    && updated.indexOf(YUAN_IMAGE)<updated.indexOf(MARKET_ANCHOR)
    && updated.indexOf(MARKET_ANCHOR)<updated.indexOf(MARKET_IMAGE));
  assert.equal(updated.replace("\n\n"+YUAN_BLOCK,"").replace("\n\n"+MARKET_BLOCK,""),content,
    "Only the two image-and-caption blocks may be added.");
  return {content:updated,changed:true};
}

function selfTest() {
  const original = [
    "# 歷史人物與元神",
    "這是前言，文字保持原樣。".repeat(20),
    "袁世凱有午睡習慣。" + YUAN_ANCHOR,
    "小廝想到了府中的老僕人，得知如何保命。",
    "## 其他修行內容",
    "有一名女子長期在某個夜市出沒。",
    "但這名女子的元神靈格很高。" + MARKET_ANCHOR,
    "身心安定與日常生活能力都不容忽視。"
  ].join("\n\n");
  const patched=migrate(original);
  assert.ok(patched.changed);
  assert.equal(count(patched.content,"05-yuan-shikai-toad-legend.png"),1);
  assert.equal(count(patched.content,"06-night-market-woman-lucidity.png"),1);
  assert.deepEqual(migrate(patched.content),{content:patched.content,changed:false});
  assert.throws(()=>migrate(original.replace(YUAN_ANCHOR,"另一段不相符的話")));
  assert.throws(()=>migrate(original+"\n\n"+YUAN_BLOCK));
  console.log("STORY_IMAGES_SELF_TEST_OK");
}

async function main() {
  if(process.argv.includes("--self-test")) return selfTest();
  assert.equal(process.env.GITHUB_REF,"refs/heads/main","Member article edits only run from protected main.");
  const service=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(service.project_id,PROJECT_ID,"Unexpected Firestore project.");
  assert.ok(service.private_key,"Publishing service account is required.");
  const token=execFileSync("gcloud",["auth","print-access-token"],{encoding:"utf8"}).trim();
  assert.ok(token,"Google access token is missing.");
  const api="https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents";
  async function request(path,{method="GET",data}={}){
    const res=await fetch(api+path,{
      method,
      headers:{
        Authorization:"Bearer "+token,
        ...(data?{"Content-Type":"application/json"}:{})
      },
      body:data?JSON.stringify(data):undefined,
      signal:AbortSignal.timeout(30000)
    });
    assert.ok(res.ok, "Firestore "+method+" failed with status "+res.status);
    return res.json();
  }
  const [publicDoc, privateDoc]=await Promise.all([
    request("/articles/"+ARTICLE_ID),
    request("/paidArticleBodies/"+ARTICLE_ID)
  ]);
  const pub=publicDoc.fields || {}, priv=privateDoc.fields || {};
  assert.ok(/蔣中正|袁世凱/.test(String(pub.title?.stringValue||"")),"Unexpected article title.");
  assert.equal(pub.accessType?.stringValue,"paid","Must preserve paid article access.");
  assert.equal(pub.privatePaidContent?.booleanValue,true,"Protected article flag missing.");
  assert.equal(priv.active?.booleanValue,true,"Protected member body not active.");
  assert.ok(["draft","published"].includes(pub.status?.stringValue));
  assert.ok(["draft","published"].includes(priv.status?.stringValue));
  const oldPublic=String(pub.content?.stringValue || "");
  const oldPrivate=String(priv.content?.stringValue || "");
  assert.ok(oldPublic.trimEnd().endsWith(PAID_MARKER),"Public preview must retain the paid boundary.");
  assert.equal(count(oldPublic,YUAN_IMAGE),0);
  assert.equal(count(oldPublic,MARKET_IMAGE),0);
  assert.equal(count(oldPrivate,YUAN_ANCHOR),1,"Yuan story must exist once in member body.");
  assert.equal(count(oldPrivate,MARKET_ANCHOR),1,"Night market story must exist once in member body.");
  const migration=migrate(oldPrivate);
  if(migration.changed){
    const version=Math.max(
      Number(priv.contentVersion?.integerValue||0),
      Number(pub.paidContentVersion?.integerValue||0)
    )+1;
    const now=new Date().toISOString();
    const hash=sha256(migration.content);
    const publicUpdate={
      paidContentHash:stringField(hash),
      paidContentVersion:intField(version),
      updatedAt:timeField(now)
    };
    const privateUpdate={
      content:stringField(migration.content),
      contentHash:stringField(hash),
      contentVersion:intField(version),
      previousContentBackup:stringField(oldPrivate),
      previousContentHashBackup:stringField(priv.contentHash?.stringValue||""),
      previousContentVersionBackup:intField(Number(priv.contentVersion?.integerValue||0)),
      previousBackupAt:timeField(now),
      updatedAt:timeField(now)
    };
    await request(":commit",{method:"POST",data:{writes:[
      {update:{name:privateDoc.name,fields:privateUpdate},
       updateMask:{fieldPaths:Object.keys(privateUpdate)},
       currentDocument:{updateTime:privateDoc.updateTime}},
      {update:{name:publicDoc.name,fields:publicUpdate},
       updateMask:{fieldPaths:Object.keys(publicUpdate)},
       currentDocument:{updateTime:publicDoc.updateTime}}
    ]}});
  }
  const [verifyPublic,verifyPrivate]=await Promise.all([
    request("/articles/"+ARTICLE_ID),
    request("/paidArticleBodies/"+ARTICLE_ID)
  ]);
  const outPublic=verifyPublic.fields||{}, outPrivate=verifyPrivate.fields||{};
  assert.equal(String(outPublic.content?.stringValue||""),oldPublic,"Public preview must not change.");
  assert.equal(String(outPrivate.content?.stringValue||""),migration.content,"Private Markdown was not persisted.");
  assert.equal(outPublic.accessType?.stringValue,"paid");
  assert.equal(outPublic.privatePaidContent?.booleanValue,true);
  assert.equal(outPublic.status?.stringValue,pub.status?.stringValue);
  assert.equal(outPrivate.status?.stringValue,priv.status?.stringValue);
  assert.equal(outPrivate.active?.booleanValue,true);
  assert.equal(count(migration.content,YUAN_IMAGE),1);
  assert.equal(count(migration.content,MARKET_IMAGE),1);
  assert.equal(outPrivate.contentHash?.stringValue,sha256(migration.content));
  assert.equal(outPublic.paidContentHash?.stringValue,sha256(migration.content));
  assert.equal(Number(outPublic.paidContentVersion?.integerValue),Number(outPrivate.contentVersion?.integerValue));
  for(const existing of ["03-tianwen-ai-cleaned.png","04-tianwen-original-photo.jpg"]){
    assert.equal(count(oldPrivate,existing),count(migration.content,existing),"Existing talisman photo cannot change.");
  }
  const unauthenticated=await fetch(api+"/paidArticleBodies/"+ARTICLE_ID,{signal:AbortSignal.timeout(20000)});
  assert.equal(unauthenticated.status,403,"Unauthenticated article body access must stay blocked.");
  const proof={
    articleId:ARTICLE_ID,
    imagesAdded:migration.changed,
    imagesStoredIn:"paidArticleBodies",
    yuanImageCount:count(migration.content,YUAN_IMAGE),
    nightMarketImageCount:count(migration.content,MARKET_IMAGE),
    existingTalismanPhotosUnchanged:true,
    allOtherArticleTextUnchanged:true,
    articleStatusPreserved:outPublic.status?.stringValue,
    memberAccess:"paid",
    unauthenticatedMemberContentHTTPStatus:unauthenticated.status,
    editorMarkdownContainsBothImages:true
  };
  writeFileSync("/tmp/historical-yuanshen-two-story-images-proof.json",JSON.stringify(proof,null,2));
  console.log("STORY_IMAGE_PUBLISH_VERIFIED",JSON.stringify(proof));
}

main().catch(err=>{
  console.error("STORY_IMAGES_PUBLISH_STOPPED",err.name,err.message);
  process.exitCode=1;
});
