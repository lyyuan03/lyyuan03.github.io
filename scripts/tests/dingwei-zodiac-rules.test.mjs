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

await env.cleanup();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
