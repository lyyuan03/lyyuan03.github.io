// 以 repo 現有 firestore.rules 驗證 2027 丁未年 12 生肖獨立閱讀權限（只在 Firestore 模擬器執行，不連正式資料）。
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";

const rules = readFileSync(process.argv[2], "utf8");
const env = await initializeTestEnvironment({ projectId: "demo-zodiac", firestore: { rules, host: "127.0.0.1", port: 8080 } });
const Z = ["rat","ox","tiger","rabbit","dragon","snake","horse","goat","monkey","rooster","dog","pig"];

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const z of Z) {
    await setDoc(doc(db, "articles", `dingwei-2027-${z}`), { status: "published", hidden: true, systemRecord: true, systemType: "lampLayer", accessType: "event", requiredPermission: `dingwei-2027-${z}`, content: "" });
    await setDoc(doc(db, "eventArticleBodies", `dingwei-2027-${z}`), { status: "published", active: true, requiredPermission: `dingwei-2027-${z}`, content: `secret-${z}` });
  }
  const ent = (email, permissions, extra = {}) => setDoc(doc(db, "memberEntitlements", email), { email, permissions, status: "active", ...extra });
  await ent("a@gmail.com", ["dingwei-2027-rat"]);
  await ent("b@gmail.com", ["dingwei-2027-rat", "dingwei-2027-ox", "2026-jinmu-am"]);
  await ent("c@gmail.com", ["2026-jinmu-am"]);
  await ent("d@example.com", ["dingwei-2027-rat"]);
  await ent("e@gmail.com", ["dingwei-2027-rat"], { disabled: true });
  // 草稿（未發布）外殼
  await setDoc(doc(db, "articles", "dingwei-2027-draft"), { status: "draft", accessType: "event", requiredPermission: "dingwei-2027-rat", content: "" });
  await setDoc(doc(db, "eventArticleBodies", "dingwei-2027-draft"), { status: "published", active: true, requiredPermission: "dingwei-2027-rat", content: "x" });
});

const user = (email, verified = true) => env.authenticatedContext(email, { email, email_verified: verified }).firestore();
const body = (db, z) => getDoc(doc(db, "eventArticleBodies", `dingwei-2027-${z}`));
const results = [];
const t = async (name, p) => { try { await p; results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); } };

