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

function findTargetParagraph(content) {
  // The editor may contain an earlier wording of the author's supplied sentence.
  // Require a uniquely identifiable paragraph based on the same concrete subject.
  const paragraphs = content.split(/\r?\n[ \t]*\r?\n/).map(value => value.trim()).filter(Boolean);
  const rules = [
    ["exact-sentence", text => text.includes(ANCHOR)],
    ["talismans-and-artwork", text => text.includes("天文") && text.includes("符咒") && /漂亮|作品/.test(text)],
    ["written-talismans", text => text.includes("書寫") && text.includes("天文") && text.includes("符咒")],
    ["practitioner-talismans", text => text.includes("修行者") && text.includes("天文") && text.includes("符咒")],
    ["practitioner-beautiful-art", text => text.includes("修行者") && text.includes("漂亮") && text.includes("作品")]
  ];
  for (const [method, matchesRule] of rules) {
    const matches = paragraphs.filter(matchesRule);
    if (matches.length !== 1) continue;
    const text = matches[0];
    const start = content.indexOf(text);
    assert.ok(start >= 0, "Could not locate the uniquely matched paragraph.");
    return { start, end: start + text.length, method };
  }
  return null;
}

function embedImages(articleSection) {
  assert.ok(articleSection.length > 100, "Article section is unexpectedly short.");
  assert.ok(!articleSection.includes(PAID_MARKER), "Article section cannot contain the paywall marker.");
  const location = findTargetParagraph(articleSection);
  assert.ok(location, "Could not uniquely identify the author's talisman-artwork paragraph.");

  const hasAI = articleSection.includes(AI_IMAGE);
  const hasPhoto = articleSection.includes(PHOTO_IMAGE);
  if (hasAI || hasPhoto) {
    assert.ok(hasAI && hasPhoto, "Only one evidence image exists; refusing partial migration.");
    assert.equal(count(articleSection, AI_IMAGE), 1, "AI image must occur exactly once.");
    assert.equal(count(articleSection, PHOTO_IMAGE), 1, "Original photo must occur exactly once.");
    assert.ok(articleSection.indexOf(AI_IMAGE) >= location.end
      && articleSection.indexOf(PHOTO_IMAGE) > articleSection.indexOf(AI_IMAGE),
    "Existing image position or order must match the author's request.");
    return { content: articleSection, changed: false, anchorMethod: location.method };
  }

  const before = articleSection.slice(0, location.end).trimEnd();
  const after = articleSection.slice(location.end).trimStart();
  const content = before + "\n\n" + IMAGES_MARKDOWN + (after ? "\n\n" + after : "");
  assert.equal(count(content, AI_IMAGE), 1);
  assert.equal(count(content, PHOTO_IMAGE), 1);
  assert.ok(content.length > articleSection.length);
  return { content, changed: true, anchorMethod: location.method };
}

