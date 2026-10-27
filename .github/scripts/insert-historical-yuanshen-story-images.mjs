import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ARTICLE_ID = "historical-yuanshen-destiny-cultivation";
const PROJECT_ID = "lyyuan03-membership";
const MARKER = "<!-- paid-only -->";
const IMAGE_ROOT = "https://lyyuan.tw/assets/articles/" + ARTICLE_ID + "/";
const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects/" +
  PROJECT_ID + "/databases/(default)/documents";
const STORIES = [
  {
    file: "05-yuan-shikai-toad-bedroom.jpg",
    anchor: "沒想到，當他走近床邊時，竟然發現床上躺著的不是袁世凱，而是一隻體型巨大的蟾蜍！小廝當場嚇得魂飛魄散，手中的玉杯掉落地面，摔得粉碎。",
    alt: "端茶的小廝與床上的巨大蟾蜍，AI 歷史情境插畫",
    captionTitle: "袁世凱的蟾蜍元神傳說｜AI 歷史情境示意",
    caption: "相傳袁世凱午睡時，小廝進房奉茶，竟看見床上躺著一隻巨大的蟾蜍，驚嚇之餘失手打碎玉杯。為了保住性命，小廝謊稱自己看見的是五爪金龍。此圖依據民間傳說，以 AI 重現故事情境，並非真實歷史影像。"
  },
  {
    file: "06-night-market-woman.jpg",
    anchor: "有時，女子會突然出現短暫清醒的反應，這個狀態維持了幾分鐘，之後又恢復原本的樣子。這個案例最值得討論的地方，就是元神與後天識神之間的落差。",
    alt: "台灣夜市人群中的中年女子，AI 電影情境插畫",
    captionTitle: "夜市女子的元神與後天識神｜AI 情境示意",
    caption: "一名長期出沒於夜市的女子，平時精神狀態異常，偶爾卻會出現短暫清醒的反應。從元神修持的角度來看，這個案例呈現了元神靈格與後天識神之間的落差。此圖為 AI 情境示意，並非當事人真實照片。"
  }
];
const digest = value => createHash("sha256").update(value).digest("hex");
const str = value => ({ stringValue: String(value) });
const int = value => ({ integerValue: String(value) });
const timestamp = value => ({ timestampValue: value });
const count = (content, value) => content.split(value).length - 1;
const imageUrl = story => IMAGE_ROOT + story.file;
const storyBlock = story => [
  "![" + story.alt + "](" + imageUrl(story) + ")",
  story.captionTitle,
  story.caption
].join("\n\n");

function insertOne(content, story) {
  const url = imageUrl(story);
  assert.equal(count(content, story.anchor), 1,
    "Story anchor is absent or ambiguous for " + story.file + "; refusing to modify text.");
  const anchorEnd = content.indexOf(story.anchor) + story.anchor.length;
  const existingCount = count(content, url);
  assert.ok(existingCount <= 1, "Duplicate existing image: " + story.file);
  if (existingCount === 1) {
    const imageAt = content.indexOf(url);
    assert.ok(imageAt > anchorEnd, "Existing image precedes its story: " + story.file);
    assert.equal(count(content, story.captionTitle), 1, "Caption is missing or repeated: " + story.file);
    assert.equal(count(content, story.caption), 1, "Caption text is missing or repeated: " + story.file);
    assert.ok(content.indexOf(story.captionTitle) > imageAt, "Caption placement mismatch: " + story.file);
    return { content, changed: false };
  }
  // If a caption has already been pasted with a different URL, do not add a duplicate.
  assert.equal(count(content, story.captionTitle), 0,
    "A caption already exists without its expected image URL: " + story.file);
  assert.equal(count(content, story.caption), 0,
    "A caption paragraph already exists without its expected image URL: " + story.file);
  const suffix = content.slice(anchorEnd);
  assert.ok(!suffix || /^\r?\n/.test(suffix),
    "The author-supplied sentence is not at a paragraph boundary: " + story.file);
  const inserted = content.slice(0, anchorEnd) + "\n\n" + storyBlock(story) +
    (/^(?:\r?\n){2}/.test(suffix) || !suffix ? "" : "\n\n") + suffix;
  assert.equal(count(inserted, url), 1);
  return { content: inserted, changed: true };
}

