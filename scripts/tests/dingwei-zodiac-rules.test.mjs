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

await env.cleanup();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
