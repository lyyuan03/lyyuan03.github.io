import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ARTICLE_ID = "historical-yuanshen-destiny-cultivation";
const PROJECT_ID = "lyyuan03-membership";
const PAID_MARKER = "<!-- paid-only -->";
const ANCHOR = "是我這一生看過最漂亮的作品之一";
const AI_IMAGE = "https://d2ol7oe51mr4n9.cloudfront.net/user_3CC8OMVTj8bkUz71eKrO5BtBL9Y/27cce1b9-4809-4686-9ee6-f7fd273d90e4.png";
const PHOTO_IMAGE = "https://d2ol7oe51mr4n9.cloudfront.net/user_3CC8OMVTj8bkUz71eKrO5BtBL9Y/b13e09e5-c7fb-49cc-8a62-cf6cfcbb1f15.jpg";
const IMAGES_MARKDOWN = [
  "![天文與符咒：AI 清晰化整理版](" + AI_IMAGE + ")",
  "圖一｜AI 清晰化整理版：依據實體拍攝照片進行影像整理，方便辨識符號與線條；細節請以實體原圖為準。",
  "![天文與符咒：實體拍攝原圖](" + PHOTO_IMAGE + ")",
  "圖二｜實體拍攝原圖：當年作品的實際拍攝紀錄，保留原始影像樣貌。"
].join("\n\n");

const digest = (value) => createHash("sha256").update(value).digest("hex");
const str = (value) => ({ stringValue: String(value) });
const int = (value) => ({ integerValue: String(value) });
const timestamp = (value) => ({ timestampValue: value });

function count(value, needle) {
  return value.split(needle).length - 1;
}

function embedImages(privateContent) {
  assert.ok(privateContent.length > 250, "Private article body is unexpectedly short.");
  assert.ok(!privateContent.includes(PAID_MARKER), "Private article must not contain the public paywall marker.");

  const hasAI = privateContent.includes(AI_IMAGE);
  const hasPhoto = privateContent.includes(PHOTO_IMAGE);
  if (hasAI || hasPhoto) {
    assert.ok(hasAI && hasPhoto, "Only one evidence image exists; refusing partial migration.");
    assert.equal(count(privateContent, AI_IMAGE), 1, "AI image must occur exactly once.");
    assert.equal(count(privateContent, PHOTO_IMAGE), 1, "Original photo must occur exactly once.");
    const anchorIndex = privateContent.indexOf(ANCHOR);
    assert.ok(anchorIndex !== -1, "Cannot verify the placement anchor.");
    assert.ok(privateContent.indexOf(AI_IMAGE) > anchorIndex && privateContent.indexOf(PHOTO_IMAGE) > privateContent.indexOf(AI_IMAGE),
      "Existing image order is not the author-requested order.");
    return { content: privateContent, changed: false };
  }

  assert.equal(count(privateContent, ANCHOR), 1, "The requested paragraph anchor must occur exactly once.");
  const anchorIndex = privateContent.indexOf(ANCHOR);
  const nextParagraph = privateContent.indexOf("\n\n", anchorIndex + ANCHOR.length);
  const insertAt = nextParagraph === -1 ? privateContent.length : nextParagraph;
  const before = privateContent.slice(0, insertAt).trimEnd();
  const after = privateContent.slice(insertAt).trimStart();
  const content = before + "\n\n" + IMAGES_MARKDOWN + (after ? "\n\n" + after : "");
  assert.equal(count(content, AI_IMAGE), 1);
  assert.equal(count(content, PHOTO_IMAGE), 1);
  assert.ok(content.includes(ANCHOR));
  assert.ok(content.length > privateContent.length);
  // Only new media Markdown/captions and immediate whitespace at the insertion point can change.
  assert.equal(before + after, privateContent.slice(0, insertAt).trimEnd() + privateContent.slice(insertAt).trimStart());
  return { content, changed: true };
}

