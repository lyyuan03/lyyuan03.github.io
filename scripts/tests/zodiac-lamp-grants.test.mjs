// 點燈層權限開通／撤銷規則的單元測試（純計算，不連任何資料庫）。
// 執行：node scripts/tests/zodiac-lamp-grants.test.mjs
import assert from "node:assert/strict";
import { applyGrant, applyRevoke, normalizeGmail, parseGmailList, summarize } from "../../zodiac-lamp-grants.js";

const results = [];
const t = (name, fn) => { try { fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); } };

t("Gmail 轉小寫並去空白", () => assert.equal(normalizeGmail("  Ab.C@Gmail.COM "), "ab.c@gmail.com"));
t("非 Gmail 拒絕", () => { assert.equal(normalizeGmail("a@example.com"), null); assert.equal(normalizeGmail("a@googlemail.com"), null); assert.equal(normalizeGmail("a b@gmail.com"), null); });
t("名單解析：去重、分出無效", () => assert.deepEqual(parseGmailList("a@gmail.com\nA@gmail.com, b@yahoo.com；c@gmail.com"), { valid: ["a@gmail.com", "c@gmail.com"], invalid: ["b@yahoo.com"] }));

t("新信眾開通四個生肖", () => {
  const r = applyGrant(null, ["rat", "ox", "tiger", "goat"], "manual", { at: "T", by: "admin" });
  assert.deepEqual(r.permissions, ["dingwei-2027-rat", "dingwei-2027-ox", "dingwei-2027-tiger", "dingwei-2027-goat"]);
  assert.deepEqual(r.zodiacLampManagedPermissions, r.permissions);
  assert.deepEqual(r.zodiacLampGrants.goat, { sources: ["manual"], manualAt: "T", manualBy: "admin" });
});

t("保留既有活動權限", () => {
  const r = applyGrant({ permissions: ["2026-jinmu-am"] }, ["rat"], "manual");
  assert.deepEqual(r.permissions, ["2026-jinmu-am", "dingwei-2027-rat"]);
  const back = applyRevoke({ ...r }, ["rat"], "manual");
  assert.deepEqual(back.permissions, ["2026-jinmu-am"]);
});

t("重複開通不重複加入", () => {
  const once = applyGrant(null, ["rat"], "manual");
  const twice = applyGrant(once, ["rat"], "manual");
  assert.deepEqual(twice.permissions, ["dingwei-2027-rat"]);
  assert.deepEqual(twice.zodiacLampGrants.rat.sources, ["manual"]);
});

t("手動撤銷不影響訂單來源", () => {
  const a = applyGrant(null, ["rat"], "order:A123");
  const b = applyGrant(a, ["rat"], "manual");
  const c = applyRevoke(b, ["rat"], "manual");
  assert.deepEqual(c.permissions, ["dingwei-2027-rat"]);
  assert.deepEqual(c.zodiacLampGrants.rat.sources, ["order:A123"]);
});

t("兩筆訂單都撤銷才移除", () => {
  let d = applyGrant(null, ["ox"], "order:A1");
  d = applyGrant(d, ["ox"], "order:A2");
  d = applyRevoke(d, ["ox"], "order:A1");
  assert.ok(d.permissions.includes("dingwei-2027-ox"));
  d = applyRevoke(d, ["ox"], "order:A2");
  assert.deepEqual(d.permissions, []);
  assert.deepEqual(d.zodiacLampGrants, {});
});

t("原本就有的權限，撤銷時保留", () => {
  const start = { permissions: ["dingwei-2027-rat"] };
  const g = applyGrant(start, ["rat"], "manual");
  assert.deepEqual(g.zodiacLampManagedPermissions, []);
  const r = applyRevoke(g, ["rat"], "manual");
  assert.deepEqual(r.permissions, ["dingwei-2027-rat"]);
});

t("只撤銷選到的生肖", () => {
  const g = applyGrant(null, ["rat", "ox"], "manual");
  const r = applyRevoke(g, ["ox"], "manual");
  assert.deepEqual(r.permissions, ["dingwei-2027-rat"]);
});

t("不改動傳入的原始資料", () => {
  const start = { permissions: ["x"], zodiacLampGrants: { rat: { sources: ["order:A"] } } };
  const snapshot = JSON.stringify(start);
  applyGrant(start, ["rat", "ox"], "manual");
  applyRevoke(start, ["rat"], "order:A");
  assert.equal(JSON.stringify(start), snapshot);
});

t("拒絕未知生肖與空選擇", () => { assert.throws(() => applyGrant(null, ["cat"], "manual")); assert.throws(() => applyGrant(null, [], "manual")); });
t("拒絕無效來源", () => assert.throws(() => applyGrant(null, ["rat"], "order:../x")));

t("列表摘要標出來源", () => {
  const d = { permissions: ["dingwei-2027-rat", "dingwei-2027-dog", "2026-jinmu-am"], zodiacLampGrants: { rat: { sources: ["manual"] } } };
  assert.deepEqual(summarize(d), [{ zodiac: "rat", sources: ["manual"] }, { zodiac: "dog", sources: ["external"] }]);
});

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
