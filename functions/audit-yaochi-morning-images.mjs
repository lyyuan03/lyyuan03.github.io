import { existsSync, readFileSync } from "node:fs";
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
const targetBytes = readFileSync("assets/articles/yaochi-birthday-morning/03-lotus-offerings.jpeg");
function findSignature(bytes, pattern) {
  for (let i = 0; i <= bytes.length - pattern.length; i += 1) {
    let ok = true;
    for (let j = 0; j < pattern.length; j += 1) {
      if (bytes[i + j] !== pattern[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}
console.log("TARGET_SIGNATURES", JSON.stringify({
  jpegSOI: findSignature(targetBytes, [0xff,0xd8,0xff]),
  jpegEOI: findSignature(targetBytes, [0xff,0xd9]),
  png: findSignature(targetBytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  riff: findSignature(targetBytes, [0x52,0x49,0x46,0x46]),
  ftyp: findSignature(targetBytes, [0x66,0x74,0x79,0x70])
}));
const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const images = [];
let match;
while ((match = re.exec(content))) {
  const rawSrc = match[2];
  const localPath = rawSrc.replace(/^https?:\/\/lyyuan\.tw\//i, "").split("?")[0].replace(/^\//, "");
  const publicUrl = /^(?:https?:)/i.test(rawSrc) ? rawSrc : `https://lyyuan.tw/${rawSrc.replace(/^\//, "")}`;
  let http = null;
  try {
    const response = await fetch(publicUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    http = {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type") || "",
      length: bytes.length,
      firstBytesHex: [...bytes.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("")
    };
  } catch (error) {
    http = { error: error.message };
  }
  images.push({
    alt: match[1],
    src: rawSrc,
    localPath,
    existsInRepo: /^(?:https?:|data:|blob:)/i.test(rawSrc) && !/^https?:\/\/lyyuan\.tw\//i.test(rawSrc)
      ? "external"
      : existsSync(localPath),
    repoFirstBytesHex: existsSync(localPath)
      ? [...readFileSync(localPath).subarray(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("")
      : "",
    publicUrl,
    http
  });
}
console.log("IMAGE_AUDIT_START");
console.log(JSON.stringify(images, null, 2));
console.log("IMAGE_AUDIT_END");