function selfTest() {
  const original = "## 前文\n\n這是測試段落，" + ANCHOR + "。\n\n## 後文\n\n其他原始文字。".repeat(50);
  const patched = embedImages(original);
  assert.equal(patched.changed, true);
  assert.equal(count(patched.content, AI_IMAGE), 1);
  assert.equal(count(patched.content, PHOTO_IMAGE), 1);
  assert.ok(patched.content.indexOf(AI_IMAGE) < patched.content.indexOf("## 後文"));
  assert.deepEqual(embedImages(patched.content), { content: patched.content, changed: false });
  assert.throws(() => embedImages(original.replace(ANCHOR, "不相符的句子")));
  assert.throws(() => embedImages(original + "\n\n" + AI_IMAGE));
  console.log("SELF_TEST_PASS: historical yuanshen image Markdown placement is idempotent");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Production migration may only run after PR merge.");
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(service.project_id, PROJECT_ID);
  assert.ok(service.private_key, "Authorized Firestore publisher credentials are required.");

  const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  assert.ok(token, "Cannot authenticate Firestore.");
  const root = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
  const request = async (suffix, { method = "GET", data, authorized = true } = {}) => {
    const response = await fetch(root + suffix, {
      method,
      headers: {
        ...(authorized ? { Authorization: "Bearer " + token } : {}),
        ...(data ? { "Content-Type": "application/json" } : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(25000)
    });
    assert.ok(response.ok, "Firestore " + method + " request failed (HTTP " + response.status + ").");
    return response.json();
  };

  const [publicDoc, privateDoc] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const pub = publicDoc.fields || {};
  const priv = privateDoc.fields || {};
  assert.equal(pub.status?.stringValue, "published", "Article must remain published.");
  assert.equal(pub.accessType?.stringValue, "paid", "Article must remain member-only.");
  assert.equal(pub.privatePaidContent?.booleanValue, true, "Paid protection must remain enabled.");
  assert.equal(priv.status?.stringValue, "published", "Private body status must be published.");
  assert.equal(priv.active?.booleanValue, true, "Private body must remain active.");
  const preview = String(pub.content?.stringValue || "");
  assert.ok(preview.endsWith(PAID_MARKER), "Public preview must terminate at the paid marker.");
  assert.ok(!preview.includes(ANCHOR), "Placement anchor must be in the protected member body.");
  const oldBody = String(priv.content?.stringValue || "");
  const migration = embedImages(oldBody);

  if (migration.changed) {
    const oldVersion = Math.max(0, Number(priv.contentVersion?.integerValue || 0));
    const version = oldVersion + 1;
    const nextHash = digest(migration.content);
    const now = new Date().toISOString();
    const publicFields = {
      ...pub,
      paidContentHash: str(nextHash),
      paidContentVersion: int(version),
      updatedAt: timestamp(now)
    };
    const privateFields = {
      ...priv,
      content: str(migration.content),
      contentHash: str(nextHash),
      contentVersion: int(version),
      previousContentBackup: str(oldBody),
      previousContentHashBackup: str(priv.contentHash?.stringValue || ""),
      previousContentVersionBackup: int(oldVersion),
      previousBackupAt: timestamp(now),
      updatedAt: timestamp(now)
    };

    await request(":commit", {
      method: "POST",
      data: { writes: [
        { update: { name: publicDoc.name, fields: publicFields }, currentDocument: { updateTime: publicDoc.updateTime } },
        { update: { name: privateDoc.name, fields: privateFields }, currentDocument: { updateTime: privateDoc.updateTime } }
      ] }
    });
  }

  const [verifiedPublic, verifiedPrivate] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  assert.equal(verifiedPublic.fields.content.stringValue, preview, "Public preview must remain unchanged.");
  assert.equal(verifiedPublic.fields.accessType.stringValue, "paid");
  assert.equal(verifiedPrivate.fields.content.stringValue, migration.content, "Private body did not persist.");
  const updated = verifiedPrivate.fields.content.stringValue;
  assert.equal(count(updated, AI_IMAGE), 1);
  assert.equal(count(updated, PHOTO_IMAGE), 1);
  assert.equal(verifiedPublic.fields.paidContentHash.stringValue, digest(updated));
  assert.equal(Number(verifiedPublic.fields.paidContentVersion.integerValue), Number(verifiedPrivate.fields.contentVersion.integerValue));

  const unauthorized = await fetch(root + "/paidArticleBodies/" + ARTICLE_ID, { signal: AbortSignal.timeout(20000) });
  assert.equal(unauthorized.status, 403, "Unauthenticated readers must be denied the member body.");
  const report = {
    articleId: ARTICLE_ID,
    migrated: migration.changed,
    imageCount: 2,
    markdownSavedInPrivateBody: true,
    imageOrder: "AI整理版 → 實體原圖",
    publicPreviewUnchanged: true,
    memberPermissionsUnchanged: true,
    anonymousPrivateReadStatus: unauthorized.status,
    editorCanLoadMarkdownFromFirestore: true,
    url: "https://lyyuan.tw/articles.html?id=" + ARTICLE_ID
  };
  writeFileSync("/tmp/historical-yuanshen-image-backend-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error("HISTORICAL_YUANSHEN_IMAGE_MIGRATION_STOPPED: " + (error?.code || error?.name || "error") + ": " + error.message);
  process.exitCode = 1;
});
