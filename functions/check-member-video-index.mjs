// 唯讀：以會員頁相同的查詢形狀檢查 memberVideos 複合索引是否可用。
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "lyyuan03-membership" });
const db = getFirestore();
for (let attempt = 1; attempt <= 40; attempt += 1) {
  try {
    const snapshot = await db.collection("memberVideos")
      .where("status", "==", "published").where("accessLevel", "==", "wellness")
      .where("publishedMonth", ">=", "2000-01").limit(1).get();
    console.log(`索引可用（查詢成功，取得 ${snapshot.size} 筆）`);
    process.exit(0);
  } catch (error) {
    const msg = String(error?.message || error);
    if (/index is currently building/i.test(msg)) { console.log(`索引建立中，30 秒後重試（${attempt}/40）`); await new Promise(r => setTimeout(r, 30000)); continue; }
    console.error(`索引檢查失敗：${msg.split("\n")[0].replace(/https:\S+/g, "[link]")}`);
    process.exit(1);
  }
}
console.error("等待逾時（約 20 分鐘）");
process.exit(1);