const A = user("a@gmail.com"), B = user("b@gmail.com"), C = user("c@gmail.com");
await t("單一生肖：a 可讀鼠", assertSucceeds(body(A, "rat")));
for (const z of Z.filter((z) => z !== "rat")) await t(`單一生肖：a 不可讀${z}`, assertFails(body(A, z)));
await t("多生肖：b 可讀鼠", assertSucceeds(body(B, "rat")));
await t("多生肖：b 可讀牛", assertSucceeds(body(B, "ox")));
await t("多生肖：b 不可讀虎", assertFails(body(B, "tiger")));
await t("僅有其他活動權限：c 不可讀鼠", assertFails(body(C, "rat")));
await t("未登入不可讀", assertFails(body(env.unauthenticatedContext().firestore(), "rat")));
await t("Gmail 未驗證不可讀", assertFails(body(user("a@gmail.com", false), "rat")));
await t("非 Gmail 即使有權限不可讀", assertFails(body(user("d@example.com"), "rat")));
await t("停用帳號不可讀", assertFails(body(user("e@gmail.com"), "rat")));
await t("外殼未發布時不可讀", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-draft"))));
await t("不可列出全部正文", assertFails(getDocs(collection(B, "eventArticleBodies"))));
await t("可讀自己的權限文件（判斷生肖不符）", assertSucceeds(getDoc(doc(A, "memberEntitlements", "a@gmail.com"))));
await t("不可讀他人的權限文件", assertFails(getDoc(doc(A, "memberEntitlements", "b@gmail.com"))));
await t("不可自行加權限", assertFails(updateDoc(doc(A, "memberEntitlements", "a@gmail.com"), { permissions: ["dingwei-2027-ox"] })));
await t("不可改寫外殼文件", assertFails(updateDoc(doc(A, "articles", "dingwei-2027-rat"), { requiredPermission: "x" })));
await t("外殼文件公開可讀（只放標題，content 必須空）", assertSucceeds(getDoc(doc(C, "articles", "dingwei-2027-rat"))));

// ---- 管理頁 admin-zodiac-lamp.js 的寫入形狀（與 buildDocs 相同）----
import { writeBatch } from "firebase/firestore";
const ADMIN = user("lyyuan03@gmail.com");
const shellOf = (id, extra = {}) => ({ title: "t", slug: id, status: "published", hidden: true, systemRecord: true, systemType: "lampLayer", accessType: "event", eventId: id, requiredPermission: id, accessBadge: "年度點燈專屬", content: "", ...extra });
const bodyOf = (id, active = true) => ({ articleId: id, title: "t", requiredPermission: id, status: "published", active, content: "new-secret" });
const adminWrite = (db, id, active = true, extra = {}) => { const b = writeBatch(db); b.set(doc(db, "articles", id), shellOf(id, extra), { merge: true }); b.set(doc(db, "eventArticleBodies", id), bodyOf(id, active), { merge: true }); return b.commit(); };
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "memberEntitlements", "f@gmail.com"), { email: "f@gmail.com", permissions: ["dingwei-2027-new"], status: "active" }); });
await t("管理頁：管理員可建立新生肖外殼與正文", assertSucceeds(adminWrite(ADMIN, "dingwei-2027-new")));
await t("管理頁：管理員可更新既有生肖（鼠）", assertSucceeds(adminWrite(ADMIN, "dingwei-2027-rat")));
await t("管理頁：授權者可讀管理員寫入的正文", assertSucceeds(getDoc(doc(user("f@gmail.com"), "eventArticleBodies", "dingwei-2027-new"))));
await t("管理頁：未授權者不可讀新正文", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-new"))));
await t("管理頁：外殼帶正文會被拒絕（正文不得進公開文件）", assertFails(setDoc(doc(ADMIN, "articles", "dingwei-2027-leak"), shellOf("dingwei-2027-leak", { content: "secret" }))));
await t("管理頁：一般使用者不可寫正文", assertFails(setDoc(doc(A, "eventArticleBodies", "dingwei-2027-rat"), bodyOf("dingwei-2027-rat"))));
await t("管理頁：一般使用者不可寫外殼", assertFails(setDoc(doc(A, "articles", "dingwei-2027-x"), shellOf("dingwei-2027-x"))));
await t("管理頁：暫停開放", assertSucceeds(adminWrite(ADMIN, "dingwei-2027-new", false)));
await t("管理頁：暫停後授權者讀不到", assertFails(getDoc(doc(user("f@gmail.com"), "eventArticleBodies", "dingwei-2027-new"))));
await t("管理頁：暫停後管理員仍可讀", assertSucceeds(getDoc(doc(ADMIN, "eventArticleBodies", "dingwei-2027-new"))));

// ---- 管理頁「手動開通」：用 zodiac-lamp-grants.js 與管理頁相同的交易寫法 ----
import { runTransaction, query, where } from "firebase/firestore";
import { applyGrant, applyRevoke, MANUAL_SOURCE, ZODIAC_KEYS, permissionOf } from "./zodiac-lamp-grants.js";
const change = (db, email, mode, zodiacs, source = MANUAL_SOURCE) => runTransaction(db, async (tx) => {
  const ref = doc(db, "memberEntitlements", email);
  const snap = await tx.get(ref);
  const existing = snap.exists() ? snap.data() : null;
  const patch = mode === "grant" ? applyGrant(existing, zodiacs, source, { at: "T", by: "admin" }) : applyRevoke(existing, zodiacs, source);
  if (existing) tx.update(ref, patch); else tx.set(ref, { email, status: "active", schemaVersion: 1, eventPermissionsSource: "zodiac-lamp", ...patch });
});
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "memberEntitlements", "g@gmail.com"), { email: "g@gmail.com", permissions: ["2026-jinmu-am"], activityManagedPermissions: ["2026-jinmu-am"], paidArticleAccess: true, status: "inactive" }); });
await t("手動開通：管理員為新信眾開通四個生肖", assertSucceeds(change(ADMIN, "h@gmail.com", "grant", ["rat", "ox", "tiger", "goat"])));
for (const z of ["rat", "ox", "tiger", "goat"]) await t(`手動開通：h 可讀${z}`, assertSucceeds(body(user("h@gmail.com"), z)));
await t("手動開通：h 不可讀未點的狗", assertFails(body(user("h@gmail.com"), "dog")));
await t("手動開通：既有會員加開鼠", assertSucceeds(change(ADMIN, "g@gmail.com", "grant", ["rat"])));
await t("手動開通：g 可讀鼠", assertSucceeds(body(user("g@gmail.com"), "rat")));
await t("手動開通：status 為 inactive 的會員仍可讀（重建腳本會寫 inactive）", assertSucceeds(body(user("g@gmail.com"), "rat")));
await t("手動開通：g 原有活動權限與付費欄位保留", (async () => { const d = (await getDoc(doc(ADMIN, "memberEntitlements", "g@gmail.com"))).data(); if (!d.permissions.includes("2026-jinmu-am") || d.paidArticleAccess !== true || d.activityManagedPermissions[0] !== "2026-jinmu-am") throw new Error(JSON.stringify(d)); })());
await t("手動開通：訂單來源同時存在", assertSucceeds(change(ADMIN, "h@gmail.com", "grant", ["rat"], "order:A123")));
await t("手動撤銷：撤銷 h 的鼠、牛", assertSucceeds(change(ADMIN, "h@gmail.com", "revoke", ["rat", "ox"])));
await t("手動撤銷：h 的鼠有訂單來源，仍可讀", assertSucceeds(body(user("h@gmail.com"), "rat")));
await t("手動撤銷：h 的牛已不可讀", assertFails(body(user("h@gmail.com"), "ox")));
await t("手動撤銷：h 的虎未撤銷，仍可讀", assertSucceeds(body(user("h@gmail.com"), "tiger")));
await t("手動撤銷：撤銷 g 的鼠後活動權限仍在", (async () => { await change(ADMIN, "g@gmail.com", "revoke", ["rat"]); const d = (await getDoc(doc(ADMIN, "memberEntitlements", "g@gmail.com"))).data(); if (d.permissions.join() !== "2026-jinmu-am") throw new Error(JSON.stringify(d.permissions)); })());
await t("手動開通：一般使用者不可替自己開通", assertFails(change(user("i@gmail.com"), "i@gmail.com", "grant", ["rat"])));
await t("手動開通：一般使用者不可替他人開通", assertFails(change(A, "h@gmail.com", "grant", ["dog"])));
const listQuery = (db) => getDocs(query(collection(db, "memberEntitlements"), where("permissions", "array-contains-any", ZODIAC_KEYS.map(permissionOf))));
await t("名單：管理員可載入已開通名單", assertSucceeds(listQuery(ADMIN)));
await t("名單：一般使用者不可載入名單", assertFails(listQuery(A)));

