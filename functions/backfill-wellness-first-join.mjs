// 一次性補齊：養生會員 wellnessFirstJoinMonth 與會員影片 publishedMonth。
// 預設只列出結果（dry run）；確認無誤後加上 --apply 才會寫入。
// 用法（需具 Firestore 權限的服務帳戶）：
//   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node backfill-wellness-first-join.mjs [--apply]
import { createRequire } from "node:module";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { resolveFirstJoinMonth, videoPublishedMonth } = require("./wellness-first-join.js");

const apply = process.argv.includes("--apply");
// --mask：公開的 Actions 紀錄中遮蔽 email（例：si***@gmail.com）。
const mask = process.argv.includes("--mask");
const show = (email) => {
  if (!mask) return email;
  const [local = "", domain = ""] = String(email).split("@");
  return `${local.slice(0, 2)}***@${domain}`;
};
const manual = [];
const noDateVideos = [];
initializeApp({ credential: applicationDefault(), projectId: "lyyuan03-membership" });
const db = getFirestore();

const members = await db.collection("memberAccess").where("memberType", "==", "wellness-channel").get();
let memberUpdates = 0;
for (const snapshot of members.docs) {
  const member = snapshot.data() || {};
  const historySnapshot = await db.doc(`membershipHistory/${snapshot.id}`).get();
  const history = historySnapshot.exists ? historySnapshot.data() || {} : {};
  const month = resolveFirstJoinMonth(member, history);
  const changed = month && member.wellnessFirstJoinMonth !== month;
  if (!month) manual.push(show(snapshot.id));
  console.log(`${changed ? "UPDATE" : "keep  "} ${show(snapshot.id)}\t${member.wellnessFirstJoinMonth || "-"} -> ${month || "（無法推估，需人工設定）"}`);
  if (changed) {
    memberUpdates += 1;
    if (apply) {
      await snapshot.ref.set({ wellnessFirstJoinMonth: month }, { merge: true });
      await db.doc(`membershipHistory/${snapshot.id}`).set({ email: snapshot.id, wellnessFirstJoinMonth: month }, { merge: true });
    }
  }
}

const videos = await db.collection("memberVideos").get();
let videoUpdates = 0;
for (const snapshot of videos.docs) {
  const video = snapshot.data() || {};
  const month = videoPublishedMonth(video);
  const changed = month && video.publishedMonth !== month;
  if (!month) noDateVideos.push(`${snapshot.id} ${video.title || ""}`);
  console.log(`${changed ? "UPDATE" : "keep  "} video ${snapshot.id}\t${video.title || ""}\t${video.publishedAt || "-"} -> ${month || "（未設定發布日期，會員將無法觀看）"}`);
  if (changed) {
    videoUpdates += 1;
    if (apply) await snapshot.ref.set({ publishedMonth: month }, { merge: true });
  }
}

console.log(`\n養生會員總數 ${members.size}；影片總數 ${videos.size}`);
console.log(`需人工設定（無法推估）${manual.length} 筆：${manual.join(", ") || "無"}`);
console.log(`未設定發布日期影片 ${noDateVideos.length} 部：${noDateVideos.join(" | ") || "無"}`);
console.log(`會員需更新 ${memberUpdates} 筆、影片需更新 ${videoUpdates} 筆。${apply ? "已寫入。" : "（dry run，未寫入；加上 --apply 執行）"}`);
