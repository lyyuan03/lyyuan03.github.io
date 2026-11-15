// 以 repo 現有 storage.rules 驗證管理員上傳與公開讀取邊界（只在 Storage 模擬器執行，不連正式資料）。
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const rules = readFileSync(process.argv[2], "utf8");
const env = await initializeTestEnvironment({ projectId: "demo-storage", storage: { rules, host: "127.0.0.1", port: 9199 } });

const ADMIN = "lyyuan03@gmail.com";
const ctx = (email, verified = true) => env.authenticatedContext(email, { email, email_verified: verified }).storage();
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const meta = (contentType = "image/webp") => ({ contentType });

await env.withSecurityRulesDisabled(async (c) => {
  await uploadBytes(ref(c.storage(), "articles/seed/existing.webp"), png(), meta());
  await uploadBytes(ref(c.storage(), "private/secret.txt"), png(), meta("text/plain"));
});

const results = [];
const t = async (name, p) => { try { await p; results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); } };
const up = (s, path, bytes = png(), m = meta()) => uploadBytes(ref(s, path), bytes, m);

const admin = ctx(ADMIN);
// 正向：管理員（已驗證）既有用途
await t("正向：已驗證管理員可上傳圖片到 articles/", assertSucceeds(up(admin, "articles/a1/new.webp")));
await t("正向：已驗證管理員可上傳 jpeg 到 articles/ 子層", assertSucceeds(up(admin, "articles/a1/deep/x.jpg", png(), meta("image/jpeg"))));
await t("正向：已驗證管理員可覆寫既有圖片", assertSucceeds(up(admin, "articles/seed/existing.webp")));
// 反向：管理員身分但信箱未驗證
await t("反向：管理員信箱未驗證不可上傳", assertFails(up(ctx(ADMIN, false), "articles/a1/unverified.webp")));
await t("反向：管理員信箱未驗證不可刪除", assertFails(deleteObject(ref(ctx(ADMIN, false), "articles/seed/existing.webp"))));
// 反向：非管理員
await t("反向：已驗證的一般會員不可上傳", assertFails(up(ctx("member@gmail.com"), "articles/a1/m.webp")));
await t("反向：近似信箱不可上傳", assertFails(up(ctx("lyyuan03@gmail.com.evil.com"), "articles/a1/e.webp")));
await t("反向：大小寫不同的信箱不可上傳", assertFails(up(ctx("Lyyuan03@gmail.com"), "articles/a1/c.webp")));
await t("反向：未登入不可上傳", assertFails(up(env.unauthenticatedContext().storage(), "articles/a1/u.webp")));
await t("反向：一般會員不可刪除", assertFails(deleteObject(ref(ctx("member@gmail.com"), "articles/seed/existing.webp"))));
await t("反向：未登入不可刪除", assertFails(deleteObject(ref(env.unauthenticatedContext().storage(), "articles/seed/existing.webp"))));
// 反向：管理員的內容限制仍有效
await t("反向：管理員不可上傳非圖片", assertFails(up(admin, "articles/a1/x.html", png(), meta("text/html"))));
await t("反向：管理員不可上傳超過 10MB 的圖片", assertFails(up(admin, "articles/a1/big.webp", new Uint8Array(10 * 1024 * 1024 + 1))));
// 路徑邊界
await t("反向：管理員不可寫入 articles/ 以外路徑", assertFails(up(admin, "other/x.webp")));
await t("反向：管理員不可讀取 articles/ 以外路徑", assertFails(getBytes(ref(admin, "private/secret.txt"))));
await t("反向：未登入不可讀取 articles/ 以外路徑", assertFails(getBytes(ref(env.unauthenticatedContext().storage(), "private/secret.txt"))));
await t("反向：一般會員不可讀取 articles/ 以外路徑", assertFails(getBytes(ref(ctx("member@gmail.com"), "private/secret.txt"))));
// 公開讀取（文章配圖本來就公開）
await t("正向：未登入可讀 articles/ 圖片", assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), "articles/seed/existing.webp"))));
await t("正向：一般會員可讀 articles/ 圖片", assertSucceeds(getBytes(ref(ctx("member@gmail.com"), "articles/seed/existing.webp"))));

await env.cleanup();
let fail = 0;
for (const r of results) { if (r[0] === "FAIL") fail++; console.log(r.join(" | ")); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
