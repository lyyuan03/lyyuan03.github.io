import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_EVENT = {
  id: "2026-guanyin-enlightenment",
  name: "2026 觀音成道日法會",
  status: "active"
};

const settingsRef = doc(db, "membershipSettings", "eventManagement");
const keyRef = doc(db, "membershipSettings", "eventArticleKeys");
const statusEl = document.getElementById("activity-status");
const eventSelect = document.getElementById("activity-select");
const eventList = document.getElementById("activity-list");
const participantList = document.getElementById("activity-participant-list");
const participantForm = document.getElementById("activity-participant-form");
const participantInput = document.getElementById("activity-participant-emails");
const participantButton = document.getElementById("activity-participant-submit");
const importStatusEl = document.getElementById("activity-import-status");
const eventForm = document.getElementById("activity-form");

let events = [];
let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function setImportStatus(message, state = "") {
  if (!importStatusEl) return;
  importStatusEl.textContent = message;
  importStatusEl.dataset.state = state;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function eventSlug(value = "") {
  const normalized = String(value).trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `event-${Date.now()}`;
}

function selectedEvent() {
  return events.find((event) => event.id === eventSelect?.value) || events[0] || DEFAULT_EVENT;
}

function setStatus(message, state = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

async function saveEvents(nextEvents) {
  events = nextEvents;
  await setDoc(settingsRef, { events, updatedAt: serverTimestamp() }, { merge: true });
  renderEvents();
  window.dispatchEvent(new CustomEvent("activity-events-updated", { detail: { events } }));
}

async function ensureDefaultEvent() {
  const snapshot = await getDoc(settingsRef);
  const saved = snapshot.exists() && Array.isArray(snapshot.data().events) ? snapshot.data().events : [];
  events = saved.length ? saved : [DEFAULT_EVENT];
  if (!saved.length) await saveEvents(events);
}

async function loadMembers() {
  const snapshot = await getDocs(collection(db, "memberAccess"));
  members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function renderEvents() {
  if (!eventSelect || !eventList) return;
  const previous = eventSelect.value;
  eventSelect.innerHTML = events.map((event) =>
    `<option value="${escapeHtml(event.id)}">${escapeHtml(event.name)}${event.status === "inactive" ? "（停用）" : ""}</option>`
  ).join("");
  if (events.some((event) => event.id === previous)) eventSelect.value = previous;

  eventList.innerHTML = events.map((event) => {
    const count = members.filter((member) => member.eventAccess?.[event.id]?.status === "active").length;
    return `<div class="member-row">
      <div><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.id)}｜${event.status === "active" ? "啟用" : "停用"}｜${count} 位參加者</small></div>
      <div class="member-row-actions"><button class="btn" type="button" data-event-toggle="${escapeHtml(event.id)}">${event.status === "active" ? "停用" : "啟用"}</button></div>
    </div>`;
  }).join("");

  eventList.querySelectorAll("[data-event-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.eventToggle;
      await saveEvents(events.map((event) => event.id === id
        ? { ...event, status: event.status === "active" ? "inactive" : "active" }
        : event));
      await refresh();
    });
  });
  renderParticipants();
}

function renderParticipants() {
  if (!participantList) return;
  const event = selectedEvent();
  const participants = members
    .filter((member) => member.eventAccess?.[event.id]?.status === "active")
    .sort((a, b) => String(a.email || a.id).localeCompare(String(b.email || b.id), "zh-Hant"));

  if (!participants.length) {
    participantList.innerHTML = '<div class="empty">此活動尚未匯入參加者 Email。</div>';
    return;
  }
  participantList.innerHTML = participants.map((member) => {
    const email = normalizeEmail(member.email || member.id);
    return `<div class="member-row">
      <div><strong>${escapeHtml(member.name || email)}</strong><small>${escapeHtml(email)}</small></div>
      <div class="member-row-actions"><button class="btn danger" type="button" data-remove-email="${escapeHtml(email)}">移除</button></div>
    </div>`;
  }).join("");

  participantList.querySelectorAll("[data-remove-email]").forEach((button) => {
    button.addEventListener("click", () => removeParticipant(button.dataset.removeEmail));
  });
}

async function eventArticleKeys(eventId) {
  const [articlesSnapshot, keysSnapshot] = await Promise.all([
    getDocs(collection(db, "articles")),
    getDoc(keyRef)
  ]);
  const keys = keysSnapshot.exists() ? keysSnapshot.data().keys || {} : {};
  return articlesSnapshot.docs.reduce((result, item) => {
    const article = item.data();
    if (article.accessType === "event" && article.eventId === eventId && keys[item.id]) {
      result[item.id] = keys[item.id];
    }
    return result;
  }, {});
}

