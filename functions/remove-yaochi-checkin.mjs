import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private key missing");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "lyyuan03-membership"
});
const db = getFirestore(app);

const ARTICLE_ID = "2026-yaochi-birthday-morning";
const bodyRef = db.doc(`eventArticleBodies/${ARTICLE_ID}`);
const snapshot = await bodyRef.get();

if (!snapshot.exists) throw new Error("Target article body not found");

const current = snapshot.data() || {};
const content = String(current.content || "");
if (!content) throw new Error("Target article body is empty");

if (!content.includes("信眾報到")) {
  console.log(JSON.stringify({
    articleId: ARTICLE_ID,
    status: "already-removed",
    changed: false
  }));
  process.exit(0);
}

// 僅移除含「信眾報到」的完整句子；其餘文字、段落、圖片與排序完全保留。
const sentencePattern = /[^。！？\n]*信眾報到[^。！？\n]*[。！？]?/g;
const matches = content.match(sentencePattern) || [];
if (!matches.length) throw new Error("Check-in mention found but sentence match failed");

const nextContent = content
  .replace(sentencePattern, "")
  .replace(/\n[ \t]+\n/g, "\n\n");

if (nextContent === content) throw new Error("No content change was produced");
if (nextContent.includes("信眾報到")) throw new Error("Check-in mention still remains after edit");

const contentHash = createHash("sha256").update(nextContent).digest("hex");

await bodyRef.set({
  content: nextContent,
  contentHash,
  previousContentBackup: content,
  checkinMentionRemovalVersion: 1,
  checkinMentionRemovalSource: "github-one-time-20260902",
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

const verify = await bodyRef.get();
const saved = String(verify.data()?.content || "");
if (saved !== nextContent) throw new Error("Saved article body verification failed");
if (saved.includes("信眾報到")) throw new Error("Saved article still contains check-in mention");

console.log(JSON.stringify({
  articleId: ARTICLE_ID,
  status: "updated",
  changed: true,
  removedSentences: matches.length,
  removedText: matches,
  charactersBefore: content.length,
  charactersAfter: nextContent.length,
  contentHash
}));
