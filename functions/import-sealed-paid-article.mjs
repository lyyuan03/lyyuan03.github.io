import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { openPlan } from "./jinmu-import-envelope.mjs";

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
const plan = openPlan(envelope, serviceAccount.private_key, envelope.keyId);

if (
  plan.articleId !== expectedArticleId
  || plan.accessType !== "paid"
  || plan.status !== "published"
  || !String(plan.publicContent || "").trim()
  || !String(plan.privateContent || "").trim()
) {
  throw new Error("Invalid sealed paid article payload");
}

const publicContent = String(plan.publicContent).trim();
const privateContent = String(plan.privateContent).trim();
const paidMarker = "<!-- paid-only -->";
if (publicContent.includes(paidMarker) || privateContent.includes(paidMarker)) {
  throw new Error("Payload content must not contain the paid marker");
}
const safeContent = `${publicContent}\n\n${paidMarker}`;
const contentHash = createHash("sha256").update(privateContent).digest("hex");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id || "lyyuan03-membership"
});
const db = getFirestore(app);
const articleRef = db.doc(`articles/${plan.articleId}`);
const privateRef = db.doc(`paidArticleBodies/${plan.articleId}`);

const [articleSnap, privateSnap] = await Promise.all([articleRef.get(), privateRef.get()]);
const existingPrivate = privateSnap.exists ? privateSnap.data() || {} : {};
const previousContent = String(existingPrivate.content || "");
const previousHash = String(existingPrivate.contentHash || "");
const previousVersion = Math.max(0, Number(existingPrivate.contentVersion || 0));
const changed = previousContent !== privateContent || previousHash !== contentHash;
const contentVersion = changed ? previousVersion + 1 : Math.max(1, previousVersion);

const publishedAt = Timestamp.fromDate(new Date(plan.publishedAt));
const batch = db.batch();

const privateData = {
  articleId: plan.articleId,
  title: plan.title,
  status: "published",
  content: privateContent,
  contentHash,
  contentVersion,
  source: "sealed-github-import:20260929-blessing-discernment",
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
batch.set(privateRef, privateData, { merge: true });

const articleData = {
  title: plan.title,
  slug: plan.slug,
  category: plan.category,
  displayCategory: plan.displayCategory || "靈修",
  series: plan.series || "靈修辨證",
  status: "published",
  publishedAt,
  excerpt: plan.excerpt || "",
  coverImage: plan.coverImage || "",
  thumbnailImage: plan.thumbnailImage || "",
  sharePath: plan.sharePath || "",
  bookTitle: plan.bookTitle || "",
  bookAuthor: plan.bookAuthor || "",
  bookPublisher: plan.bookPublisher || "",
  bookPurchaseUrl: plan.bookPurchaseUrl || "",
  bookCoverImage: plan.bookCoverImage || "",
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
  sealedImportRevision: "20260929-blessing-discernment-1",
  updatedAt: FieldValue.serverTimestamp()
};
if (!articleSnap.exists) articleData.createdAt = FieldValue.serverTimestamp();
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
  articleId: plan.articleId,
  contentVersion,
  publicCharacters: publicContent.length,
  privateCharacters: privateContent.length,
  contentHash
}));
