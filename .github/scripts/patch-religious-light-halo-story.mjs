import assert from "node:assert/strict";
import { createHash, createPublicKey, privateDecrypt, createDecipheriv, constants } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";

const ARTICLE_ID = "religious-light-inner-person-yuanshen";
const PROJECT_ID = "lyyuan03-membership";
const ENVELOPE = "secure-imports/religious-light-halo-story-20261011.enc.json";
const marker = "<!-- paid-only -->";
const digest = value => createHash("sha256").update(value).digest("hex");
const str = value => ({ stringValue: String(value) });
const timestamp = value => ({ timestampValue: value });
const int = value => ({ integerValue: String(value) });

function decryptPatch(envelope, privateKey) {
  assert.equal(envelope.format, "lyyuan-member-article-patch-rsa-aes-gcm-v1");
  assert.equal(envelope.articleId, ARTICLE_ID);
  const pub = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  assert.equal(digest(pub), envelope.recipientKeySha256);
  const aes = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.encryptedKey, "base64"));
  try {
    assert.equal(aes.length, 32);
    const decipher = createDecipheriv("aes-256-gcm", aes, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(ARTICLE_ID));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]));
    assert.equal(digest(plaintext), envelope.payloadSha256);
    return JSON.parse(plaintext.toString("utf8"));
  } finally { aes.fill(0); }
}

