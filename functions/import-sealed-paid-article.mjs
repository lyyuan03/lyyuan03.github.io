import { readFile } from "node:fs/promises";
import { createHash, constants, createDecipheriv, privateDecrypt } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { blessingDiscernmentSpiritualPowerArticle as article } from "../article-blessing-discernment-spiritual-power.js";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const envelopePath = process.argv[2];
const expectedArticleId = process.env.ARTICLE_ID || "";
if (!envelopePath || !expectedArticleId) {
  throw new Error("Usage: ARTICLE_ID=<id> node import-sealed-paid-article.mjs <envelope.json>");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private_key missing");

const envelope = JSON.parse(await readFile(envelopePath, "utf8"));
const purpose = "lyyuan03/paid-article-import/v2-gzip";
if (
  envelope.version !== 2
  || envelope.purpose !== purpose
  || envelope.compression !== "gzip"
  || !envelope.keyId
) {
  throw new Error("Invalid sealed paid article envelope");
}

const key = privateDecrypt({
  key: serviceAccount.private_key,
  padding: constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: "sha256"
}, Buffer.from(envelope.wrappedKey, "base64"));

let plan;
try {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(Buffer.from(`${purpose}:${envelope.keyId}`));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final()
  ]);
  const plain = gunzipSync(compressed);
  const hash = createHash("sha256").update(plain).digest("hex");
  if (hash !== envelope.plaintextSha256) throw new Error("SEALED_PAYLOAD_HASH_MISMATCH");
  plan = JSON.parse(plain.toString("utf8"));
} finally {
  key.fill(0);
}

if (
  plan.articleId !== expectedArticleId
  || plan.accessType !== "paid"
  || plan.status !== "published"
  || !String(plan.privateContent || "").trim()
  || article.id !== expectedArticleId
  || article.accessType !== "paid"
) {
  throw new Error("Invalid sealed paid article payload");
}

const paidMarker = "<!-- paid-only -->";
const safeContent = String(article.content || "").trim();
if (!safeContent.endsWith(paidMarker)) {
  throw new Error("Public article must end with the paid marker");
}
if (safeContent.slice(0, -paidMarker.length).includes(paidMarker)) {
  throw new Error("Public article contains more than one paid marker");
}

const privateContent = String(plan.privateContent).trim();
const contentHash = createHash("sha256").update(privateContent).digest("hex");
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || "lyyuan03-membership"
});
const db = getFirestore(app);
const articleRef = db.doc(`articles/${article.id}`);
const privateRef = db.doc(`paidArticleBodies/${article.id}`);

const [articleSnap, privateSnap] = await Promise.all([articleRef.get(), privateRef.get()]);
const existingPrivate = privateSnap.exists ? privateSnap.data() || {} : {};
const previousContent = String(existingPrivate.content || "");
const previousHash = String(existingPrivate.contentHash || "");
const previousVersion = Math.max(0, Number(existingPrivate.contentVersion || 0));
const changed = previousContent !== privateContent || previousHash !== contentHash;
const contentVersion = changed ? previousVersion + 1 : Math.max(1, previousVersion);

const privateData = {
  articleId: article.id,
  title: article.title,
  status: "published",
  content: privateContent,
  contentHash,
  contentVersion,
  source: "sealed-github-import:20260929-blessing-discernment-v2",
  active: true,
  updatedAt: FieldValue.serverTimestamp()
};
if (!privateSnap.exists) privateData.createdAt = FieldValue.serverTimestamp();
if (privateSnap.exists && changed) {
  privateData.previousContentBackup = previousContent;
  privateData.previousContentHashBackup = previousHash;
  privateData.previousContentVersionBackup = previousVersion;
  privateData.previousBackupAt = FieldValue.serverTimestamp();
}

const publishedAt = Timestamp.fromDate(new Date(article.publishedAt));
const articleData = {
  title: article.title,
  slug: article.slug,
  category: article.category,
  displayCategory: article.displayCategory || "靈修",
  series: article.series || "靈修辨證",
  status: "published",
  publishedAt,
  excerpt: article.excerpt || "",
  coverImage: article.coverImage || "",
  thumbnailImage: article.thumbnailImage || "",
  sharePath: article.sharePath || "",
  bookTitle: article.bookTitle || "",
  bookAuthor: article.bookAuthor || "",
  bookPublisher: article.bookPublisher || "",
  bookPurchaseUrl: article.bookPurchaseUrl || "",
  bookCoverImage: article.bookCoverImage || "",
  accessType: "paid",
  eventId: "",
  content: safeContent,
  privatePaidContent: true,
  paidContentHash: contentHash,
  paidContentVersion: contentVersion,
  encryptedContent: "",
  eventIv: "",
  encryption: "",
  magicLinkAccess: {},
  sealedImportRevision: "20260929-blessing-discernment-v2",
  updatedAt: FieldValue.serverTimestamp()
};
if (!articleSnap.exists) articleData.createdAt = FieldValue.serverTimestamp();

const batch = db.batch();
batch.set(privateRef, privateData, { merge: true });
batch.set(articleRef, articleData, { merge: true });
await batch.commit();

const [verifyArticle, verifyPrivate] = await Promise.all([articleRef.get(), privateRef.get()]);
const af = verifyArticle.data() || {};
const pf = verifyPrivate.data() || {};
if (
  af.status !== "published"
  || af.accessType !== "paid"
  || String(af.content || "") !== safeContent
  || af.paidContentHash !== contentHash
  || Number(af.paidContentVersion || 0) !== contentVersion
  || pf.status !== "published"
  || pf.active !== true
  || String(pf.content || "") !== privateContent
  || pf.contentHash !== contentHash
  || Number(pf.contentVersion || 0) !== contentVersion
) {
  throw new Error("Sealed paid article verification failed");
}

console.log(JSON.stringify({
  status: "ok",
  articleId: article.id,
  contentVersion,
  publicCharacters: safeContent.length,
  privateCharacters: privateContent.length,
  contentHash
}));
