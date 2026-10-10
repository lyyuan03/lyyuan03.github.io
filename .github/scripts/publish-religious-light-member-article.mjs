import assert from "node:assert/strict";
import { createDecipheriv, createHash, createPublicKey, privateDecrypt, constants } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export const ARTICLE_ID = "religious-light-inner-person-yuanshen";
const TITLE = "宗教修持中看見的光，與內在人有什麼關係？";
const PROJECT = "lyyuan03-membership";
const MARKER = "<!-- paid-only -->";
const ASSET_ROOT = `https://lyyuan.tw/assets/articles/${ARTICLE_ID}/`;
const ENVELOPE_PATH = `secure-imports/${ARTICLE_ID}-20261010.enc.json`;
const hash = value => createHash("sha256").update(value).digest("hex");
const stringField = value => ({ stringValue: String(value) });
const timeField = value => ({ timestampValue: value });

export function decryptEnvelope(envelope, privateKey) {
  assert.equal(envelope.format, "lyyuan-paid-article-rsa-aes-gcm-v1");
  assert.equal(envelope.articleId, ARTICLE_ID);
  const publicDer = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  assert.equal(hash(publicDer), envelope.recipientKeySha256, "Recipient key differs from the configured publishing account.");
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.encryptedKey, "base64"));
  try {
    assert.equal(key.length, 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(ARTICLE_ID));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plain = gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]));
    assert.equal(hash(plain), envelope.payloadSha256, "Encrypted payload integrity failed.");
    return JSON.parse(plain.toString("utf8"));
  } finally {
    key.fill(0);
  }
}

export function validatePayload(payload) {
  assert.equal(payload.id, ARTICLE_ID);
  assert.equal(payload.slug, ARTICLE_ID);
  assert.equal(payload.title, TITLE);
  assert.equal(payload.category, "spiritual");
  assert.equal(payload.accessType, "paid");
  assert.equal(payload.privatePaidContent, true);
  const content = String(payload.content || "").trim();
  assert.equal(content.split(MARKER).length, 2, "Exactly one paid marker is required.");
  const [publicContent, privateContent] = content.split(MARKER).map(value => value.trim());
  assert.ok(publicContent.length > 100 && privateContent.length > 1000, "The complete preview and member body are required.");
  assert.ok(!/^#\s/.test(content), "The editor body must not duplicate the article title.");
  const images = [...privateContent.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]);
  assert.equal(images.length, 9, "All nine member illustrations must be retained.");
  assert.equal(payload.imageAssets?.length, 10);
  const assetUrls = payload.imageAssets.map(asset => asset.url);
  assert.equal(new Set(assetUrls).size, 10);
  assert.equal(payload.coverImage, `${ASSET_ROOT}00-cover.jpeg`);
  assert.equal(payload.thumbnailImage, payload.coverImage);
  assert.ok(!content.includes(payload.coverImage), "The cover must not repeat in the body.");
  for (const asset of payload.imageAssets) {
    assert.match(asset.filename, /^\d{2}-[a-z-]+\.jpeg$/);
    assert.equal(asset.url, ASSET_ROOT + asset.filename);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual([...images].sort(), assetUrls.slice(1).sort(), "Each member illustration must appear exactly once.");
  assert.ok(payload.bookTitle && payload.bookPurchaseUrl && payload.bookCoverImage);
  return { publicContent, privateContent, safeContent: `${publicContent}\n\n${MARKER}`, contentHash: hash(privateContent) };
}

function field(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  return stringField(value);
}

export function buildWrites(payload, split, state, previousPublic, previousPrivate, now) {
  assert.ok(["draft", "published"].includes(state));
  const oldPublic = previousPublic?.fields || {};
  const oldPrivate = previousPrivate?.fields || {};
  const unchanged = oldPrivate.contentHash?.stringValue === split.contentHash
    && oldPrivate.content?.stringValue === split.privateContent;
  const oldVersion = Math.max(0, Number(oldPrivate.contentVersion?.integerValue || 0));
  const version = unchanged ? Math.max(1, oldVersion) : oldVersion + 1;
  const publicFields = {};
  const keys = ["id", "slug", "title", "category", "displayCategory", "excerpt", "coverImage", "thumbnailImage", "thumbnailTitle", "series", "topics", "readingLevel", "sharePath", "bookTitle", "bookAuthor", "bookPublisher", "bookPurchaseUrl", "bookCoverImage"];
  for (const key of keys) if (payload[key] !== undefined) publicFields[key] = field(payload[key]);
  Object.assign(publicFields, {
    status: stringField(state), accessType: stringField("paid"), privatePaidContent: { booleanValue: true },
    content: stringField(split.safeContent), paidContentHash: stringField(split.contentHash),
    paidContentVersion: { integerValue: String(version) }, eventId: stringField(""), eventName: stringField(""),
    encryptedContent: stringField(""), encryption: stringField(""), eventIv: stringField(""),
    magicLinkAccess: { mapValue: { fields: {} } }, updatedAt: timeField(now),
    createdAt: oldPublic.createdAt?.timestampValue ? oldPublic.createdAt : timeField(now)
  });
  if (state === "published") publicFields.publishedAt = oldPublic.publishedAt?.timestampValue ? oldPublic.publishedAt : timeField(now);
  const privateFields = {
    ...oldPrivate, articleId: stringField(ARTICLE_ID), title: stringField(TITLE), status: stringField(state),
    content: stringField(split.privateContent), contentHash: stringField(split.contentHash),
    contentVersion: { integerValue: String(version) }, active: { booleanValue: true },
    source: stringField("github-encrypted-member-publication:20261010"), updatedAt: timeField(now),
    createdAt: oldPrivate.createdAt?.timestampValue ? oldPrivate.createdAt : timeField(now)
  };
  if (previousPrivate && !unchanged) Object.assign(privateFields, {
    previousContentBackup: stringField(oldPrivate.content?.stringValue || ""),
    previousContentHashBackup: stringField(oldPrivate.contentHash?.stringValue || ""),
    previousContentVersionBackup: { integerValue: String(oldVersion) }, previousBackupAt: timeField(now)
  });
  const documentRoot = `projects/${PROJECT}/databases/(default)/documents`;
  const write = (collection, fields, previous) => ({
    update: { name: `${documentRoot}/${collection}/${ARTICLE_ID}`, fields },
    currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false }
  });
  return { version, writes: [write("articles", publicFields, previousPublic), write("paidArticleBodies", privateFields, previousPrivate)] };
}