async function addParticipants(emails) {
  const event = selectedEvent();
  setImportStatus("正在準備活動文章權限…", "saving");
  const keys = await eventArticleKeys(event.id);
  const memberMap = new Map(members.map((member) => [normalizeEmail(member.email || member.id), member]));
  const batch = writeBatch(db);

  emails.forEach((email) => {
    const ref = doc(db, "memberAccess", email);
    const current = memberMap.get(email) || {};
    batch.set(ref, {
      email,
      eventAccess: {
        ...(current.eventAccess || {}),
        [event.id]: { status: "active", eventName: event.name, addedAt: new Date().toISOString() }
      },
      eventArticleKeys: { ...(current.eventArticleKeys || {}), ...keys },
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  setImportStatus(`正在寫入 ${emails.length} 位參加者，請勿關閉頁面…`, "saving");
  await batch.commit();
  setStatus(`已匯入 ${emails.length} 位活動參加者。`, "success");
  setImportStatus(`匯入完成：共 ${emails.length} 位參加者。`, "success");
  return emails.length;
}

async function removeParticipant(email) {
  const event = selectedEvent();
  if (!confirm(`確定要從「${event.name}」移除 ${email} 嗎？`)) return;
  const ref = doc(db, "memberAccess", email);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const current = snapshot.data();
  const nextAccess = { ...(current.eventAccess || {}) };
  delete nextAccess[event.id];
  const nextKeys = { ...(current.eventArticleKeys || {}) };
  const eventKeys = await eventArticleKeys(event.id);
  Object.keys(eventKeys).forEach((articleId) => delete nextKeys[articleId]);
  await setDoc(ref, {
    eventAccess: nextAccess,
    eventArticleKeys: nextKeys,
    updatedAt: serverTimestamp()
  }, { merge: true });
  setStatus(`已移除 ${email}。`, "success");
  await refresh();
}

async function refresh() {
  await Promise.all([ensureDefaultEvent(), loadMembers()]);
  renderEvents();
}

eventSelect?.addEventListener("change", renderParticipants);

eventForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nameInput = document.getElementById("activity-name");
  const idInput = document.getElementById("activity-id");
  const name = nameInput.value.trim();
  const id = eventSlug(idInput.value || name);
  if (!name) return;
  if (events.some((item) => item.id === id)) {
    setStatus("活動代稱已存在，請更換後再儲存。", "error");
    return;
  }
  await saveEvents([...events, { id, name, status: "active" }]);
  eventSelect.value = id;
  nameInput.value = "";
  idInput.value = "";
  setStatus(`已建立活動「${name}」。`, "success");
  await refresh();
});

async function importParticipants() {
  const emails = [...new Set(
    participantInput.value.split(/[\s,;，；]+/).map(normalizeEmail).filter(Boolean)
  )];
  const invalid = emails.filter((email) => !emailIsValid(email));
  if (invalid.length) {
    const message = `以下 Email 格式不正確：${invalid.join("、")}`;
    setStatus(message, "error");
    setImportStatus(message, "error");
    return;
  }
  if (!emails.length) {
    setStatus("請先貼上至少一組 Email。", "error");
    setImportStatus("請先貼上至少一組 Email。", "error");
    participantInput.focus();
    return;
  }

  participantButton.disabled = true;
  participantButton.textContent = "匯入中…";
  setStatus(`正在匯入 ${emails.length} 位活動參加者…`, "saving");
  setImportStatus(`已讀取 ${emails.length} 組 Email，正在匯入…`, "saving");
  try {
    await addParticipants(emails);
    participantInput.value = "";
    await refresh();
  } catch (error) {
    console.error("活動參加者匯入失敗：", error);
    const detail = error?.code === "permission-denied"
      ? "目前登入帳號沒有活動名單寫入權限，請改用靈元院管理員 Google 帳號。"
      : "匯入失敗，請確認網路狀態後再試一次。";
    setStatus(detail, "error");
    setImportStatus(detail, "error");
  } finally {
    participantButton.disabled = false;
    participantButton.textContent = "匯入參加者";
  }
}

participantButton?.addEventListener("click", importParticipants);
participantForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  importParticipants();
});

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    await refresh();
    setStatus("活動資料已載入。");
  } catch (error) {
    console.error(error);
    setStatus("活動資料載入失敗，請稍後再試。", "error");
  }
});
