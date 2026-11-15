// 2027 丁未年點燈專屬內容管理（僅管理員）。
// 寫入兩份文件，沿用現有活動權限規則，不修改 firestore.rules：
//   articles/dingwei-2027-{生肖}           公開外殼：已發布、隱藏、系統紀錄、content 必須為空
//   eventArticleBodies/dingwei-2027-{生肖} 受保護正文：requiredPermission = dingwei-2027-{生肖}
// 正文不得寫入任何公開檔案。
// 閱讀權限（手動開通）寫入 memberEntitlements/{gmail}，規則見 zodiac-lamp-grants.js。
import { auth, db, provider, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where, writeBatch, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { MANUAL_SOURCE, ZODIAC_KEYS, permissionOf, parseGmailList, applyGrant, applyRevoke, summarize } from "./zodiac-lamp-grants.js?v=20261115-1";

const ZODIACS = [
  ["rat", "鼠"], ["ox", "牛"], ["tiger", "虎"], ["rabbit", "兔"], ["dragon", "龍"], ["snake", "蛇"],
  ["horse", "馬"], ["goat", "羊"], ["monkey", "猴"], ["rooster", "雞"], ["dog", "狗"], ["pig", "豬"]
];
const PREFIX = "dingwei-2027-";
const $ = (id) => document.getElementById(id);
const els = { gate: $("gate"), gateText: $("gateText"), login: $("login"), logout: $("logout"), editor: $("editor"), zodiac: $("zodiac"), meta: $("meta"), content: $("content"), save: $("save"), disable: $("disable"), reload: $("reload"), status: $("status") };

els.zodiac.innerHTML = ZODIACS.map(([key, zh]) => `<option value="${key}">屬${zh}（${PREFIX}${key}）</option>`).join("");

function setStatus(text, kind = "") { els.status.textContent = text; els.status.dataset.kind = kind; }
function setBusy(busy) { [els.save, els.disable, els.reload, els.zodiac].forEach((el) => { el.disabled = busy; }); }
const zh = (key) => ZODIACS.find(([k]) => k === key)[1];

export function buildDocs(key, content, active) {
  const id = PREFIX + key;
  const title = `2027 丁未年・屬${zh(key)}點燈專屬內容`;
  return {
    id,
    shell: {
      title, slug: id, status: "published", hidden: true, systemRecord: true, systemType: "lampLayer",
      accessType: "event", eventId: id, requiredPermission: id, accessBadge: "年度點燈專屬", content: ""
    },
    body: { articleId: id, title, requiredPermission: id, status: "published", active, content }
  };
}

async function load() {
  const key = els.zodiac.value;
  setBusy(true); setStatus("載入中…");
  try {
    const snapshot = await getDoc(doc(db, "eventArticleBodies", PREFIX + key));
    const data = snapshot.exists() ? snapshot.data() : null;
    els.content.value = data?.content || "";
    els.meta.textContent = data
      ? `目前狀態：${data.active === false ? "已暫停開放" : "開放中"}｜${(data.content || "").length} 字`
      : "目前狀態：尚未建立";
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("載入失敗：" + (error?.code || error?.message || "未知錯誤"), "error");
  } finally { setBusy(false); }
}

async function save(active) {
  const key = els.zodiac.value;
  const content = els.content.value.trim();
  if (active && !content) return setStatus("請先貼上正文。", "error");
  if (/<\/?[a-z][^>]*>/i.test(content)) return setStatus("正文含有 HTML 標籤，請改為純文字。", "error");
  if (!confirm(active ? `確定儲存並開放「屬${zh(key)}」專屬內容？` : `確定暫停開放「屬${zh(key)}」專屬內容？`)) return;
  setBusy(true); setStatus("儲存中…");
  try {
    const { id, shell, body } = buildDocs(key, content, active);
    const shellRef = doc(db, "articles", id), bodyRef = doc(db, "eventArticleBodies", id);
    const existing = await getDoc(shellRef);
    const batch = writeBatch(db);
    batch.set(shellRef, { ...shell, updatedAt: serverTimestamp(), ...(existing.exists() ? {} : { createdAt: serverTimestamp(), publishedAt: serverTimestamp() }) }, { merge: true });
    batch.set(bodyRef, { ...body, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    const verify = await getDoc(bodyRef);
    if (!verify.exists() || verify.data().content !== content || verify.data().active !== active) throw new Error("寫入後驗證不一致");
    setStatus(active ? `已儲存並開放（${content.length} 字）。` : "已暫停開放，正文仍保留。", "ok");
    els.meta.textContent = `目前狀態：${active ? "開放中" : "已暫停開放"}｜${content.length} 字`;
  } catch (error) {
    console.error(error);
    setStatus("儲存失敗：" + (error?.code || error?.message || "未知錯誤"), "error");
  } finally { setBusy(false); }
}

// ---- 閱讀權限：手動開通／撤銷 ----
const grantEls = { box: $("grants"), emails: $("grantEmails"), zodiacs: $("grantZodiacs"), grant: $("grant"), revoke: $("revoke"), status: $("grantStatus"), list: $("listGrants"), table: $("grantList") };
grantEls.zodiacs.innerHTML = ZODIACS.map(([key, name]) => `<label><input type="checkbox" value="${key}">屬${name}</label>`).join("");
const MAX_EMAILS = 50;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function setGrantStatus(text, kind = "") { grantEls.status.textContent = text; grantEls.status.dataset.kind = kind; }
function setGrantBusy(busy) { [grantEls.grant, grantEls.revoke, grantEls.list].forEach((el) => { el.disabled = busy; }); }
const selectedZodiacs = () => [...grantEls.zodiacs.querySelectorAll("input:checked")].map((el) => el.value);

async function changeGrants(mode) {
  const { valid, invalid } = parseGmailList(grantEls.emails.value);
  const zodiacs = selectedZodiacs();
  if (invalid.length) return setGrantStatus(`以下不是 Gmail，請修正後再試：\n${invalid.join("\n")}`, "error");
  if (!valid.length) return setGrantStatus("請輸入至少一個 Gmail。", "error");
  if (valid.length > MAX_EMAILS) return setGrantStatus(`一次最多 ${MAX_EMAILS} 個 Gmail。`, "error");
  if (!zodiacs.length) return setGrantStatus("請勾選至少一個生肖。", "error");
  const names = zodiacs.map((z) => "屬" + zh(z)).join("、");
  const verb = mode === "grant" ? "開通" : "撤銷手動開通";
  if (!confirm(`確定為 ${valid.length} 位信眾${verb}：${names}？\n\n${valid.join("\n")}`)) return;

  setGrantBusy(true); setGrantStatus(`${verb}中…`);
  const done = [], skipped = [], failed = [];
  const admin = auth.currentUser?.email || "";
  for (const email of valid) {
    try {
      const ref = doc(db, "memberEntitlements", email);
      const outcome = await runTransaction(db, async (tx) => {
        const snapshot = await tx.get(ref);
        const existing = snapshot.exists() ? snapshot.data() : null;
        if (mode === "revoke" && !existing) return "skip";
        const patch = mode === "grant"
          ? applyGrant(existing, zodiacs, MANUAL_SOURCE, { at: new Date().toISOString(), by: admin })
          : applyRevoke(existing, zodiacs, MANUAL_SOURCE);
        const stamps = { zodiacLampSyncedAt: serverTimestamp(), updatedAt: serverTimestamp() };
        if (existing) tx.update(ref, { ...patch, ...stamps });
        else tx.set(ref, { email, status: "active", schemaVersion: 1, eventPermissionsSource: "zodiac-lamp", ...patch, ...stamps });
        return "ok";
      });
      (outcome === "skip" ? skipped : done).push(email);
    } catch (error) {
      console.error(email, error);
      failed.push(`${email}（${error?.code || error?.message || "未知錯誤"}）`);
    }
  }
  const lines = [`${verb}完成 ${done.length} 位。`];
  if (skipped.length) lines.push(`沒有權限紀錄，略過：${skipped.join("、")}`);
  if (failed.length) lines.push(`失敗：\n${failed.join("\n")}`);
  setGrantStatus(lines.join("\n"), failed.length ? "error" : "ok");
  setGrantBusy(false);
  if (grantEls.table.dataset.loaded) listGrants();
}

const sourceLabel = (s) => s === MANUAL_SOURCE ? "手動" : s.startsWith("order:") ? `訂單 ${s.slice(6)}` : "其他";
async function listGrants() {
  setGrantBusy(true); grantEls.table.textContent = "載入中…";
  try {
    const codes = ZODIAC_KEYS.map(permissionOf);
    const snapshot = await getDocs(query(collection(db, "memberEntitlements"), where("permissions", "array-contains-any", codes)));
    const rows = snapshot.docs.map((d) => ({ email: d.id, items: summarize(d.data()) })).sort((a, b) => a.email.localeCompare(b.email));
    grantEls.table.dataset.loaded = "1";
    grantEls.table.innerHTML = rows.length
      ? `<p class="hint">共 ${rows.length} 位</p><table><thead><tr><th>Gmail</th><th>可讀生肖（來源）</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.email)}</td><td>${r.items.map((i) => `屬${zh(i.zodiac)} <span class="src">${i.sources.map((s) => escapeHtml(sourceLabel(s))).join("、")}</span>`).join("<br>")}</td></tr>`).join("")}</tbody></table>`
      : `<p class="hint">目前沒有人開通。</p>`;
  } catch (error) {
    console.error(error);
    grantEls.table.textContent = "載入失敗：" + (error?.code || error?.message || "未知錯誤");
  } finally { setGrantBusy(false); }
}

grantEls.grant.addEventListener("click", () => changeGrants("grant"));
grantEls.revoke.addEventListener("click", () => changeGrants("revoke"));
grantEls.list.addEventListener("click", listGrants);

els.login.addEventListener("click", () => signInWithPopup(auth, provider).catch((error) => { els.gateText.textContent = "登入失敗：" + (error?.code || ""); }));
els.logout.addEventListener("click", () => signOut(auth));
els.zodiac.addEventListener("change", load);
els.reload.addEventListener("click", load);
els.save.addEventListener("click", () => save(true));
els.disable.addEventListener("click", () => save(false));

onAuthStateChanged(auth, (user) => {
  const admin = Boolean(user && isAdminEmail(user.email));
  els.editor.hidden = !admin;
  grantEls.box.hidden = !admin;
  els.login.hidden = Boolean(user);
  els.logout.hidden = !user;
  els.gateText.textContent = !user ? "請先以管理帳號登入。" : admin ? `已登入：${user.email}` : `${user.email} 不是管理帳號，無法使用本頁。`;
  if (admin) load();
});