async function main() {
  const publish = process.env.GITHUB_REF === "refs/heads/main";
  assert.ok(publish || process.env.GITHUB_REF === "refs/heads/publish/religious-light-inner-person-20261010");
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(service.project_id, PROJECT);
  assert.ok(service.private_key, "The existing publishing account is required.");
  const accessToken = process.env.FIRESTORE_ACCESS_TOKEN || execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  assert.ok(accessToken, "The existing publishing account must authenticate.");
  const envelope = JSON.parse(readFileSync(ENVELOPE_PATH, "utf8"));
  const payload = decryptEnvelope(envelope, service.private_key);
  const split = validatePayload(payload);
  for (const asset of payload.imageAssets) {
    const bytes = readFileSync(`assets/articles/${ARTICLE_ID}/${asset.filename}`);
    assert.equal(hash(bytes), asset.sha256, "An original image changed during transfer.");
  }
  const root = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const request = async (suffix, { method = "GET", data, authenticated = true, allow404 = false } = {}) => {
    const response = await fetch(root + suffix, {
      method, headers: {
        ...(authenticated ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(data ? { "Content-Type": "application/json" } : {})
      }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000)
    });
    if (allow404 && response.status === 404) return null;
    assert.ok(response.ok, `Firestore request failed with HTTP ${response.status}.`);
    return response.json();
  };
  const paths = [`/articles/${ARTICLE_ID}`, `/paidArticleBodies/${ARTICLE_ID}`];
  const previous = await Promise.all(paths.map(suffix => request(suffix, { allow404: true })));
  if (!publish && previous[0]?.fields?.status?.stringValue === "published") {
    assert.equal(previous[0].fields.accessType?.stringValue, "paid");
    console.log("EXISTING_PUBLISHED_ARTICLE_PRESERVED");
    return;
  }
  if (publish) {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      const results = await Promise.all(payload.imageAssets.map(async asset => {
        try {
          const response = await fetch(asset.url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
          return response.ok && hash(Buffer.from(await response.arrayBuffer())) === asset.sha256;
        } catch { return false; }
      }));
      ready = results.every(Boolean);
      if (!ready) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(ready, "The original image assets must be live before publication.");
  }
  const state = publish ? "published" : "draft";
  const built = buildWrites(payload, split, state, ...previous, new Date().toISOString());
  await request(":commit", { method: "POST", data: { writes: built.writes } });
  const [publicDoc, privateDoc] = await Promise.all(paths.map(suffix => request(suffix)));
  const af = publicDoc.fields, pf = privateDoc.fields;
  assert.equal(af.status.stringValue, state);
  assert.equal(pf.status.stringValue, state);
  assert.equal(af.accessType.stringValue, "paid");
  assert.equal(af.privatePaidContent.booleanValue, true);
  assert.equal(af.content.stringValue, split.safeContent);
  assert.ok(pf.content.stringValue === split.privateContent, "Private body verification failed.");
  assert.equal(pf.contentHash.stringValue, split.contentHash);
  assert.equal(af.paidContentHash.stringValue, split.contentHash);
  assert.equal(Number(pf.contentVersion.integerValue), built.version);
  assert.equal(Number(af.paidContentVersion.integerValue), built.version);
  assert.equal(pf.active.booleanValue, true);
  const denied = await fetch(root + paths[1], { signal: AbortSignal.timeout(20000) });
  assert.equal(denied.status, 403, "Anonymous access to the private body must be denied.");
  if (publish) {
    assert.ok(af.publishedAt.timestampValue);
    const guest = await request(paths[0], { authenticated: false });
    assert.equal(guest.fields.content.stringValue, split.safeContent);
    assert.equal(guest.fields.accessType.stringValue, "paid");
  }
  const report = {
    articleId: ARTICLE_ID, status: state, accessType: "paid", privatePaidContent: true,
    contentVersion: built.version, originalImagesVerified: 10, memberIllustrations: 9,
    privateBodyChars: split.privateContent.length, privateBodyHash: split.contentHash,
    privateBodyVerified: true, anonymousPrivateReadStatus: denied.status,
    publishedAt: af.publishedAt?.timestampValue || null,
    url: `https://lyyuan.tw/articles.html?id=${ARTICLE_ID}`
  };
  writeFileSync(process.env.REPORT_PATH || "/tmp/religious-light-publication-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Member article publication stopped: ${error.code || error.name || "verification_failed"}`);
    process.exitCode = 1;
  });
}