// ---- 2026-11-15 閱讀系統稽核：補充必要情境 ----
for (const z of Z) await t(`稽核：管理員可讀${z}`, assertSucceeds(body(ADMIN, z)));
for (const z of Z) await t(`稽核：只有其他活動權限者不可讀${z}`, assertFails(body(C, z)));
for (const z of Z) await t(`稽核：未登入不可讀${z}`, assertFails(body(env.unauthenticatedContext().firestore(), z)));
await t("稽核：讀取不存在的正文文件被拒（不透露是否已建立）", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-none"))));
await t("稽核：一般使用者不可讀他人外殼以外的正文清單", assertFails(getDocs(collection(A, "eventArticleBodies"))));

// ---- 安全修正：isAdmin() 必須檢查 email_verified ----
// 目前只有 Google 登入一個管理員帳號，email_verified 一律為 true，所以修正不影響正常流程；
// 這裡模擬「未驗證信箱但使用 lyyuan03@gmail.com」的狀況，確認修正後會被拒絕（舊規則會放行）。
const UNVERIFIED_ADMIN = user("lyyuan03@gmail.com", false);
await t("安全修正：未驗證信箱的管理員不可寫入外殼", assertFails(setDoc(doc(UNVERIFIED_ADMIN, "articles", "dingwei-2027-adminverify"), shellOf("dingwei-2027-adminverify"))));
await t("安全修正：未驗證信箱的管理員不可寫入正文", assertFails(setDoc(doc(UNVERIFIED_ADMIN, "eventArticleBodies", "dingwei-2027-adminverify"), bodyOf("dingwei-2027-adminverify"))));
await t("安全修正：未驗證信箱的管理員不可讀他人權限文件", assertFails(getDoc(doc(UNVERIFIED_ADMIN, "memberEntitlements", "a@gmail.com"))));
await t("安全修正：已驗證信箱的管理員仍可正常寫入（相容性）", assertSucceeds(setDoc(doc(ADMIN, "articles", "dingwei-2027-adminverify"), shellOf("dingwei-2027-adminverify"))));

// ---- 安全修正：eventArticleBodies.requiredPermission 必須與對應 articles 文件一致 ----
// 模擬管理頁手動改錯正文的 requiredPermission 欄位（實際發生時是人為失誤或資料污染，
// 不是透過本站管理介面——介面一律同步寫入兩邊相同的值，見 admin-zodiac-lamp.js / article-admin-core.js）。
// 這裡刻意讓 articles/dingwei-2027-mismatch 宣告需要「鼠」權限，
// 但 eventArticleBodies/dingwei-2027-mismatch 卻標成「牛」權限、內容其實是鼠的專屬全文。
// 修正前：只有牛權限的人（b@gmail.com）就能讀到這篇「鼠」的全文，即使他沒有鼠的權限。
// 修正後：因為兩邊 requiredPermission 不一致，無論持有哪個生肖權限都必須被拒絕。
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "articles", "dingwei-2027-mismatch"), { status: "published", hidden: true, systemRecord: true, systemType: "lampLayer", accessType: "event", requiredPermission: "dingwei-2027-rat", content: "" });
  await setDoc(doc(db, "eventArticleBodies", "dingwei-2027-mismatch"), { status: "published", active: true, requiredPermission: "dingwei-2027-ox", content: "secret-rat-leaked-via-ox-permission" });
});
await t("安全修正：正文與外殼的 requiredPermission 不一致時，牛權限者不可讀（修正前會洩漏鼠的全文）", assertFails(getDoc(doc(B, "eventArticleBodies", "dingwei-2027-mismatch"))));
await t("安全修正：正文與外殼的 requiredPermission 不一致時，鼠權限者也不可讀", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-mismatch"))));
await t("安全修正：requiredPermission 不一致時管理員仍可讀（維運與除錯用）", assertSucceeds(getDoc(doc(ADMIN, "eventArticleBodies", "dingwei-2027-mismatch"))));
await t("安全修正：requiredPermission 一致時（鼠讀鼠）不受影響", assertSucceeds(body(A, "rat")));

// ---- 安全修正的邊界情況與其他活動相容性 ----
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  // 其他活動（金木年度活動）：外殼與正文權限一致，命名規則與生肖不同
  await setDoc(doc(db, "articles", "jinmu-am-article"), { status: "published", accessType: "event", requiredPermission: "2026-jinmu-am", content: "" });
  await setDoc(doc(db, "eventArticleBodies", "jinmu-am-article"), { status: "published", active: true, requiredPermission: "2026-jinmu-am", content: "jinmu-secret" });
  // 只有正文、沒有外殼
  await setDoc(doc(db, "eventArticleBodies", "dingwei-2027-noshell"), { status: "published", active: true, requiredPermission: "dingwei-2027-rat", content: "x" });
  // 外殼沒有 requiredPermission 欄位
  await setDoc(doc(db, "articles", "dingwei-2027-noperm"), { status: "published", accessType: "event", content: "" });
  await setDoc(doc(db, "eventArticleBodies", "dingwei-2027-noperm"), { status: "published", active: true, requiredPermission: "dingwei-2027-rat", content: "x" });
});
await t("相容性：金木活動權限者可讀自己的正文", assertSucceeds(getDoc(doc(B, "eventArticleBodies", "jinmu-am-article"))));
await t("相容性：沒有金木權限者（只有鼠）不可讀金木正文", assertFails(getDoc(doc(A, "eventArticleBodies", "jinmu-am-article"))));
await t("邊界：只有正文、沒有公開外殼時，有權限者也不可讀", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-noshell"))));
await t("邊界：外殼缺 requiredPermission 時，有權限者不可讀", assertFails(getDoc(doc(A, "eventArticleBodies", "dingwei-2027-noperm"))));
await t("邊界：未驗證信箱的管理員不可修改自己的權限文件", assertFails(setDoc(doc(UNVERIFIED_ADMIN, "memberEntitlements", "lyyuan03@gmail.com"), { email: "lyyuan03@gmail.com", permissions: ["dingwei-2027-rat"] })));
await t("邊界：管理員寫入時外殼與正文權限不同仍可（寫入不受此規則限制，讀取才驗證）", assertSucceeds(setDoc(doc(ADMIN, "eventArticleBodies", "dingwei-2027-adminwrite"), bodyOf("dingwei-2027-adminwrite"))));

await env.cleanup();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
