import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ARTICLE_ID = "historical-yuanshen-destiny-cultivation";
const PROJECT = "lyyuan03-membership";
const ROOT = "https://lyyuan.tw/assets/articles/" + ARTICLE_ID + "/";
const digest = content => createHash("sha256").update(content).digest("hex");
const sv = value => ({ stringValue: String(value) });
const iv = value => ({ integerValue: String(value) });
const tv = value => ({ timestampValue: value });
const PAYWALL = "<!-- paid-only -->";
const INSERTIONS = [
  { filename: "05-yuan-shikai-toad-bedroom.jpg", anchor: "沒想到，當他走近床邊時，竟然發現床上躺著的不是袁世凱，而是一隻體型巨大的蟾蜍！小廝當場嚇得魂飛魄散，手中的玉杯掉落地面，摔得粉碎。", title: "袁世凱的蟾蜍元神傳說｜AI 歷史情境示意", caption: "相傳袁世凱午睡時，小廝進房奉茶，竟看見床上躺著一隻巨大的蟾蜍，驚嚇之餘失手打碎玉杯。為了保住性命，小廝謊稱自己看見的是五爪金龍。此圖依據民間傳說，以 AI 重現故事情境，並非真實歷史影像。" },
  { filename: "06-night-market-woman.jpg", anchor: "有時，女子會突然出現短暫清醒的反應，這個狀態維持了幾分鐘，之後又恢復原本的樣子。這個案例最值得討論的地方，就是元神與後天識神之間的落差。", title: "夜市女子的元神與後天識神｜AI 情境示意", caption: "一名長期出沒於夜市的女子，平時精神狀態異常，偶爾卻會出現短暫清醒的反應。從元神修持的角度來看，這個案例呈現了元神靈格與後天識神之間的落差。此圖為 AI 情境示意，並非當事人真實照片。" }
];
const block = item => "\n\n![" + item.title + "](" + ROOT + item.filename + ")\n\n" + item.title + "\n\n" + item.caption;
function insertImages(publicContent, privateContent) {
  const original = [publicContent, privateContent];
  const output = [...original];
  for (const item of INSERTIONS) {
    const count = output.join("\n").split(item.anchor).length - 1;
    assert.equal(count, 1, "Story anchor must match exactly once: " + item.filename);
    const occurrences = output.join("\n").split(item.filename).length - 1;
    assert.ok(occurrences <= 1, "Duplicate image found: " + item.filename);
    const index = output.findIndex(content => content.includes(item.anchor));
    if (occurrences === 1) {
      assert.ok(output[index].includes(item.anchor + block(item)), "Existing image has unexpected position/caption; stop for review.");
    } else {
      output[index] = output[index].replace(item.anchor, item.anchor + block(item));
    }
  }
  output.forEach((content, index) => {
    let restored = content;
    for (const item of INSERTIONS) {
      if (!original[index].includes(item.filename)) restored = restored.replace(block(item), "");
    }
    assert.equal(restored, original[index], "Original text changed");
    assert.equal(content.split(PAYWALL).length, original[index].split(PAYWALL).length);
  });
  return output;
}
function selfTest() {
  const original = ["公開試閱\n\n" + PAYWALL, INSERTIONS.map(x => x.anchor).join("\n\n")];
  const output = insertImages(...original);
  assert.deepEqual(insertImages(...output), output);
  assert.throws(() => insertImages("", "missing anchors"));
  assert.throws(() => insertImages(original[0], original[1] + INSERTIONS[0].anchor));
  assert.throws(() => insertImages(original[0], output[1] + block(INSERTIONS[0])));
  console.log("CINEMATIC_INSERT_SELF_TEST_PASSED");
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(account.project_id, PROJECT);
  assert.ok(account.private_key);
  const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  assert.ok(token);
  const root = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
  async function request(suffix, { method = "GET", data, auth = true } = {}) {
    const response = await fetch(root + suffix, {
      method,
      headers: {
        ...(auth ? { Authorization: "Bearer " + token } : {}),
        ...(data ? { "Content-Type": "application/json" } : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    assert.ok(response.ok, "Firestore request failed (" + response.status + ")");
    return response.json();
  }

  const [pubDoc, privDoc] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const pub = pubDoc.fields || {}, priv = privDoc.fields || {};
  assert.equal(pub.accessType?.stringValue, "paid", "Article must remain paywalled.");
  assert.equal(pub.privatePaidContent?.booleanValue, true, "Protected content must remain protected.");
  assert.ok(["published", "draft"].includes(pub.status?.stringValue), "Unknown article status.");
  assert.ok(["published", "draft"].includes(priv.status?.stringValue), "Unknown protected body status.");
  assert.ok(String(pub.title?.stringValue || "").includes("蔣中正"), "Unexpected article.");
  assert.equal(priv.active?.booleanValue, true);
  const oldPublic = String(pub.content?.stringValue || "");
  const oldPrivate = String(priv.content?.stringValue || "");
  assert.ok(oldPublic.includes(PAYWALL), "Paywall boundary missing.");
  assert.ok(oldPublic.trimEnd().endsWith(PAYWALL), "Public preview must end at the paywall boundary.");
  assert.ok(oldPrivate.length > 200, "Member body cannot be empty.");
  const [nextPublic, nextPrivate] = insertImages(oldPublic, oldPrivate);
  const publicRepair = { content: nextPublic }, privateRepair = { content: nextPrivate };
  const expected = INSERTIONS.map(x => x.filename);
  const newCover = String(pub.coverImage?.stringValue || "");
  const newThumb = String(pub.thumbnailImage?.stringValue || "");
  const publicChanged = nextPublic !== oldPublic;
  const privateChanged = nextPrivate !== oldPrivate;
  const now = new Date().toISOString();
  const writes = [];
  const publicFields = {};
  if (publicRepair.content !== oldPublic) {
    publicFields.content = sv(publicRepair.content);
    publicFields.previousContentBackup = sv(oldPublic);
    publicFields.previousContentBackupAt = tv(now);
  }
  if (privateChanged) {
    const version = Math.max(Number(priv.contentVersion?.integerValue || 0),Number(pub.paidContentVersion?.integerValue || 0)) + 1;
    const nextHash = digest(privateRepair.content);
    Object.assign(publicFields, { paidContentHash: sv(nextHash), paidContentVersion: iv(version) });
    const privateFields = {
      content: sv(privateRepair.content),
      contentHash: sv(nextHash),
      contentVersion: iv(version),
      previousContentBackup: sv(oldPrivate),
      previousContentHashBackup: sv(priv.contentHash?.stringValue || ""),
      previousContentVersionBackup: iv(Number(priv.contentVersion?.integerValue || 0)),
      previousBackupAt: tv(now),
      updatedAt: tv(now)
    };
    writes.push({
      update: { name: privDoc.name, fields: privateFields },
      updateMask: { fieldPaths: Object.keys(privateFields) },
      currentDocument: { updateTime: privDoc.updateTime }
    });
  }
  if (publicChanged || privateChanged) {
    publicFields.updatedAt = tv(now);
    writes.push({
      update: { name: pubDoc.name, fields: publicFields },
      updateMask: { fieldPaths: Object.keys(publicFields) },
      currentDocument: { updateTime: pubDoc.updateTime }
    });
  }
  if (writes.length) await request(":commit", { method: "POST", data: { writes } });

  const [verifiedPub, verifiedPriv] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const vp=verifiedPub.fields, vpr=verifiedPriv.fields;
  assert.equal(vp.content.stringValue, publicRepair.content, "Public Markdown verification failed.");
  assert.equal(vpr.content.stringValue, privateRepair.content, "Member Markdown verification failed.");
  assert.equal(vp.accessType.stringValue, pub.accessType.stringValue);
  assert.equal(vp.status.stringValue, pub.status.stringValue);
  assert.equal(vpr.status.stringValue, priv.status.stringValue);
  assert.equal(vpr.active.booleanValue, true);
  assert.equal(vp.coverImage?.stringValue || "", newCover);
  assert.equal(vp.thumbnailImage?.stringValue || "", newThumb);
  assert.ok(vp.content.stringValue.trimEnd().endsWith(PAYWALL));
  if (privateChanged) {
    assert.equal(vp.paidContentHash.stringValue, digest(vpr.content.stringValue));
    assert.equal(vpr.contentHash.stringValue, digest(vpr.content.stringValue));
    assert.equal(Number(vp.paidContentVersion.integerValue), Number(vpr.contentVersion.integerValue));
  }
  const anonymous = await fetch(root + "/paidArticleBodies/" + ARTICLE_ID, { signal: AbortSignal.timeout(20000) });
  assert.equal(anonymous.status, 403, "Anonymous member body access must remain blocked.");
  assert.deepEqual(insertImages(vp.content.stringValue, vpr.content.stringValue), [nextPublic, nextPrivate]);
  for (const [before, after, changed] of [[pubDoc, verifiedPub, Object.keys(publicFields)], [privDoc, verifiedPriv, ["content", "contentHash", "contentVersion", "previousContentBackup", "previousContentHashBackup", "previousContentVersionBackup", "previousBackupAt", "updatedAt"]]]) {
    for (const [key, value] of Object.entries(before.fields)) {
      if (!changed.includes(key)) assert.deepEqual(after.fields[key], value, "Unrelated field changed: " + key);
    }
  }
  const report = {
    articleId: ARTICLE_ID, articleStatus: vp.status.stringValue, originalWordOrderPreserved: true,
    updatedPublicPreview: publicRepair.content !== oldPublic, updatedProtectedBody: privateChanged,
    repairedImages: expected, selfHostedAssets: true, coverHosted: newCover === ROOT + "00-cover.jpg",
    thumbnailHosted: newThumb === ROOT + "thumbnail-450x800.jpg",
    accessType: vp.accessType.stringValue, anonymousPrivateReadStatus: anonymous.status
  };
  writeFileSync("/tmp/historical-yuanshen-cinematic-proof.json", JSON.stringify(report, null, 2));
  console.log("CINEMATIC_INSERT_VERIFIED", JSON.stringify(report));
}
main().catch(e => {
  console.error("CINEMATIC_INSERT_HALTED",e.name, e.message);
  process.exitCode=1;
});