function insertBoth(original) {
  let next = original;
  const changed = [];
  for (const story of STORIES) {
    const result = insertOne(next, story);
    next = result.content;
    if (result.changed) changed.push(story.file);
  }
  assert.equal(count(next, MARKER), count(original, MARKER));
  // The only allowed difference is the insertion of exact image and caption blocks.
  let reverted = next;
  for (const story of STORIES) {
    if (!changed.includes(story.file)) continue;
    const block = "\n\n" + storyBlock(story);
    assert.equal(count(reverted, block), 1, "Inserted block did not survive unchanged.");
    const at = reverted.indexOf(block);
    const after = reverted.slice(at + block.length);
    const removeTrailing = after.startsWith("\n\n") && !original.includes(story.anchor + "\n\n")
      ? 2 : 0;
    reverted = reverted.slice(0, at) + after.slice(removeTrailing);
  }
  assert.equal(reverted, original, "Existing article text changed unexpectedly.");
  return { content: next, changed };
}

function selfTest() {
  const original = STORIES.map(story => "前一段\n\n" + story.anchor + "\n\n後一段").join("\n\n");
  const result = insertBoth(original);
  assert.equal(result.changed.length, 2);
  for (const story of STORIES) {
    assert.equal(count(result.content, imageUrl(story)), 1);
    assert.ok(result.content.indexOf(imageUrl(story)) > result.content.indexOf(story.anchor));
  }
  assert.equal(insertBoth(result.content).changed.length, 0, "Migration must be idempotent.");
  assert.throws(() => insertBoth(original.replace("粉碎。", "摔破。")), /anchor/);
  assert.throws(() => insertBoth(original + "\n\n" + STORIES[0].captionTitle), /caption/);
  console.log("SELF_TEST_PASS: exact story placement, intact text, captions, idempotency");
}

async function verifyPublishedAssets() {
  for (const story of STORIES) {
    const response = await fetch(imageUrl(story), {
      method: "GET",
      signal: AbortSignal.timeout(20000),
      cache: "no-store"
    });
    assert.equal(response.status, 200, "Image is not yet served by Pages: " + story.file);
    assert.match(response.headers.get("content-type") || "", /^image\/jpeg(?:;|$)/i,
      "Unexpected Content-Type: " + story.file);
    const buffer = new Uint8Array(await response.arrayBuffer());
    assert.ok(buffer.length > 100000, "Unexpectedly small JPEG: " + story.file);
    assert.equal(buffer[0], 0xff);
    assert.equal(buffer[1], 0xd8);
  }
}

