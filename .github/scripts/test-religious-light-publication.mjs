import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, createPublicKey, generateKeyPairSync, publicEncrypt, randomBytes, constants } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ARTICLE_ID, decryptEnvelope, validatePayload, buildWrites } from "./publish-religious-light-member-article.mjs";
import { religiousLightInnerPersonArticle } from "../../article-religious-light-inner-person-yuanshen.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const filenames = ["00-cover", "01-alchemy", "02-teacher", "03-temple", "04-bedroom", "05-mirror", "06-halo", "07-light-shadow", "08-farewell", "09-temple-spirit"];
function payload() {
  const imageAssets = filenames.map(filename => ({ filename: `${filename}.jpeg`, url: `https://lyyuan.tw/assets/articles/${ARTICLE_ID}/${filename}.jpeg`, sha256: "a".repeat(64) }));
  return {
    ...religiousLightInnerPersonArticle,
    coverImage: imageAssets[0].url,
    thumbnailImage: imageAssets[0].url,
    imageAssets,
    content: religiousLightInnerPersonArticle.content + "\n\n" + "會員測試段落。".repeat(200) + "\n\n" + imageAssets.slice(1).map(asset => `![配圖](${asset.url})`).join("\n\n")
  };
}

test("the public-key envelope decrypts only for its recipient and rejects tampering", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const source = payload();
  const plain = Buffer.from(JSON.stringify(source));
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(ARTICLE_ID));
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  const envelope = {
    format: "lyyuan-paid-article-rsa-aes-gcm-v1", articleId: ARTICLE_ID,
    recipientKeySha256: hash(createPublicKey(privateKey).export({ type: "spki", format: "der" })),
    payloadSha256: hash(plain), encryptedKey: publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key).toString("base64"),
    iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64")
  };
  assert.deepEqual(decryptEnvelope(envelope, privateKey), source);
  const broken = Buffer.from(ciphertext); broken[0] ^= 1;
  assert.throws(() => decryptEnvelope({ ...envelope, ciphertext: broken.toString("base64") }, privateKey));
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() => decryptEnvelope(envelope, other.privateKey));
});

test("the payload requires the complete private body, nine illustrations and a separate cover", () => {
  const source = payload();
  const split = validatePayload(source);
  assert.ok(split.safeContent.endsWith("<!-- paid-only -->"));
  assert.equal(split.safeContent.split("<!-- paid-only -->")[1], "");
  assert.throws(() => validatePayload({ ...source, content: source.content.split("<!-- paid-only -->")[0] }));
  assert.throws(() => validatePayload({ ...source, id: "another-article" }));
  assert.throws(() => validatePayload({ ...source, content: source.content + `\n![重複封面](${source.coverImage})` }));
});

test("the two guarded writes keep private content and legacy backups out of the public document", () => {
  const source = payload(), split = validatePayload(source);
  const now = "2026-10-10T10:00:00.000Z";
  const previousPublic = { updateTime: now, fields: { previousContentBackup: { stringValue: "PRIVATE_LEGACY_TEXT" }, publishedAt: { timestampValue: "2026-10-09T10:00:00.000Z" } } };
  const previousPrivate = { updateTime: now, fields: { content: { stringValue: "PRIVATE_OLD_BODY" }, contentVersion: { integerValue: "2" } } };
  const result = buildWrites(source, split, "published", previousPublic, previousPrivate, now);
  assert.equal(result.writes.length, 2);
  const publicFields = result.writes[0].update.fields;
  assert.equal(publicFields.content.stringValue, split.safeContent);
  assert.ok(!JSON.stringify(publicFields).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(publicFields).includes(split.privateContent));
  assert.equal(publicFields.publishedAt.timestampValue, previousPublic.fields.publishedAt.timestampValue);
  assert.equal(result.writes[1].update.fields.content.stringValue, split.privateContent);
  assert.equal(result.writes[1].update.fields.previousContentBackup.stringValue, "PRIVATE_OLD_BODY");
  assert.equal(result.version, 3);
  assert.deepEqual(result.writes.map(write => write.currentDocument), [{ updateTime: now }, { updateTime: now }]);
});

test("new drafts are private and unchanged imports retain their content version", () => {
  const source = payload(), split = validatePayload(source), now = "2026-10-10T10:00:00.000Z";
  const first = buildWrites(source, split, "draft", null, null, now);
  assert.equal(first.writes[0].update.fields.status.stringValue, "draft");
  assert.equal(first.writes[1].update.fields.status.stringValue, "draft");
  assert.equal(first.writes[0].update.fields.publishedAt, undefined);
  assert.deepEqual(first.writes.map(write => write.currentDocument), [{ exists: false }, { exists: false }]);
  const priorPrivate = { updateTime: now, fields: first.writes[1].update.fields };
  const repeat = buildWrites(source, split, "draft", null, priorPrivate, now);
  assert.equal(first.version, repeat.version);
});
