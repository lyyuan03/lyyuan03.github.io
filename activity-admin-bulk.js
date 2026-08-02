import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SELECTED_EMAILS = new Set();
const MAGIC_SECRET_REF = doc(db, "membershipSettings", "eventMagicLinkSecrets");
let initialized = false;
let participantList = null;
let eventSelect = null;
let toolbar = null;
let selectAllInput = null;
let selectedCount = null;
let removeSelectedButton = null;
let decorateScheduled = false;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function emailKey(email) {
  return bytesToBase64Url(new TextEncoder().encode(normalizeEmail(email)));
}

function currentEvent() {
  const option = eventSelect?.selectedOptions?.[0];
  return {
    id: eventSelect?.value || "",
    name: option?.textContent?.replace(/（停用）$/, "").trim() || "目前活動"
  };
}

function setActivityStatus(message, state = "") {
  const status = document.getElementById("activity-status")
    || document.getElementById("activity-import-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function installStyles() {
  if (document.getElementById("activity-bulk-selection-styles")) return;
  const style = document.createElement("style");
  style.id = "activity-bulk-selection-styles";
  style.textContent = `
    .activity-bulk-toolbar{
      display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      margin:18px 0 10px;padding:12px 13px;
      border:1px solid rgba(165,130,84,.25);
      background:rgba(165,130,84,.065)
    }
    .activity-bulk-toggle{display:inline-flex;align-items:center;gap:8px;color:rgba(245,240,232,.78);font-size:13px;cursor:pointer}
    .activity-bulk-toggle input,.activity-bulk-checkbox{width:18px;height:18px;margin:0;accent-color:#A58254;cursor:pointer}
    .activity-bulk-count{margin-right:auto;color:#CBAA77;font-size:12px;letter-spacing:.05em}
    .activity-participant-row{grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center}
    .activity-participant-row.is-bulk-selected{border-color:rgba(203,170,119,.55);background:rgba(165,130,84,.12)}
    .activity-bulk-cell{display:flex;align-items:center;justify-content:center;min-width:24px}
    @media(max-width:860px){
      .activity-participant-row{grid-template-columns:auto minmax(0,1fr)!important}
      .activity-participant-row .member-row-actions{grid-column:2;justify-content:flex-start}
      .activity-bulk-count{width:100%;order:3;margin-right:0}
    }
  `;
  document.head.appendChild(style);
}

function participantRows() {
  if (!participantList) return [];
  return [...participantList.querySelectorAll(".member-row")]
    .filter((row) => row.querySelector("[data-remove-email]"));
}

function updateToolbar() {
  const rows = participantRows();
  const visibleEmails = rows
    .map((row) => normalizeEmail(row.querySelector("[data-remove-email]")?.dataset.removeEmail))
    .filter(Boolean);
  const visibleSet = new Set(visibleEmails);
  [...SELECTED_EMAILS].forEach((email) => {
    if (!visibleSet.has(email)) SELECTED_EMAILS.delete(email);
  });

  const selectedVisible = visibleEmails.filter((email) => SELECTED_EMAILS.has(email)).length;
  const allSelected = visibleEmails.length > 0 && selectedVisible === visibleEmails.length;

  if (selectAllInput) {
    selectAllInput.checked = allSelected;
    selectAllInput.indeterminate = selectedVisible > 0 && !allSelected;
    selectAllInput.disabled = visibleEmails.length === 0;
  }
  if (selectedCount) selectedCount.textContent = `已勾選 ${selectedVisible}／${visibleEmails.length} 筆`;
  if (removeSelectedButton) removeSelectedButton.disabled = selectedVisible === 0;
}

function decorateParticipantRows() {
  decorateScheduled = false;
  if (!participantList) return;

  participantRows().forEach((row) => {
    const removeButton = row.querySelector("[data-remove-email]");
    const email = normalizeEmail(removeButton?.dataset.removeEmail);
    if (!email) return;

    row.classList.add("activity-participant-row");
    let checkbox = row.querySelector(".activity-bulk-checkbox");
    if (!checkbox) {
      const cell = document.createElement("label");
      cell.className = "activity-bulk-cell";
      cell.title = `勾選 ${email}`;
      checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "activity-bulk-checkbox";
      checkbox.dataset.bulkEmail = email;
      checkbox.setAttribute("aria-label", `勾選 ${email}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) SELECTED_EMAILS.add(email);
        else SELECTED_EMAILS.delete(email);
        row.classList.toggle("is-bulk-selected", checkbox.checked);
        updateToolbar();
      });
      cell.appendChild(checkbox);
      row.prepend(cell);
    }
    checkbox.checked = SELECTED_EMAILS.has(email);
    row.classList.toggle("is-bulk-selected", checkbox.checked);
  });

  updateToolbar();
}

function scheduleDecorate() {
  if (decorateScheduled) return;
  decorateScheduled = true;
  window.requestAnimationFrame(decorateParticipantRows);
}

function createToolbar() {
  if (!participantList || document.getElementById("activity-bulk-toolbar")) return;
  toolbar = document.createElement("div");
  toolbar.id = "activity-bulk-toolbar";
  toolbar.className = "activity-bulk-toolbar";
  toolbar.innerHTML = `
    <label class="activity-bulk-toggle">
      <input id="activity-bulk-select-all" type="checkbox">
      <span>全選目前名單</span>
    </label>
    <span id="activity-bulk-count" class="activity-bulk-count">已勾選 0 筆</span>
    <button id="activity-bulk-remove" class="btn danger" type="button" disabled>確認移除已勾選</button>
  `;
  participantList.before(toolbar);

  selectAllInput = toolbar.querySelector("#activity-bulk-select-all");
  selectedCount = toolbar.querySelector("#activity-bulk-count");
  removeSelectedButton = toolbar.querySelector("#activity-bulk-remove");

  selectAllInput.addEventListener("change", () => {
    const shouldSelect = selectAllInput.checked;
    participantRows().forEach((row) => {
      const email = normalizeEmail(row.querySelector("[data-remove-email]")?.dataset.removeEmail);
      const checkbox = row.querySelector(".activity-bulk-checkbox");
      if (!email || !checkbox) return;
      checkbox.checked = shouldSelect;
      row.classList.toggle("is-bulk-selected", shouldSelect);
      if (shouldSelect) SELECTED_EMAILS.add(email);
      else SELECTED_EMAILS.delete(email);
    });
    updateToolbar();
  });

  removeSelectedButton.addEventListener("click", removeSelectedParticipants);
}

async function removeSelectedParticipants() {
  const emails = [...SELECTED_EMAILS];
  if (!emails.length) return;

  const event = currentEvent();
  if (!event.id) {
    setActivityStatus("請先選擇活動。", "error");
    return;
  }

  const confirmed = window.confirm(
    `確定要從「${event.name}」一次移除 ${emails.length} 位參加者嗎？\n\n相關活動文章權限與個人專屬連結也會一併停用。`
  );
  if (!confirmed) return;

  const originalText = removeSelectedButton.textContent;
  removeSelectedButton.disabled = true;
  removeSelectedButton.textContent = "批次移除中…";
  setActivityStatus(`正在移除 ${emails.length} 位參加者，請勿關閉頁面…`, "saving");

  try {
    const [memberSnapshots, articleSnapshot, magicSnapshot] = await Promise.all([
      Promise.all(emails.map((email) => getDoc(doc(db, "memberAccess", email)))),
      getDocs(collection(db, "articles")),
      getDoc(MAGIC_SECRET_REF)
    ]);

    const eventArticles = articleSnapshot.docs.filter((articleDoc) => {
      const article = articleDoc.data();
      return article.accessType === "event" && article.eventId === event.id;
    });
    const eventArticleIds = eventArticles.map((articleDoc) => articleDoc.id);
    const magicData = magicSnapshot.exists() ? magicSnapshot.data() : {};
    const links = { ...(magicData.links || {}) };
    links[event.id] = { ...(links[event.id] || {}) };
    const tokenHashes = new Set();
    const now = new Date().toISOString();

    emails.forEach((email) => {
      const recordKey = emailKey(email);
      const record = links[event.id][recordKey];
      if (!record) return;
      if (record.tokenHash) tokenHashes.add(record.tokenHash);
      links[event.id][recordKey] = { ...record, status: "inactive", updatedAt: now };
    });

    const batch = writeBatch(db);
    memberSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) return;
      const email = emails[index];
      const current = snapshot.data();
      const nextAccess = { ...(current.eventAccess || {}) };
      const nextKeys = { ...(current.eventArticleKeys || {}) };
      delete nextAccess[event.id];
      eventArticleIds.forEach((articleId) => delete nextKeys[articleId]);
      batch.set(doc(db, "memberAccess", email), {
        eventAccess: nextAccess,
        eventArticleKeys: nextKeys,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    eventArticles.forEach((articleDoc) => {
      const article = articleDoc.data();
      const access = { ...(article.magicLinkAccess || {}) };
      let changed = false;
      tokenHashes.forEach((tokenHash) => {
        if (!access[tokenHash]) return;
        access[tokenHash] = { ...access[tokenHash], status: "inactive" };
        changed = true;
      });
      if (changed) {
        batch.set(articleDoc.ref, {
          magicLinkAccess: access,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });

    batch.set(MAGIC_SECRET_REF, { links, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    SELECTED_EMAILS.clear();
    setActivityStatus(`已一次移除 ${emails.length} 位參加者，相關專屬連結也已停用。`, "success");
    window.setTimeout(() => location.reload(), 700);
  } catch (error) {
    console.error("批次移除活動參加者失敗：", error);
    setActivityStatus("批次移除失敗，資料尚未變更，請稍後再試。", "error");
    removeSelectedButton.disabled = false;
    removeSelectedButton.textContent = originalText;
  }
}

function initializeBulkSelection() {
  if (initialized) return;
  participantList = document.getElementById("activity-participant-list");
  eventSelect = document.getElementById("activity-select");
  if (!participantList || !eventSelect) {
    window.setTimeout(initializeBulkSelection, 250);
    return;
  }

  initialized = true;
  installStyles();
  createToolbar();
  eventSelect.addEventListener("change", () => {
    SELECTED_EMAILS.clear();
    window.setTimeout(scheduleDecorate, 0);
  });

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(participantList, { childList: true, subtree: true });
  scheduleDecorate();
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  initializeBulkSelection();
});
