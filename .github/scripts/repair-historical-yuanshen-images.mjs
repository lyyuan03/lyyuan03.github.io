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
const ASSETS = new Map([
  ["01-spirit-body.jpg", ROOT + "01-spirit-body.jpg"],
  ["02-everyday-cultivation.jpg", ROOT + "02-everyday-cultivation.jpg"],
  ["27cce1b9-4809-4686-9ee6-f7fd273d90e4.png", ROOT + "03-tianwen-ai-cleaned.png"],
  ["b13e09e5-c7fb-49cc-8a62-cf6cfcbb1f15.jpg", ROOT + "04-tianwen-original-photo.jpg"],
  ["03-tianwen-ai-cleaned.png", ROOT + "03-tianwen-ai-cleaned.png"],
  ["04-tianwen-original-photo.jpg", ROOT + "04-tianwen-original-photo.jpg"]
]);

function normalizeUrl(src) {
  return String(src || "").replace(/\\([.:/])/g, "$1");
}
function assetFor(src) {
  const normalized = normalizeUrl(src).split("?")[0];
  for (const [filename, destination] of ASSETS.entries()) {
    if (normalized.endsWith("/" + filename) || normalized === filename) return destination;
  }
  return null;
}
function repairMarkdown(content = "") {
  const hits = [];
  let output = String(content).replace(/(!\[[^\]\r\n]*\]\()([^)]+)(\))/g, (full, prefix, src, suffix) => {
    const destination = assetFor(src.trim());
    if (!destination) return full;
    hits.push({ filename: destination.split("/").pop(), changed: src !== destination });
    return prefix + destination + suffix;
  });
  // These article drafts use Markdown, but tolerate HTML image tags if any were pasted.
  output = output.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (full, prefix, src, suffix) => {
    const destination = assetFor(src);
    if (!destination) return full;
    hits.push({ filename: destination.split("/").pop(), changed: src !== destination });
    return prefix + destination + suffix;
  });
  return { content: output, hits };
}
function replaceLegacyMetadata(src, imageName) {
  const value = String(src || "");
  if (!value) return value;
  const normalized = normalizeUrl(value);
  if (/historical-yuanshen-destiny-cultivation\/(?:00-cover\.jpg|thumbnail-450x800\.jpg)(?:\?.*)?$/.test(normalized)) {
    return ROOT + imageName;
  }
  return value;
}
function selfTest() {
  const original = [
    "原文不變",
    "![插畫](https://raw\\.githubusercontent.com/lyyuan03/lyyuan03.github.io/e4d6c7f19e09ebce143204736a84c002315befaa/assets/articles/historical-yuanshen-destiny-cultivation/01-spirit-body.jpg)",
    "字序不變",
    "![AI 清晰化](https://d2ol7oe51mr4n9.cloudfront.net/user_3CC8OMVTj8bkUz71eKrO5BtBL9Y/27cce1b9-4809-4686-9ee6-f7fd273d90e4.png)",
    "![原圖](https://d2ol7oe51mr4n9.cloudfront.net/user_3CC8OMVTj8bkUz71eKrO5BtBL9Y/b13e09e5-c7fb-49cc-8a62-cf6cfcbb1f15.jpg)",
    "![另一張](https://raw\\.githubusercontent.com/lyyuan03/lyyuan03.github.io/e4d6c7f19e09ebce143204736a84c002315befaa/assets/articles/historical-yuanshen-destiny-cultivation/02-everyday-cultivation.jpg)",
    PAYWALL,
    "會員正文仍完整保留。"
  ].join("\n\n");
  const fixed = repairMarkdown(original);
  assert.equal(fixed.hits.length, 4);
  assert.ok(fixed.hits.every(x => x.changed));
  assert.ok(fixed.content.includes("原文不變") && fixed.content.includes("字序不變"));
  assert.ok(fixed.content.includes(PAYWALL) && fixed.content.endsWith("會員正文仍完整保留。"));
  assert.equal(repairMarkdown(fixed.content).content, fixed.content);
  assert.equal((fixed.content.match(/https:\/\/lyyuan\.tw\/assets\/articles\//g) || []).length, 4);
  console.log("IMAGE_REPAIR_SELF_TEST_PASSED");
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
  const publicRepair = repairMarkdown(oldPublic);
  const privateRepair = repairMarkdown(oldPrivate);
  const imageHits = [...publicRepair.hits, ...privateRepair.hits];
  const expected = ["01-spirit-body.jpg", "02-everyday-cultivation.jpg", "03-tianwen-ai-cleaned.png", "04-tianwen-original-photo.jpg"];
  for (const filename of expected) {
    assert.ok(imageHits.some(hit => hit.filename === filename),
      "Expected article illustration missing: " + filename);
  }
  assert.ok(imageHits.length <= 16, "Unexpected duplicate image count; stopping rather than rewriting.");
  const oldCover = String(pub.coverImage?.stringValue || "");
  const oldThumb = String(pub.thumbnailImage?.stringValue || "");
  const newCover = replaceLegacyMetadata(oldCover, "00-cover.jpg");
  const newThumb = replaceLegacyMetadata(oldThumb, "thumbnail-450x800.jpg");
  const publicChanged = publicRepair.content !== oldPublic || newCover !== oldCover || newThumb !== oldThumb;
  const privateChanged = privateRepair.content !== oldPrivate;
  const now = new Date().toISOString();
  const writes = [];
  const publicFields = {};
  if (publicRepair.content !== oldPublic) {
    publicFields.content = sv(publicRepair.content);
    publicFields.previousContentBackup = sv(oldPublic);
    publicFields.previousContentBackupAt = tv(now);
  }
  if (newCover !== oldCover) publicFields.coverImage = sv(newCover);
  if (newThumb !== oldThumb) publicFields.thumbnailImage = sv(newThumb);
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
  const finalCount = [...repairMarkdown(vp.content.stringValue).hits, ...repairMarkdown(vpr.content.stringValue).hits];
  for (const filename of expected) assert.ok(finalCount.some(hit => hit.filename === filename && !hit.changed));
  const report = {
    articleId: ARTICLE_ID, articleStatus: vp.status.stringValue, originalWordOrderPreserved: true,
    updatedPublicPreview: publicRepair.content !== oldPublic, updatedProtectedBody: privateChanged,
    repairedImages: expected, selfHostedAssets: true, coverHosted: newCover === ROOT + "00-cover.jpg",
    thumbnailHosted: newThumb === ROOT + "thumbnail-450x800.jpg",
    accessType: vp.accessType.stringValue, anonymousPrivateReadStatus: anonymous.status
  };
  writeFileSync("/tmp/historical-yuanshen-image-repair-proof.json", JSON.stringify(report, null, 2));
  console.log("IMAGE_REPAIR_VERIFIED", JSON.stringify(report));
}
main().catch(e => {
  console.error("IMAGE_REPAIR_HALTED",e.name, e.message);
  process.exitCode=1;
});
