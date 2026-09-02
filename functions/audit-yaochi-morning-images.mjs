import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private key missing");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "lyyuan03-membership"
});
const db = getFirestore(app);

const ARTICLE_ID = "2026-yaochi-birthday-morning";
const snapshot = await db.doc(`eventArticleBodies/${ARTICLE_ID}`).get();
if (!snapshot.exists) throw new Error("Target article body not found");

const content = String(snapshot.data()?.content || "");
const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const images = [];
let match;
while ((match = re.exec(content))) {
  const rawSrc = match[2];
  const localPath = rawSrc.replace(/^https?:\/\/lyyuan\.tw\//i, "").split("?")[0].replace(/^\//, "");
  images.push({
    alt: match[1],
    src: rawSrc,
    localPath,
    exists: /^(?:https?:|data:|blob:)/i.test(rawSrc) && !/^https?:\/\/lyyuan\.tw\//i.test(rawSrc)
      ? "external"
      : existsSync(localPath)
  });
}
console.log("IMAGE_AUDIT_START");
console.log(JSON.stringify(images, null, 2));
console.log("IMAGE_AUDIT_END");
