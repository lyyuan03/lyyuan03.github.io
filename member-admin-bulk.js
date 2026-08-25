import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "./firebase-config.js";

const sections = [
  {
    key: "sponsor",
    listId: "membership-list",
    statusId: "membership-status",
    deleteSelector: "[data-delete]",
    emailAttribute: "delete",
    title: "付費文章會員",
    emptyText: "目前沒有可勾選的付費文章會員"
  },
  {
    key: "wellness",
    listId: "wellness-member-list",
    statusId: "wellness-member-status",
    deleteSelector: "[data-wellness-delete]",
    emailAttribute: "wellnessDelete",
    title: "養生療癒會員",
    emptyText: "目前沒有可勾選的養生療癒會員"
  }
];

let initialized = false;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function hasEventAccess(data = {}) {
  return Boolean(data.eventAccess && Object.keys(data.eventAccess).length);
}

function isWellnessMember(data = {}) {
  return data.wellnessAccess === true
    || data.memberType === "wellness-channel"
    || ["wellness", "lingji"].includes(data.memberLevel)
    || ["wellness", "wellness-premium", "lingji"].includes(data.wellnessLevel);
}

function isSponsorMember(data = {}) {
  if (data.memberType === "sponsor-member") return true;
  return data.articleAccess === true
    && !isWellnessMember(data)
    && data.memberType !== "wellness-channel";
}

function installStyles() {
  if (document.getElementById("member-admin-bulk-styles")) return;
  const style = document.createElement("style");
  style.id = "member-admin-bulk-styles";
  style.textContent = `
    .member-bulk-toolbar{
      display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      margin:0 0 11px;padding:12px 13px;
      border:1px solid rgba(165,130,84,.25);
      background:rgba(165,130,84,.065)
    }
    .member-bulk-toggle{display:inline-flex;align-items:center;gap:8px;color:rgba(245,240,232,.78);font-size:13px;cursor:pointer}
    .member-bulk-toggle input,.member-bulk-checkbox{width:18px;height:18px;margin:0;accent-color:#A58254;cursor:pointer}
    .member-bulk-count{margin-right:auto;color:#CBAA77;font-size:12px;letter-spacing:.05em}
    .member-bulk-row{grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center}
    .member-bulk-row.is-bulk-selected{border-color:rgba(203,170,119,.55);background:rgba(165,130,84,.12)}
    .member-bulk-cell{display:flex;align-items:center;justify-content:center;min-width:24px}
    @media(max-width:860px){
      .member-bulk-row{grid-template-columns:auto minmax(0,1fr)!important}
      .member-bulk-row .member-row-actions{grid-column:2;justify-content:flex-start}
      .member-bulk-count{width:100%;order:3;margin-right:0}
    }
  `;
  document.head.appendChild(style);
}

function setStatus(section, message, state = "") {
  const status = document.getElementById(section.statusId);
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function sponsorRemovalPatch(data = {}) {
  const hasWellness = isWellnessMember(data);
  const hasEvent = hasEventAccess(data);

  if (!hasWellness && !hasEvent) return null;

  const patch = {
    planMonths: deleteField(),
    amount: deleteField(),
    paymentUrl: deleteField(),
    paidAt: deleteField(),
    updatedAt: serverTimestamp()
  };

  if (data.memberType === "sponsor-member") patch.memberType = deleteField();

  if (!hasWellness) {
    patch.articleAccess = deleteField();
    patch.wellnessAccess = deleteField();
    patch.paymentStatus = deleteField();
    patch.status = deleteField();
    patch.startsAt = deleteField();
    patch.expiresAt = deleteField();
    patch.note = deleteField();
  }

  return patch;
}

function wellnessRemovalPatch(data = {}) {
  const hasSponsor = isSponsorMember(data) && data.memberType !== "wellness-channel";
  const hasEvent = hasEventAccess(data);

  if (!hasSponsor && !hasEvent) return null;

  const patch = {
    memberLevel: deleteField(),
    wellnessLevel: deleteField(),
    wellnessAccess: deleteField(),
    firstJoinedAt: deleteField(),
    annualSpend: deleteField(),
    cashbackBalance: deleteField(),
    purchasedCourses: deleteField(),
    annualSpendCycleStart: deleteField(),
    nextLingjiQualified: deleteField(),
    lingjiValidFrom: deleteField(),
    lingjiValidUntil: deleteField(),
    updatedAt: serverTimestamp()
  };

  if (data.memberType === "wellness-channel") patch.memberType = deleteField();

  if (!hasSponsor) {
    patch.articleAccess = deleteField();
    patch.paymentStatus = deleteField();
    patch.status = deleteField();
    patch.startsAt = deleteField();
    patch.expiresAt = deleteField();
    patch.note = deleteField();
  }

  return patch;
}

async function commitOperations(operations) {
  const chunkSize = 400;
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => {
      if (operation.type === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.patch, { merge: true });
    });
    await batch.commit();
  }
}