function selfTest() {
  const original = "## 前文\n\n這是測試段落，" + ANCHOR + "。\n\n## 後文\n\n其他原始文字。".repeat(50);
  const patched = embedImages(original);
  assert.equal(patched.changed, true);
  assert.equal(count(patched.content, AI_IMAGE), 1);
  assert.equal(count(patched.content, PHOTO_IMAGE), 1);
  assert.ok(patched.content.indexOf(AI_IMAGE) < patched.content.indexOf("## 後文"));
  const repeated = embedImages(patched.content);
  assert.equal(repeated.content, patched.content);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.anchorMethod, "exact-sentence");
  assert.throws(() => embedImages(original.replace(ANCHOR, "不相符的句子")));
  assert.throws(() => embedImages(original + "\n\n" + AI_IMAGE));
  const variant = original.replace(ANCHOR, "我這一生見過非常漂亮的天文與符咒作品");
  assert.equal(embedImages(variant).changed, true);
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
  // Some manually managed member articles retain draft status while under editorial review.
  // This is a content-only edit: never change either record's original publication state.
  const publicStatus = String(pub.status?.stringValue || "");
  const privateStatus = String(priv.status?.stringValue || "");
  console.log("SAFE_ARTICLE_METADATA", JSON.stringify({
    publicStatus,
    privateStatus,
    accessType: pub.accessType?.stringValue || "",
    hasProtectedBody: pub.privatePaidContent?.booleanValue === true,
    privateActive: priv.active?.booleanValue === true
  }));
  assert.ok(["draft", "published"].includes(publicStatus), "Public article has an unrecognized status.");
  assert.ok(["draft", "published"].includes(privateStatus), "Private body has an unrecognized status.");
  assert.ok(/蔣中正|毛澤東|袁世凱/.test(String(pub.title?.stringValue || "")), "Article title is not the author's requested historical yuanshen article.");
  assert.equal(pub.accessType?.stringValue, "paid", "Article must remain member-only.");
  assert.equal(pub.privatePaidContent?.booleanValue, true, "Paid protection must remain enabled.");
  assert.equal(priv.active?.booleanValue, true, "Private body must remain active.");
  const preview = String(pub.content?.stringValue || "");
  assert.ok(preview.endsWith(PAID_MARKER), "Public preview must terminate at the paid marker.");
  const previewBody = preview.slice(0, -PAID_MARKER.length).trimEnd();
  const originalPrivate = String(priv.content?.stringValue || "");
  const previewLocation = findTargetParagraph(previewBody);
  const privateLocation = findTargetParagraph(originalPrivate);
  // Keep logs strictly to match counts and non-sensitive boolean metadata; never print article body.
  console.log("SAFE_ANCHOR_DIAGNOSTIC", JSON.stringify({
    previewMatch: Boolean(previewLocation),
    privateMatch: Boolean(privateLocation),
    previewMethod: previewLocation?.method || "",
    privateMethod: privateLocation?.method || "",
    previewKeywords: ["天文", "符咒", "漂亮", "作品", "修行者"].map(term => count(previewBody, term)),
    privateKeywords: ["天文", "符咒", "漂亮", "作品", "修行者"].map(term => count(originalPrivate, term))
  }));
  assert.ok(previewLocation || privateLocation, "The requested paragraph was not found in either article section.");
  // The original presentation-layer insertion selected the first visible paragraph.
  // When text is duplicated in preview and member body, retain that same public placement.
  const anchorInPreview = Boolean(previewLocation);
  const anchorInPrivate = !anchorInPreview && Boolean(privateLocation);
  const placement = anchorInPreview ? "public-preview" : "member-private";
  const migration = embedImages(anchorInPreview ? previewBody : originalPrivate);
  const nextPreview = anchorInPreview ? migration.content + "\n\n" + PAID_MARKER : preview;
  const nextPrivate = anchorInPrivate ? migration.content : originalPrivate;

  if (migration.changed) {
    const now = new Date().toISOString();
    if (anchorInPreview) {
      // Add the author-supplied images to the same preview paragraph visible in the editor.
      // Do not change the member-only private document, paywall, or paid body metadata.
      const nextPublicFields = {
        ...pub,
        content: str(nextPreview),
        previousContentBackup: str(preview),
        previousContentBackupAt: timestamp(now),
        updatedAt: timestamp(now)
      };
      await request(":commit", {
        method: "POST",
        data: { writes: [{
          update: { name: publicDoc.name, fields: nextPublicFields },
          currentDocument: { updateTime: publicDoc.updateTime }
        }] }
      });
    } else {
      // If the author later moves the paragraph into the private member body,
      // preserve private access and update the matching version/hash atomically.
      const oldVersion = Math.max(0, Number(priv.contentVersion?.integerValue || 0));
      const version = oldVersion + 1;
      const nextHash = digest(nextPrivate);
      const nextPublicFields = {
        ...pub,
        paidContentHash: str(nextHash),
        paidContentVersion: int(version),
        updatedAt: timestamp(now)
      };
      const nextPrivateFields = {
        ...priv,
        content: str(nextPrivate),
        contentHash: str(nextHash),
        contentVersion: int(version),
        previousContentBackup: str(originalPrivate),
        previousContentHashBackup: str(priv.contentHash?.stringValue || ""),
        previousContentVersionBackup: int(oldVersion),
        previousBackupAt: timestamp(now),
        updatedAt: timestamp(now)
      };
      await request(":commit", {
        method: "POST",
        data: { writes: [
          { update: { name: publicDoc.name, fields: nextPublicFields }, currentDocument: { updateTime: publicDoc.updateTime } },
          { update: { name: privateDoc.name, fields: nextPrivateFields }, currentDocument: { updateTime: privateDoc.updateTime } }
        ] }
      });
    }
  }

  const [verifiedPublic, verifiedPrivate] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  assert.equal(verifiedPublic.fields.content.stringValue, nextPreview, "Article editor content was not saved as expected.");
  assert.ok(nextPreview.endsWith(PAID_MARKER), "The private article boundary must remain intact.");
  assert.equal(verifiedPublic.fields.accessType.stringValue, "paid");
  assert.equal(verifiedPublic.fields.status?.stringValue, publicStatus, "Article publication state must not change.");
  assert.equal(verifiedPrivate.fields.status?.stringValue, privateStatus, "Private publication state must not change.");
  assert.equal(verifiedPrivate.fields.content.stringValue, nextPrivate, "Member-only body must remain intact.");
  const placedBody = anchorInPreview
    ? verifiedPublic.fields.content.stringValue
    : verifiedPrivate.fields.content.stringValue;
  assert.equal(count(placedBody, AI_IMAGE), 1);
  assert.equal(count(placedBody, PHOTO_IMAGE), 1);
  const verifiedLocation = findTargetParagraph(placedBody);
  assert.ok(verifiedLocation, "Updated paragraph must still be identifiable.");
  assert.ok(placedBody.indexOf(AI_IMAGE) >= verifiedLocation.end);
  assert.ok(placedBody.indexOf(PHOTO_IMAGE) > placedBody.indexOf(AI_IMAGE));

  if (anchorInPreview) {
    assert.equal(verifiedPublic.fields.paidContentHash?.stringValue, pub.paidContentHash?.stringValue,
      "Editing the preview must not alter the private body hash.");
    assert.equal(verifiedPublic.fields.paidContentVersion?.integerValue, pub.paidContentVersion?.integerValue,
      "Editing the preview must not change the member body version.");
  } else {
    assert.equal(verifiedPublic.fields.paidContentHash.stringValue, digest(nextPrivate));
    assert.equal(Number(verifiedPublic.fields.paidContentVersion.integerValue),
      Number(verifiedPrivate.fields.contentVersion.integerValue));
  }
  const unauthorized = await fetch(root + "/paidArticleBodies/" + ARTICLE_ID, { signal: AbortSignal.timeout(20000) });
  assert.equal(unauthorized.status, 403, "Unauthenticated readers must be denied the member body.");
  const report = {
    articleId: ARTICLE_ID,
    migrated: migration.changed,
    markdownSavedIn: placement,
    paragraphAnchorMethod: migration.anchorMethod,
    imageCount: 2,
    imageOrder: "AI整理版 → 實體原圖",
    articleStatusPreserved: publicStatus,
    privateBodyUnchanged: anchorInPreview,
    privateArticleAccessPreserved: true,
    anonymousPrivateReadStatus: unauthorized.status,
    editorContainsImageMarkdown: true,
    url: "https://lyyuan.tw/articles.html?id=" + ARTICLE_ID
  };
  writeFileSync("/tmp/historical-yuanshen-image-backend-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  console.error("HISTORICAL_YUANSHEN_IMAGE_MIGRATION_STOPPED: " + (error?.code || error?.name || "error") + ": " + error.message);
  process.exitCode = 1;
});