async function main() {
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Only main may publish this one-time update.");
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  assert.equal(service.project_id, PROJECT_ID);
  assert.ok(service.private_key);
  const patch = decryptPatch(JSON.parse(readFileSync(ENVELOPE, "utf8")), service.private_key);
  assert.equal(patch.articleId, ARTICLE_ID);
  assert.equal(patch.replaceFrom, "一封標示為1911年的信件記載");
  assert.equal(patch.replaceTo, "十九世紀流傳的《俄羅斯朝聖者的故事》");
  assert.ok(patch.replacement.length > 1100);
  assert.equal(patch.expectedImageUrl, "https://lyyuan.tw/assets/articles/" + ARTICLE_ID + "/10-halo-story.svg");
  assert.ok(patch.replacement.includes(patch.expectedImageUrl), "Illustration must appear in the member-only addition.");
  assert.ok(!patch.replacement.includes(marker));

  // The original 9 images remain untouched; the newly generated photorealistic illustration
  // is delivered separately until its exact original file can be uploaded. Never display
  // the earlier stylistically incompatible SVG in the paid article.
  const photoLine = patch.replacement.split(/\r?\n/).filter(line => line.includes(patch.expectedImageUrl));
  assert.equal(photoLine.length, 1, "The unsuitable SVG must be omitted exactly once.");
  const storyText = patch.replacement.split(/\r?\n/).filter(line => !line.includes(patch.expectedImageUrl)).join("\n").trim();
  assert.ok(storyText.length > 600, "Private story text was unexpectedly short.");
  assert.ok(storyText.includes("1911") && storyText.includes("內在人") && storyText.includes("恩典"), "The historical narrative and spiritual interpretation must remain.");
  const token = process.env.FIRESTORE_ACCESS_TOKEN || execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  assert.ok(token);
  const root = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
  const request = async (suffix, { method = "GET", data, auth = true } = {}) => {
    const result = await fetch(root + suffix, {
      method, headers: { ...(auth ? { Authorization: "Bearer " + token } : {}), ...(data ? { "Content-Type": "application/json" } : {}) },
      body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(25000)
    });
    assert.ok(result.ok, "Firestore request failed with HTTP " + result.status);
    return result.json();
  };
  const [publicDoc, privateDoc] = await Promise.all([
    request("/articles/" + ARTICLE_ID),
    request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  const pub = publicDoc.fields, priv = privateDoc.fields;
  assert.equal(pub.status?.stringValue, "published");
  assert.equal(priv.status?.stringValue, "published");
  assert.equal(pub.accessType?.stringValue, "paid");
  assert.equal(pub.privatePaidContent?.booleanValue, true);
  assert.equal(priv.active?.booleanValue, true);
  assert.ok(pub.content?.stringValue.endsWith(marker), "Public document must contain only the free preview.");
  const oldBody = priv.content?.stringValue;
  assert.ok(oldBody && oldBody.length > 1000);
  if (oldBody.includes("哥哥早已安靜地睡著") && oldBody.includes("《幽靈・死亡・夢境：榮格取向的鬼文本分析》")) {
    assert.ok(oldBody.includes("《幽靈・死亡・夢境：榮格取向的鬼文本分析》"), "Existing update must match requested source.");
    console.log(JSON.stringify({ articleId: ARTICLE_ID, updated: false, reason: "already_applied", accessType: "paid" }));
    return;
  }
  // The live member body has reordered sections relative to the earlier draft.
  // Insert strictly before the next section heading, preserving every old paragraph.
  const followingHeading = "認識內在人，就像第一次照鏡子";
  const anchor = oldBody.indexOf(followingHeading);
  assert.ok(anchor > 0 && oldBody.indexOf(followingHeading, anchor + 1) === -1,
    "Expected next chapter heading must appear exactly once.");
  const lineStart = oldBody.lastIndexOf("\n", anchor) + 1;
  assert.match(oldBody.slice(lineStart, anchor), /^#{2,6} +$/, "The insertion anchor must be a Markdown heading.");
  const before = oldBody.slice(0, lineStart).trimEnd();
  const after = oldBody.slice(lineStart).trimStart();
  assert.ok(before.includes("古代文獻裡的光之人"), "The preceding ancient light-person section is required.");
  assert.ok(before.includes("俄羅斯朝聖者的故事"), "The Russian Pilgrim example must be retained before insertion.");
  const updatedBody = before + "\n\n" + storyText + "\n\n" + after;
  assert.ok(updatedBody.includes("俄羅斯朝聖者的故事"), "The Russian Pilgrim passage must remain.");
  const imageLinks = text => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(x => x[1]);
  const oldImages = imageLinks(oldBody), newImages = imageLinks(updatedBody);
  assert.equal(oldImages.length, 9, "Existing nine member illustrations must remain.");
  assert.equal(newImages.length, 9, "Nine existing illustrations must remain; mismatched SVG is excluded.");
  for (const url of oldImages) assert.equal(newImages.filter(candidate => candidate === url).length, 1);
  assert.equal(newImages.filter(url => url === patch.expectedImageUrl).length, 0);
  assert.ok(!updatedBody.includes(marker), "The paywall marker must not be in the private-only body.");
  const now = new Date().toISOString();
  const oldVersion = Number(priv.contentVersion?.integerValue || 1);
  const version = oldVersion + 1;
  const privateHash = digest(updatedBody);
  const nextPub = {
    ...pub, paidContentHash: str(privateHash), paidContentVersion: int(version), updatedAt: timestamp(now)
  };
  const nextPriv = {
    ...priv, content: str(updatedBody), contentHash: str(privateHash), contentVersion: int(version),
    previousContentBackup: str(oldBody), previousContentHashBackup: str(priv.contentHash?.stringValue || ""),
    previousContentVersionBackup: int(oldVersion), previousBackupAt: timestamp(now),
    source: str("github-encrypted-member-amendment:20261011"), updatedAt: timestamp(now)
  };
  const writes = [
    { update: { name: publicDoc.name, fields: nextPub }, currentDocument: { updateTime: publicDoc.updateTime } },
    { update: { name: privateDoc.name, fields: nextPriv }, currentDocument: { updateTime: privateDoc.updateTime } }
  ];
  await request(":commit", { method: "POST", data: { writes } });
  const [verifyPub, verifyPriv] = await Promise.all([
    request("/articles/" + ARTICLE_ID), request("/paidArticleBodies/" + ARTICLE_ID)
  ]);
  assert.equal(verifyPub.fields.content.stringValue, pub.content.stringValue, "Free preview cannot change.");
  assert.equal(verifyPub.fields.accessType.stringValue, "paid");
  assert.equal(verifyPriv.fields.content.stringValue, updatedBody, "Private story update could not be verified.");
  assert.equal(verifyPriv.fields.contentHash.stringValue, privateHash);
  assert.equal(Number(verifyPriv.fields.contentVersion.integerValue), version);
  const unauth = await fetch(root + "/paidArticleBodies/" + ARTICLE_ID, { signal: AbortSignal.timeout(20000) });
  assert.equal(unauth.status, 403, "Anonymous access to paid story must stay blocked.");
  const report = {
    articleId: ARTICLE_ID, updated: true, articleStatus: "published", accessType: "paid",
    originalIllustrationsRetained: 9, newIllustrations: 0, updatedVersion: version,
    previewUnchanged: true, privateBodyVerified: true, anonymousPrivateReadStatus: unauth.status,
    articleUrl: "https://lyyuan.tw/articles.html?id=" + ARTICLE_ID
  };
  writeFileSync("/tmp/religious-light-halo-story-update-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => {
  console.error("HALO_STORY_PATCH_STOPPED: " + (error.code || error.name || "verification_error") + ": " + error.message);
  process.exitCode = 1;
});