async function waitForPublishedAssets() {
  let latest = null;
  for (let attempt = 1; attempt <= 36; attempt++) {
    try {
      await verifyPublishedAssets();
      console.log("PAGES_IMAGES_READY", STORIES.map(s => s.file).join(", "));
      return;
    } catch (error) {
      latest = error;
      console.log("PAGES_IMAGES_PENDING", attempt, error.message);
      if (attempt < 36) await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }
  throw new Error("Image deployment was not verified; Firestore remains unchanged. " + latest.message);
}

async function run() {
  if (process.argv.includes("--self-test")) return selfTest();
  assert.equal(process.env.GITHUB_REF, "refs/heads/main",
    "Firestore migration must run only after approved PR merge.");
  const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(credential.project_id, PROJECT_ID);
  assert.ok(credential.private_key, "Existing Firebase publisher credential is required.");
  await waitForPublishedAssets();
  const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  assert.ok(token);
  const request = async (path, { method = "GET", body } = {}) => {
    const response = await fetch(FIRESTORE_ROOT + path, {
      method,
      headers: { Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    assert.ok(response.ok, "Firestore " + method + " returned HTTP " + response.status);
    return response.json();
  };
  const [publicDoc, privateDoc] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const pub = publicDoc.fields || {};
  const priv = privateDoc.fields || {};
  const oldPublic = String(pub.content?.stringValue || "");
  const oldPrivate = String(priv.content?.stringValue || "");
  assert.match(String(pub.title?.stringValue || ""), /蔣中正.*毛澤東.*袁世凱/);
  assert.ok(["published", "draft"].includes(pub.status?.stringValue));
  assert.ok(["published", "draft"].includes(priv.status?.stringValue));
  assert.equal(pub.accessType?.stringValue, "paid");
  assert.equal(pub.privatePaidContent?.booleanValue, true);
  assert.equal(priv.active?.booleanValue, true);
  assert.ok(oldPublic.trimEnd().endsWith(MARKER),
    "Public preview must preserve its existing paid-only boundary.");
  assert.equal(count(oldPublic, MARKER), 1);
  assert.ok(oldPrivate.length > 200);
  assert.equal(count(oldPrivate, MARKER), 0);
  for (const story of STORIES) {
    assert.equal(count(oldPublic, story.anchor), 0,
      "Anchor moved to public preview; stop and re-evaluate protection.");
    assert.equal(count(oldPublic, imageUrl(story)), 0,
      "Image already exists in public preview.");
    assert.equal(count(oldPrivate, story.anchor), 1,
      "Exact protected paragraph not uniquely located: " + story.file);
  }

  const result = insertBoth(oldPrivate);
  const newPrivate = result.content;
  const oldVersion = Math.max(0, Number(priv.contentVersion?.integerValue || 0));
  const oldPublicVersion = Math.max(0, Number(pub.paidContentVersion?.integerValue || 0));
  const version = Math.max(oldVersion, oldPublicVersion) + (result.changed.length ? 1 : 0);
  const hash = digest(newPrivate);
  const now = new Date().toISOString();
  if (result.changed.length) {
    // Preserve the exact version read immediately before editing, including the author's latest changes.
    // Firestore updateTime preconditions make both metadata and private body updates atomic.
    const privateFields = {
      content: str(newPrivate),
      contentHash: str(hash),
      contentVersion: int(version),
      previousContentBackup: str(oldPrivate),
      previousContentHashBackup: str(priv.contentHash?.stringValue || ""),
      previousContentVersionBackup: int(oldVersion),
      previousBackupAt: timestamp(now),
      updatedAt: timestamp(now)
    };
    const publicFields = {
      paidContentHash: str(hash),
      paidContentVersion: int(version),
      updatedAt: timestamp(now)
    };
    await request(":commit", { method: "POST", body: { writes: [
      { update: { name: privateDoc.name, fields: privateFields },
        updateMask: { fieldPaths: Object.keys(privateFields) },
        currentDocument: { updateTime: privateDoc.updateTime } },
      { update: { name: publicDoc.name, fields: publicFields },
        updateMask: { fieldPaths: Object.keys(publicFields) },
        currentDocument: { updateTime: publicDoc.updateTime } }
    ] } });
  }
  const [verifiedPublic, verifiedPrivate] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const finalPub = verifiedPublic.fields || {};
  const finalPriv = verifiedPrivate.fields || {};
  assert.equal(finalPub.content?.stringValue, oldPublic, "Public body must remain unchanged.");
  assert.equal(finalPriv.content?.stringValue, newPrivate, "Private content did not persist.");
  assert.equal(finalPub.accessType?.stringValue, "paid");
  assert.equal(finalPub.privatePaidContent?.booleanValue, true);
  assert.equal(finalPub.status?.stringValue, pub.status?.stringValue);
  assert.equal(finalPriv.status?.stringValue, priv.status?.stringValue);
  assert.equal(finalPriv.active?.booleanValue, true);
  assert.equal(finalPub.paidContentHash?.stringValue, hash);
  assert.equal(finalPriv.contentHash?.stringValue, hash);
  assert.equal(Number(finalPub.paidContentVersion?.integerValue), version);
  assert.equal(Number(finalPriv.contentVersion?.integerValue), version);
  if (result.changed.length) {
    assert.equal(finalPriv.previousContentBackup?.stringValue, oldPrivate,
      "An exact pre-edit backup must be retained.");
  }
  for (const story of STORIES) {
    assert.equal(count(newPrivate, imageUrl(story)), 1, "Image occurs more than once.");
    assert.equal(count(newPrivate, story.captionTitle), 1, "Caption title occurs more than once.");
    assert.equal(count(newPrivate, story.caption), 1, "Caption text occurs more than once.");
    assert.ok(newPrivate.indexOf(imageUrl(story)) > newPrivate.indexOf(story.anchor));
  }
  const anonymous = await fetch(FIRESTORE_ROOT + "/paidArticleBodies/" + ARTICLE_ID,
    { signal: AbortSignal.timeout(20000) });
  assert.equal(anonymous.status, 403, "Anonymous access to private body must remain denied.");
  const report = {
    articleId: ARTICLE_ID,
    inserted: result.changed,
    fullTextWrittenIn: "paidArticleBodies/" + ARTICLE_ID + ".content",
    privateBodyVersion: version,
    publicAndPrivateHashesMatch: true,
    preEditBackupVerified: result.changed.length > 0 ? true : "already-present",
    publicationStatusPreserved: finalPub.status?.stringValue,
    accessTypePreserved: finalPub.accessType?.stringValue,
    paidOnlyMarkerCount: count(oldPublic, MARKER),
    anonymousPrivateReadStatus: anonymous.status,
    images: STORIES.map(s => ({ url: imageUrl(s), markdownCount: count(newPrivate, imageUrl(s)) })),
    articleTextUnaffectedExceptTwoBlocks: true
  };
  writeFileSync("/tmp/historical-yuanshen-two-story-image-proof.json", JSON.stringify(report, null, 2));
  console.log("STORY_IMAGE_MIGRATION_VERIFIED", JSON.stringify(report));
}

run().catch(error => {
  console.error("STORY_IMAGE_MIGRATION_STOPPED", error.name || "Error", error.message);
  process.exitCode = 1;
});
