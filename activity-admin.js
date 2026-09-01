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
const magicSecretRef = doc(db, "membershipSettings", "eventMagicLinkSecrets");
const statusEl = document.getElementById("activity-status");
const eventSelect = document.getElementById("activity-select");
const eventList = document.getElementById("activity-list");
const participantList = document.getElementById("activity-participant-list");
const participantForm = document.getElementById("activity-participant-form");
const participantInput = document.getElementById("activity-participant-emails");
const participantButton = document.getElementById("activity-participant-submit");
const importStatusEl = document.getElementById("activity-import-status");
const linkExpiryInput = document.getElementById("activity-link-expiry");
const linkGenerateAllButton = document.getElementById("activity-link-generate-all");
const linkExportButton = document.getElementById("activity-link-export");
const linkStatusEl = document.getElementById("activity-link-status");
const eventForm = document.getElementById("activity-form");

let events = [];
let members = [];
let magicLinks = {};
let activityCreateInFlight = false;

const ARTICLE_EVENT_PICKER_LIMIT = 30;
let articleEventSearchInput = null;
let articleEventSearchHint = null;

function articleEventSearchText(value = "") {
  return String(value || "").trim().toLocaleLowerCase("zh-TW");
}

function articleEventOptionHtml(event, selectedId = "") {
  const inactive = event.status === "inactive" ? "（停用）" : "";
  return `<option value="${escapeHtml(event.id)}"${event.id === selectedId ? " selected" : ""}>${escapeHtml(event.name)}${inactive}</option>`;
}

function renderArticleEventSearchOptions() {
  const select = document.getElementById("eventId");
  if (!select || !articleEventSearchInput) return;

  const selectedId = select.value || "";
  const query = articleEventSearchText(articleEventSearchInput.value);
  const sourceEvents = Array.isArray(events) && events.length
    ? events
    : (Array.isArray(window.__lyyuanActivityEvents) ? window.__lyyuanActivityEvents : []);

  let visibleEvents;
  if (query) {
    visibleEvents = sourceEvents
      .filter((event) => articleEventSearchText(`${event.name || ""} ${event.id || ""}`).includes(query))
      .slice()
      .reverse();
  } else {
    visibleEvents = sourceEvents
      .filter((event) => event.status !== "inactive")
      .slice()
      .reverse()
      .slice(0, ARTICLE_EVENT_PICKER_LIMIT);
  }

  const selectedEvent = sourceEvents.find((event) => event.id === selectedId);
  if (selectedEvent && !visibleEvents.some((event) => event.id === selectedId)) {
    visibleEvents.unshift(selectedEvent);
  }

  const html = '<option value="">無指定活動</option>' + visibleEvents
    .map((event) => articleEventOptionHtml(event, selectedId))
    .join("");

  if (select.innerHTML !== html) select.innerHTML = html;
  if (selectedId && visibleEvents.some((event) => event.id === selectedId)) select.value = selectedId;

  if (articleEventSearchHint) {
    const activeCount = sourceEvents.filter((event) => event.status !== "inactive").length;
    if (query) {
      articleEventSearchHint.textContent = `搜尋到 ${visibleEvents.length} 筆活動｜可用活動名稱或代稱搜尋全部歷史活動。`;
    } else {
      articleEventSearchHint.textContent = `共 ${sourceEvents.length} 筆活動（啟用 ${activeCount} 筆）｜未搜尋時顯示最近 ${Math.min(ARTICLE_EVENT_PICKER_LIMIT, activeCount)} 筆啟用活動；輸入關鍵字可搜尋全部。`;
    }
  }
}

function installArticleEventSearch() {
  const select = document.getElementById("eventId");
  if (!select) return;

  articleEventSearchInput = document.getElementById("event-search");
  articleEventSearchHint = document.getElementById("event-search-hint");

  if (!articleEventSearchInput) {
    articleEventSearchInput = document.createElement("input");
    articleEventSearchInput.id = "event-search";
    articleEventSearchInput.type = "search";
    articleEventSearchInput.autocomplete = "off";
    articleEventSearchInput.placeholder = "搜尋活動名稱或代稱，例如：觀音、金母、2026";
    articleEventSearchInput.setAttribute("aria-label", "搜尋指定活動");
    select.insertAdjacentElement("beforebegin", articleEventSearchInput);
    articleEventSearchInput.addEventListener("input", renderArticleEventSearchOptions);
  }

  if (!articleEventSearchHint) {
    articleEventSearchHint = document.createElement("small");
    articleEventSearchHint.id = "event-search-hint";
    articleEventSearchHint.className = "upload-note";
    select.insertAdjacentElement("afterend", articleEventSearchHint);
  }

  if (!select.dataset.eventSearchObserved) {
    select.dataset.eventSearchObserved = "1";
    const observer = new MutationObserver(() => renderArticleEventSearchOptions());
    observer.observe(select, { childList: true });

    document.getElementById("article-list")?.addEventListener("click", () => {
      window.setTimeout(() => {
        if (!articleEventSearchInput) return;
        articleEventSearchInput.value = "";
        renderArticleEventSearchOptions();
      }, 0);
    });

    document.getElementById("new-article")?.addEventListener("click", () => {
      window.setTimeout(() => {
        if (!articleEventSearchInput) return;
        articleEventSearchInput.value = "";
        renderArticleEventSearchOptions();
      }, 0);
    });
  }

  renderArticleEventSearchOptions();
}

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

