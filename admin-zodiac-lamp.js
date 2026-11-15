// 2027 丁未年點燈專屬內容管理（僅管理員）。
// 寫入兩份文件，沿用現有活動權限規則，不修改 firestore.rules：
//   articles/dingwei-2027-{生肖}           公開外殼：已發布、隱藏、系統紀錄、content 必須為空
//   eventArticleBodies/dingwei-2027-{生肖} 受保護正文：requiredPermission = dingwei-2027-{生肖}
// 正文不得寫入任何公開檔案。
import { auth, db, provider, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

els.login.addEventListener("click", () => signInWithPopup(auth, provider).catch((error) => { els.gateText.textContent = "登入失敗：" + (error?.code || ""); }));
els.logout.addEventListener("click", () => signOut(auth));
els.zodiac.addEventListener("change", load);
els.reload.addEventListener("click", load);
els.save.addEventListener("click", () => save(true));
els.disable.addEventListener("click", () => save(false));

onAuthStateChanged(auth, (user) => {
  const admin = Boolean(user && isAdminEmail(user.email));
  els.editor.hidden = !admin;
  els.login.hidden = Boolean(user);
  els.logout.hidden = !user;
  els.gateText.textContent = !user ? "請先以管理帳號登入。" : admin ? `已登入：${user.email}` : `${user.email} 不是管理帳號，無法使用本頁。`;
  if (admin) load();
});