async function removeMembers(section, emails, fromSingleButton = false) {
  const uniqueEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (!uniqueEmails.length) return;

  const wording = uniqueEmails.length === 1
    ? uniqueEmails[0]
    : `${uniqueEmails.length} 位${section.title}`;
  const confirmed = window.confirm(
    `確定要移除 ${wording} 嗎？\n\n只會取消「${section.title}」資格；若同一 Email 另有活動資格，系統會保留，不會一併刪除。`
  );
  if (!confirmed) return;

  setStatus(section, `正在移除 ${uniqueEmails.length} 筆資料，請勿關閉頁面…`, "saving");

  try {
    const snapshots = await Promise.all(
      uniqueEmails.map((email) => getDoc(doc(db, "memberAccess", email)))
    );
    const operations = [];

    snapshots.forEach((snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const patch = section.key === "sponsor"
        ? sponsorRemovalPatch(data)
        : wellnessRemovalPatch(data);
      operations.push(patch
        ? { type: "update", ref: snapshot.ref, patch }
        : { type: "delete", ref: snapshot.ref });
    });

    await commitOperations(operations);
    setStatus(
      section,
      uniqueEmails.length === 1
        ? `${section.title}資料已移除。`
        : `已一次移除 ${uniqueEmails.length} 位${section.title}。`,
      "success"
    );
    window.setTimeout(() => location.reload(), fromSingleButton ? 450 : 700);
  } catch (error) {
    console.error(`批次移除${section.title}失敗：`, error);
    setStatus(section, "移除失敗，資料尚未變更，請稍後再試。", "error");
  }
}

function setupSection(section) {
  const list = document.getElementById(section.listId);
  if (!list || list.dataset.bulkReady === "true") return false;
  list.dataset.bulkReady = "true";

  const selected = new Set();
  let decorateScheduled = false;

  const toolbar = document.createElement("div");
  toolbar.className = "member-bulk-toolbar";
  toolbar.dataset.bulkSection = section.key;
  toolbar.innerHTML = `
    <label class="member-bulk-toggle">
      <input type="checkbox" data-bulk-select-all>
      <span>全選目前名單</span>
    </label>
    <span class="member-bulk-count" data-bulk-count>已勾選 0 筆</span>
    <button class="btn danger" type="button" data-bulk-delete disabled>確認刪除已勾選</button>
  `;
  list.before(toolbar);

  const selectAll = toolbar.querySelector("[data-bulk-select-all]");
  const count = toolbar.querySelector("[data-bulk-count]");
  const deleteSelected = toolbar.querySelector("[data-bulk-delete]");

  function rows() {
    return [...list.querySelectorAll(".member-row")]
      .filter((row) => row.querySelector(section.deleteSelector));
  }

  function rowEmail(row) {
    const button = row.querySelector(section.deleteSelector);
    return normalizeEmail(button?.dataset?.[section.emailAttribute]);
  }

  function updateToolbar() {
    const currentRows = rows();
    const emails = currentRows.map(rowEmail).filter(Boolean);
    const visible = new Set(emails);
    [...selected].forEach((email) => {
      if (!visible.has(email)) selected.delete(email);
    });
    const selectedCount = emails.filter((email) => selected.has(email)).length;
    const allSelected = emails.length > 0 && selectedCount === emails.length;

    selectAll.checked = allSelected;
    selectAll.indeterminate = selectedCount > 0 && !allSelected;
    selectAll.disabled = emails.length === 0;
    count.textContent = emails.length
      ? `已勾選 ${selectedCount}／${emails.length} 筆`
      : section.emptyText;
    deleteSelected.disabled = selectedCount === 0;
  }

  function decorateRows() {
    decorateScheduled = false;
    rows().forEach((row) => {
      const email = rowEmail(row);
      if (!email) return;
      row.classList.add("member-bulk-row");
      let checkbox = row.querySelector(".member-bulk-checkbox");
      if (!checkbox) {
        const cell = document.createElement("label");
        cell.className = "member-bulk-cell";
        cell.title = `勾選 ${email}`;
        checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "member-bulk-checkbox";
        checkbox.dataset.bulkEmail = email;
        checkbox.setAttribute("aria-label", `勾選 ${email}`);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selected.add(email);
          else selected.delete(email);
          row.classList.toggle("is-bulk-selected", checkbox.checked);
          updateToolbar();
        });
        cell.appendChild(checkbox);
        row.prepend(cell);
      }
      checkbox.checked = selected.has(email);
      row.classList.toggle("is-bulk-selected", checkbox.checked);
    });
    updateToolbar();
  }

  function scheduleDecorate() {
    if (decorateScheduled) return;
    decorateScheduled = true;
    window.requestAnimationFrame(decorateRows);
  }

  selectAll.addEventListener("change", () => {
    const shouldSelect = selectAll.checked;
    rows().forEach((row) => {
      const email = rowEmail(row);
      const checkbox = row.querySelector(".member-bulk-checkbox");
      if (!email || !checkbox) return;
      checkbox.checked = shouldSelect;
      row.classList.toggle("is-bulk-selected", shouldSelect);
      if (shouldSelect) selected.add(email);
      else selected.delete(email);
    });
    updateToolbar();
  });

  deleteSelected.addEventListener("click", () => removeMembers(section, [...selected], false));

  list.addEventListener("click", (event) => {
    const button = event.target.closest(section.deleteSelector);
    if (!button || !list.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const email = normalizeEmail(button.dataset?.[section.emailAttribute]);
    removeMembers(section, [email], true);
  }, true);

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(list, { childList: true, subtree: true });
  scheduleDecorate();
  return true;
}

function initialize() {
  if (initialized) return;
  const readyCount = sections.reduce((count, section) => count + (setupSection(section) ? 1 : 0), 0);
  const allReady = sections.every((section) => document.getElementById(section.listId)?.dataset.bulkReady === "true");
  if (allReady) {
    initialized = true;
    return;
  }
  if (!readyCount) window.setTimeout(initialize, 250);
  else window.setTimeout(initialize, 400);
}

installStyles();
onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  initialize();
});
