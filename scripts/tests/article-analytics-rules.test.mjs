// 僅在本機 Firestore 模擬器執行：文章月報的隱私與寫入權限。
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, Timestamp } from "firebase/firestore";

const rules = readFileSync(process.argv[2], "utf8");
const env = await initializeTestEnvironment({
  projectId: "demo-article-analytics",
  firestore: { rules, host: "127.0.0.1", port: 8080 }
});
const month = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit"
}).format(new Date());
const previousMonth = (() => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
})();
const good = env.authenticatedContext("reader-uid", {
  email: "reader@gmail.com", email_verified: true
}).firestore();
const other = env.authenticatedContext("other-uid", {
  email: "other@gmail.com", email_verified: true
}).firestore();
const unverified = env.authenticatedContext("reader-uid", {
  email: "reader@gmail.com", email_verified: false
}).firestore();
const admin = env.authenticatedContext("admin-uid", {
  email: "lyyuan03@gmail.com", email_verified: true
}).firestore();
const fakeAdmin = env.authenticatedContext("admin-uid", {
  email: "lyyuan03@gmail.com", email_verified: false
}).firestore();
const guest = env.unauthenticatedContext().firestore();
const path = (db, id = "reader-uid__monthly-paid", selectedMonth = month) =>
  doc(db, "articleMonthlyReaders", selectedMonth, "readers", id);
const payload = (extra = {}) => ({
  uid: "reader-uid",
  articleId: "monthly-paid",
  articleDocId: "firestore-paid-document",
  source: "google",
  viewedAt: serverTimestamp(),
  ...extra
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "articles", "firestore-paid-document"), {
    status: "published", slug: "monthly-paid", accessType: "paid",
    publishedAt: Timestamp.fromDate(new Date("2026-10-01T00:00:00Z"))
  });
  await setDoc(doc(db, "articles", "draft-document"), {
    status: "draft", slug: "draft-paid", accessType: "paid"
  });
  await setDoc(doc(db, "articles", "open-article"), {
    status: "published", slug: "open-article", accessType: "open"
  });
  await setDoc(doc(db, "sponsorMemberAccess", "reader@gmail.com"), {
    email: "reader@gmail.com", memberType: "sponsor-member",
    status: "active", paymentStatus: "paid", articleAccess: true,
    accessScope: "sponsor-paid-articles", accessVersion: 2,
    articleWindowStartsAt: Timestamp.fromMillis(0),
    expiresAt: Timestamp.fromDate(new Date("2099-01-01T00:00:00Z"))
  });
});

const results = [];
async function test(name, promise) {
  try { await promise; results.push(["PASS", name]); }
  catch (error) { results.push(["FAIL", name, error.message]); }
}

await test("未登入不可寫入", assertFails(setDoc(path(guest), payload())));
await test("未驗證信箱不可寫入", assertFails(setDoc(path(unverified), payload())));
await test("不能冒用其他 UID", assertFails(setDoc(path(other), payload())));
await test("文章 slug 必須與 Firestore 外殼一致", assertFails(setDoc(path(good), payload({ articleId: "wrong-slug" }))));
await test("未發布文章不可納入統計", assertFails(setDoc(
  path(good, "reader-uid__draft-paid"), payload({ articleId: "draft-paid", articleDocId: "draft-document" })
)));
await test("不能冒用不存在的文章", assertFails(setDoc(
  path(good, "reader-uid__made-up"), payload({ articleId: "made-up", articleDocId: "made-up" })
)));
await test("過去月份不能新增閱讀紀錄", assertFails(setDoc(
  path(good, "reader-uid__monthly-paid", previousMonth), payload()
)));
await test("讀者可以記錄本月首次閱讀", assertSucceeds(setDoc(path(good), payload())));
await test("同 UID 同篇同月不可覆寫第一筆紀錄", assertFails(setDoc(path(good), payload({ source: "facebook" }))));
await test("本人不可讀取含 UID 的紀錄", assertFails(getDoc(path(good))));
await test("其他會員不可讀取紀錄", assertFails(getDoc(path(other))));
await test("管理員可讀取", assertSucceeds(getDoc(path(admin))));
await test("管理員可依月份列出", assertSucceeds(getDocs(collection(admin, "articleMonthlyReaders", month, "readers"))));
await test("未驗證管理員不可列出", assertFails(getDocs(collection(fakeAdmin, "articleMonthlyReaders", month, "readers"))));
await test("未授權會員可記錄一般閱讀", assertSucceeds(setDoc(
  path(other, "other-uid__monthly-paid"), {
    uid: "other-uid", articleId: "monthly-paid", articleDocId: "firestore-paid-document",
    source: "direct", viewedAt: serverTimestamp()
  }
)));
await test("未授權會員不能替自己偽造付費解鎖", assertFails(updateDoc(
  path(other, "other-uid__monthly-paid"), { unlockedAt: serverTimestamp() }
)));
await test("付費文章未解鎖前不能填寫已讀完", assertFails(updateDoc(
  path(other, "other-uid__monthly-paid"), { completedAt: serverTimestamp() }
)));
await test("有付費閱讀權限的會員可登記首次解鎖", assertSucceeds(updateDoc(path(good), { unlockedAt: serverTimestamp() })));
await test("同會員不能重複解鎖", assertFails(updateDoc(path(good), { unlockedAt: serverTimestamp() })));
await test("解鎖後可登記首次讀至 90%", assertSucceeds(updateDoc(path(good), { completedAt: serverTimestamp() })));
await test("閱讀完成不能重複登記", assertFails(updateDoc(path(good), { completedAt: serverTimestamp() })));
await test("不得修改文章代稱", assertFails(updateDoc(path(good), { articleId: "open-article" })));
await test("不得變更歸屬 UID", assertFails(updateDoc(path(good), { uid: "other-uid" })));
await test("任何會員不能刪除紀錄", assertFails(deleteDoc(path(good))));
await test("其他已登入者可記錄免費文章", assertSucceeds(setDoc(
  path(other, "other-uid__open-article"), {
    uid: "other-uid", articleId: "open-article",
    articleDocId: "open-article", source: "direct", viewedAt: serverTimestamp()
  }
)));
await test("免費文章不需付費解鎖即可記錄完成", assertSucceeds(updateDoc(
  path(other, "other-uid__open-article"), { completedAt: serverTimestamp() }
)));

await env.cleanup();
for (const result of results) console.log(result.join("  "));
const failures = results.filter(([status]) => status === "FAIL").length;
console.log(`\n文章月報規則：${results.length - failures}/${results.length} 通過`);
process.exit(failures ? 1 : 0);
