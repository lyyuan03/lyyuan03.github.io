import { createHash } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private key missing");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "lyyuan03-membership"
});
const db = getFirestore(app);

const ARTICLE_ID = "2026-yaochi-birthday-morning";
const broken = "![祝壽供桌與靈位](assets/articles/yaochi-birthday-morning/03-lotus-offerings.jpeg?v=20260829-2)";
const replacement = "![祝壽供桌與靈位](assets/yaochi-purpose-birthday.webp?v=20260902-image-repair-1)";
const candidateUrl = "https://lyyuan.tw/assets/yaochi-purpose-birthday.webp?v=20260902-image-repair-1";

const response = await fetch(candidateUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
const bytes = new Uint8Array(await response.arrayBuffer());
const isWebp = bytes.length > 12
  && String.fromCharCode(...bytes.slice(0,4)) === "RIFF"
  && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
if (!response.ok || !isWebp) {
  throw new Error(`Replacement image is not a valid public WebP: status=${response.status}`);
}

const ref = db.doc(`eventArticleBodies/${ARTICLE_ID}`);
const snapshot = await ref.get();
if (!snapshot.exists) throw new Error("Target article body not found");

const current = snapshot.data() || {};
const content = String(current.content || "");
if (!content.includes(broken)) {
  if (content.includes(replacement)) {
    console.log(JSON.stringify({ articleId: ARTICLE_ID, status: "already-repaired", changed: false }));
    process.exit(0);
  }
  throw new Error("Exact broken image reference not found; refusing to modify other content");
}

const nextContent = content.replace(broken, replacement);
if (nextContent === content) throw new Error("No change produced");

const contentHash = createHash("sha256").update(nextContent).digest("hex");
await ref.set({
  content: nextContent,
  contentHash,
  previousContentBackup: content,
  imageRepair20260902: {
    alt: "祝壽供桌與靈位",
    previousSrc: "assets/articles/yaochi-birthday-morning/03-lotus-offerings.jpeg?v=20260829-2",
    replacementSrc: "assets/yaochi-purpose-birthday.webp?v=20260902-image-repair-1",
    reason: "original repository asset is not a decodable JPEG"
  },
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

const verify = await ref.get();
const saved = String(verify.data()?.content || "");
if (!saved.includes(replacement) || saved.includes(broken)) {
  throw new Error("Article image repair verification failed");
}

console.log(JSON.stringify({
  articleId: ARTICLE_ID,
  status: "repaired",
  changed: true,
  replacementImageStatus: response.status,
  replacementBytes: bytes.length,
  contentHash
}));