function setLinkStatus(message, state = "") {
  if (!linkStatusEl) return;
  linkStatusEl.textContent = message;
  linkStatusEl.dataset.state = state;
}

function setCreateStatus(message, state = "") {
  const element = document.getElementById("activity-create-status");
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function wrapEventKey(eventKey, token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const wrappingKey = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    new TextEncoder().encode(eventKey)
  );
  return { wrappedKey: bytesToBase64(new Uint8Array(wrapped)), iv: bytesToBase64(iv) };
}

function emailKey(email) {
  return bytesToBase64Url(new TextEncoder().encode(normalizeEmail(email)));
}

function defaultExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
}

function expiryIso() {
  const value = linkExpiryInput?.value;
  if (!value) throw new Error("missing-expiry");
  return new Date(`${value}T23:59:59.999+08:00`).toISOString();
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

function publishEventsToArticleAdmin() {
  window.__lyyuanActivityEvents = Array.isArray(events) ? events.map((event) => ({ ...event })) : [];
  window.dispatchEvent(new CustomEvent("activity-events-updated", { detail: { events: window.__lyyuanActivityEvents } }));
}

async function saveEvents(nextEvents) {
  await setDoc(settingsRef, { events: nextEvents, updatedAt: serverTimestamp() }, { merge: true });
  events = nextEvents;
  renderEvents();
  publishEventsToArticleAdmin();
  installArticleEventSearch();
  renderArticleEventSearchOptions();
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

function linkRecord(eventId, email) {
  return magicLinks?.[eventId]?.[emailKey(email)] || null;
}

function personalLink(event, record) {
  const params = new URLSearchParams({
    access: "event",
    event: event.id,
    token: record.token
  });
  return `https://lyyuan.tw/articles.html?${params.toString()}`;
}

function linkExpiryLabel(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "未設定期限" : date.toLocaleDateString("zh-TW");
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
    const link = linkRecord(event.id, email);
    const active = link?.status === "active" && Date.parse(link.expiresAt || "") > Date.now();
    const linkMeta = !link
      ? "尚未建立免登入連結"
      : `${active ? "連結啟用" : link.status === "inactive" ? "連結已停用" : "連結已到期"}｜期限 ${linkExpiryLabel(link.expiresAt)}`;
    return `<div class="member-row">
      <div><strong>${escapeHtml(member.name || email)}</strong><small>${escapeHtml(email)}</small><small>${escapeHtml(linkMeta)}</small></div>
      <div class="member-row-actions">
        ${link ? `<button class="btn" type="button" data-link-copy="${escapeHtml(email)}">複製連結</button>` : `<button class="btn" type="button" data-link-create="${escapeHtml(email)}">產生連結</button>`}
        ${link && active ? `<button class="btn danger" type="button" data-link-disable="${escapeHtml(email)}">停用連結</button>` : ""}
        ${link ? `<button class="btn" type="button" data-link-regenerate="${escapeHtml(email)}">重新產生</button>` : ""}
        <button class="btn danger" type="button" data-remove-email="${escapeHtml(email)}">移除</button>
      </div>
    </div>`;
  }).join("");

  participantList.querySelectorAll("[data-remove-email]").forEach((button) => {
    button.addEventListener("click", () => removeParticipant(button.dataset.removeEmail));
  });
  participantList.querySelectorAll("[data-link-create]").forEach((button) => {
    button.addEventListener("click", () => createPersonalLink(button.dataset.linkCreate, false));
  });
  participantList.querySelectorAll("[data-link-copy]").forEach((button) => {
    button.addEventListener("click", () => copyPersonalLink(button.dataset.linkCopy));
  });
  participantList.querySelectorAll("[data-link-disable]").forEach((button) => {
    button.addEventListener("click", () => disablePersonalLink(button.dataset.linkDisable));
  });
  participantList.querySelectorAll("[data-link-regenerate]").forEach((button) => {
    button.addEventListener("click", () => createPersonalLink(button.dataset.linkRegenerate, true));
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

async function loadMagicLinks() {
  const snapshot = await getDoc(magicSecretRef);
  magicLinks = snapshot.exists() ? snapshot.data().links || {} : {};
}

async function saveMagicLinks() {
  await setDoc(magicSecretRef, { links: magicLinks, updatedAt: serverTimestamp() }, { merge: true });
}

async function buildArticleMagicAccess(eventId, articleKey) {
  const records = Object.values(magicLinks?.[eventId] || {});
  const result = {};
  for (const record of records) {
    if (!record?.token || !record.tokenHash) continue;
    const wrapped = await wrapEventKey(articleKey, record.token);
    result[record.tokenHash] = {
      ...wrapped,
      status: record.status,
      expiresAt: record.expiresAt
    };
  }
  return result;
}

async function syncMagicLinksToArticles(eventId) {
  const [articlesSnapshot, keysSnapshot] = await Promise.all([
    getDocs(collection(db, "articles")),
    getDoc(keyRef)
  ]);
  const keys = keysSnapshot.exists() ? keysSnapshot.data().keys || {} : {};
  const batch = writeBatch(db);
  let count = 0;
  for (const item of articlesSnapshot.docs) {
    const article = item.data();
    const articleKey = keys[item.id];
    if (article.accessType !== "event" || article.eventId !== eventId || !articleKey) continue;
    const magicLinkAccess = await buildArticleMagicAccess(eventId, articleKey);
    batch.set(item.ref, { magicLinkAccess, updatedAt: serverTimestamp() }, { merge: true });
    count += 1;
  }
  if (count) await batch.commit();
  return count;
}

async function createLinkRecord(eventId, email) {
  const token = randomToken();
  return {
    email,
    token,
    tokenHash: await tokenHash(token),
    status: "active",
    expiresAt: expiryIso(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function createPersonalLink(email, regenerate) {
  const event = selectedEvent();
  if (!linkExpiryInput?.value) {
    setLinkStatus("請先設定專屬連結有效期限。", "error");
    linkExpiryInput?.focus();
    return;
  }
  if (regenerate && !confirm(`重新產生後，${email} 原本的連結將立即失效。確定繼續嗎？`)) return;
  setLinkStatus("正在建立個人專屬連結…", "saving");
  try {
    magicLinks[event.id] = { ...(magicLinks[event.id] || {}) };
    magicLinks[event.id][emailKey(email)] = await createLinkRecord(event.id, email);
    await saveMagicLinks();
    await syncMagicLinksToArticles(event.id);
    renderParticipants();
    await copyPersonalLink(email);
    setLinkStatus(`${regenerate ? "已重新產生" : "已建立"} ${email} 的專屬連結，並已複製。`, "success");
  } catch (error) {
    console.error("建立專屬連結失敗：", error);
    setLinkStatus(error.message === "missing-expiry" ? "請先設定有效期限。" : "建立連結失敗，請稍後再試。", "error");
  }
}

async function copyPersonalLink(email) {
  const event = selectedEvent();
  const record = linkRecord(event.id, email);
  if (!record?.token) return;
  try {
    await navigator.clipboard.writeText(personalLink(event, record));
    setLinkStatus(`已複製 ${email} 的個人專屬連結。`, "success");
  } catch {
    window.prompt("請複製個人專屬連結", personalLink(event, record));
  }
}

async function disablePersonalLink(email) {
  const event = selectedEvent();
  const record = linkRecord(event.id, email);
  if (!record || !confirm(`確定停用 ${email} 的個人專屬連結嗎？`)) return;
  record.status = "inactive";
  record.updatedAt = new Date().toISOString();
  setLinkStatus("正在停用專屬連結…", "saving");
  await saveMagicLinks();
  await syncMagicLinksToArticles(event.id);
  renderParticipants();
  setLinkStatus(`已停用 ${email} 的專屬連結。`, "success");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportPersonalLinks() {
  const event = selectedEvent();
  const participants = members
    .filter((member) => member.eventAccess?.[event.id]?.status === "active")
    .map((member) => {
      const email = normalizeEmail(member.email || member.id);
      const record = linkRecord(event.id, email);
      return {
        email,
        url: record?.token ? personalLink(event, record) : "",
        status: !record ? "尚未建立" : record.status === "active" && Date.parse(record.expiresAt || "") > Date.now() ? "啟用" : record.status === "inactive" ? "停用" : "到期",
        expiresAt: record?.expiresAt || ""
      };
    });
  const rows = [
    ["Email", "個人專屬免登入連結", "狀態", "有效期限"],
    ...participants.map((item) => [item.email, item.url, item.status, item.expiresAt])
  ];
  const blob = new Blob(["\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.id}-personal-links.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  setLinkStatus(`已下載 ${participants.length} 位參加者的專屬連結名單。`, "success");
}

async function generateMissingLinks() {
  const event = selectedEvent();
  if (!linkExpiryInput?.value) {
    setLinkStatus("請先設定專屬連結有效期限。", "error");
    linkExpiryInput?.focus();
    return;
  }
  const participants = members.filter((member) => member.eventAccess?.[event.id]?.status === "active");
  const missing = participants.filter((member) => !linkRecord(event.id, normalizeEmail(member.email || member.id)));
  if (!missing.length) {
    setLinkStatus("所有參加者都已建立個人專屬連結。", "success");
    return;
  }
  linkGenerateAllButton.disabled = true;
  linkGenerateAllButton.textContent = "產生中…";
  setLinkStatus(`正在為 ${missing.length} 位參加者建立專屬連結…`, "saving");
  try {
    magicLinks[event.id] = { ...(magicLinks[event.id] || {}) };
    for (const member of missing) {
      const email = normalizeEmail(member.email || member.id);
      magicLinks[event.id][emailKey(email)] = await createLinkRecord(event.id, email);
    }
    await saveMagicLinks();
    const articleCount = await syncMagicLinksToArticles(event.id);
    renderParticipants();
    setLinkStatus(`已為 ${missing.length} 位參加者建立專屬連結，並同步 ${articleCount} 篇活動文章。`, "success");
  } catch (error) {
    console.error("批次建立專屬連結失敗：", error);
    setLinkStatus("批次建立失敗，請稍後再試。", "error");
  } finally {
    linkGenerateAllButton.disabled = false;
    linkGenerateAllButton.textContent = "為尚未建立者批次產生連結";
  }
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
  const personalRecord = linkRecord(event.id, email);
  if (personalRecord) {
    personalRecord.status = "inactive";
    personalRecord.updatedAt = new Date().toISOString();
    await saveMagicLinks();
    await syncMagicLinksToArticles(event.id);
  }
  setStatus(`已移除 ${email}，相關專屬連結亦已停用。`, "success");
  await refresh();
}

async function refresh() {
  await Promise.all([ensureDefaultEvent(), loadMembers(), loadMagicLinks()]);
  if (linkExpiryInput && !linkExpiryInput.value) linkExpiryInput.value = defaultExpiryDate();
  renderEvents();
  publishEventsToArticleAdmin();
  installArticleEventSearch();
  renderArticleEventSearchOptions();
}

eventSelect?.addEventListener("change", renderParticipants);
linkGenerateAllButton?.addEventListener("click", generateMissingLinks);
linkExportButton?.addEventListener("click", exportPersonalLinks);

async function createActivity() {
  if (activityCreateInFlight) return;

  const nameInput = document.getElementById("activity-name");
  const idInput = document.getElementById("activity-id");
  const submitButton = document.getElementById("activity-submit");
  const name = nameInput.value.trim();
  const id = eventSlug(idInput.value || name);

  if (!name) {
    const message = "請先輸入活動名稱。";
    setStatus(message, "error");
    setCreateStatus(message, "error");
    nameInput.focus();
    return;
  }

  const existingEvent = events.find((item) => item.id === id);
  if (existingEvent) {
    eventSelect.value = existingEvent.id;
    eventSelect.dispatchEvent(new Event("change"));
    const message = `活動「${existingEvent.name}」已存在，已在右側選取。`;
    setStatus(message, "success");
    setCreateStatus(message, "success");
    return;
  }

  activityCreateInFlight = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "建立中…";
  }
  setStatus(`正在建立活動「${name}」…`, "saving");
  setCreateStatus("正在寫入活動資料，請稍候…", "saving");

  try {
    await saveEvents([...events, { id, name, status: "active", createdAt: new Date().toISOString() }]);
    eventSelect.value = id;
    eventSelect.dispatchEvent(new Event("change"));
    nameInput.value = "";
    idInput.value = "";
    const message = `已建立活動「${name}」，右側已自動選取。`;
    setStatus(message, "success");
    setCreateStatus(message, "success");
  } catch (error) {
    console.error("活動建立失敗：", error);
    const code = String(error?.code || "");
    const detail = code.includes("permission-denied")
      ? "建立失敗：目前登入帳號沒有活動寫入權限，請登出後改用靈元院管理員 Gmail 登入。"
      : code.includes("unavailable")
        ? "建立失敗：目前無法連線到活動資料庫，請確認網路後再試一次。"
        : code.includes("resource-exhausted")
          ? "建立失敗：活動資料已達儲存上限，請先停用或整理舊活動。"
          : `建立失敗：${error?.message || "請重新整理頁面後再試一次。"}`;
    setStatus(detail, "error");
    setCreateStatus(detail, "error");
  } finally {
    activityCreateInFlight = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "新增活動";
    }
  }
}

document.getElementById("activity-submit")?.addEventListener("click", createActivity);
eventForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  createActivity();
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
