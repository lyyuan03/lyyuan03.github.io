import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const AUTO_REPAIR_SESSION_KEY = "lyyuan-event-access-repair-20260803-1";
const MAX_BATCH_WRITES = 400;

let repairButton = null;
let repairStatus = null;
let repairRunning = false;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapEquals(left = {}, right = {}) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => {
    if (key !== rightKeys[index]) return false;
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue && rightValue && typeof leftValue === "object" && typeof rightValue === "object") {
      return JSON.stringify(leftValue) === JSON.stringify(rightValue);
    }
    return leftValue === rightValue;
  });
}

function setRepairStatus(message, state = "") {
  if (!repairStatus) return;
  repairStatus.textContent = message;
  repairStatus.dataset.state = state;
}

function installRepairControl() {
  if (repairButton || document.getElementById("activity-access-repair")) return;
  const panelHead = document.querySelector("#activity-management .panel-head");
  if (!panelHead) return;

  const controls = document.createElement("div");
  controls.className = "top-actions";
  controls.innerHTML = `
    <button id="activity-access-repair" class="btn" type="button">檢查並補齊閱讀權限</button>
    <span id="activity-access-repair-status" class="status activity-status" role="status" aria-live="polite"></span>
  `;
  panelHead.appendChild(controls);

  repairButton = controls.querySelector("#activity-access-repair");
  repairStatus = controls.querySelector("#activity-access-repair-status");
  repairButton.addEventListener("click", () => repairEventAccess({ manual: true }));
}

async function commitOperations(operations) {
  for (let start = 0; start < operations.length; start += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    operations.slice(start, start + MAX_BATCH_WRITES).forEach((operation) => {
      batch.set(operation.ref, operation.data, operation.options || { merge: true });
    });
    await batch.commit();
  }
}

function mergeMemberRecords(records, canonicalEmail) {
  const canonical = records.find((record) => record.id === canonicalEmail) || null;
  const ordered = [
    ...records.filter((record) => record.id !== canonicalEmail),
    ...(canonical ? [canonical] : [])
  ];

  const merged = {};
  const eventAccess = {};
  const eventArticleKeys = {};

  ordered.forEach((record) => {
    Object.assign(merged, record.data || {});
    Object.assign(eventAccess, record.data?.eventAccess || {});
    Object.assign(eventArticleKeys, record.data?.eventArticleKeys || {});
  });

  return { canonical, merged, eventAccess, eventArticleKeys };
}

async function loadRepairContext() {
  const [memberSnapshot, articleSnapshot, keySnapshot] = await Promise.all([
    getDocs(collection(db, "memberAccess")),
    getDocs(collection(db, "articles")),
    getDoc(doc(db, "membershipSettings", "eventArticleKeys"))
  ]);

  const storedKeys = keySnapshot.exists() ? keySnapshot.data().keys || {} : {};
  const keysByEvent = new Map();

  articleSnapshot.docs.forEach((articleDoc) => {
    const article = articleDoc.data();
    const articleKey = storedKeys[articleDoc.id];
    if (article.accessType !== "event" || !article.eventId || !articleKey) return;
    if (!keysByEvent.has(article.eventId)) keysByEvent.set(article.eventId, {});
    keysByEvent.get(article.eventId)[articleDoc.id] = articleKey;
  });

  const groups = new Map();
  memberSnapshot.docs.forEach((memberDoc) => {
    const data = memberDoc.data();
    const email = normalizeEmail(data.email || memberDoc.id);
    if (!emailIsValid(email)) return;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push({ id: memberDoc.id, ref: memberDoc.ref, data });
  });

  return { groups, keysByEvent };
}

async function repairEventAccess({ manual = false } = {}) {
  if (repairRunning) return;
  repairRunning = true;
  installRepairControl();

  if (repairButton) {
    repairButton.disabled = true;
    repairButton.textContent = "檢查中…";
  }
  setRepairStatus("正在比對活動名單、Email 文件與文章解密金鑰…", "saving");

  try {
    const { groups, keysByEvent } = await loadRepairContext();
    const operations = [];
    let activeParticipants = 0;
    let repairedParticipants = 0;
    let migratedLegacyDocuments = 0;
    let repairedKeys = 0;
    let eventsWithoutKeys = 0;

    groups.forEach((records, email) => {
      const { canonical, merged, eventAccess, eventArticleKeys } = mergeMemberRecords(records, email);
      const activeEventIds = Object.entries(eventAccess)
        .filter(([, access]) => access?.status === "active")
        .map(([eventId]) => eventId);

      if (!activeEventIds.length) return;
      activeParticipants += 1;

      const nextArticleKeys = { ...eventArticleKeys };
      activeEventIds.forEach((eventId) => {
        const eventKeys = keysByEvent.get(eventId);
        if (!eventKeys || !Object.keys(eventKeys).length) {
          eventsWithoutKeys += 1;
          return;
        }
        Object.entries(eventKeys).forEach(([articleId, articleKey]) => {
          if (nextArticleKeys[articleId] === articleKey) return;
          nextArticleKeys[articleId] = articleKey;
          repairedKeys += 1;
        });
      });

      const canonicalData = canonical?.data || {};
      const hasLegacyDocuments = records.some((record) => record.id !== email);
      const needsCanonicalWrite = !canonical
        || hasLegacyDocuments
        || canonicalData.email !== email
        || !mapEquals(canonicalData.eventAccess || {}, eventAccess)
        || !mapEquals(canonicalData.eventArticleKeys || {}, nextArticleKeys);

      if (needsCanonicalWrite) {
        operations.push({
          ref: doc(db, "memberAccess", email),
          data: {
            ...merged,
            email,
            eventAccess,
            eventArticleKeys: nextArticleKeys,
            eventAccessCheckedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          options: { merge: true }
        });
        repairedParticipants += 1;
      }

      records.filter((record) => record.id !== email).forEach((record) => {
        operations.push({
          ref: record.ref,
          data: {
            eventAccess: deleteField(),
            eventArticleKeys: deleteField(),
            migratedTo: email,
            migratedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          options: { merge: true }
        });
        migratedLegacyDocuments += 1;
      });
    });

    if (operations.length) await commitOperations(operations);

    const repairedSummary = repairedParticipants || migratedLegacyDocuments || repairedKeys
      ? `已補齊 ${repairedParticipants} 位參加者、${repairedKeys} 筆文章金鑰，並整理 ${migratedLegacyDocuments} 筆舊格式資料。`
      : `已檢查 ${activeParticipants} 位活動參加者，閱讀權限均正常。`;
    const warning = eventsWithoutKeys
      ? `另有 ${eventsWithoutKeys} 筆活動資格找不到對應文章金鑰，請確認活動文章已發布。`
      : "";

    setRepairStatus(`${repairedSummary}${warning}`, eventsWithoutKeys ? "error" : "success");

    if (operations.length) {
      sessionStorage.setItem(AUTO_REPAIR_SESSION_KEY, "done");
      window.setTimeout(() => location.reload(), manual ? 900 : 1200);
    } else if (!manual) {
      sessionStorage.setItem(AUTO_REPAIR_SESSION_KEY, "done");
    }
  } catch (error) {
    console.error("活動文章閱讀權限自動修復失敗：", error);
    const message = error?.code === "permission-denied"
      ? "目前帳號沒有修復活動權限的管理員權限。"
      : "活動閱讀權限檢查失敗，請稍後再按一次。";
    setRepairStatus(message, "error");
  } finally {
    repairRunning = false;
    if (repairButton) {
      repairButton.disabled = false;
      repairButton.textContent = "檢查並補齊閱讀權限";
    }
  }
}

function startForAdmin(user) {
  if (!user || !isAdminEmail(user.email)) return;
  installRepairControl();
  if (sessionStorage.getItem(AUTO_REPAIR_SESSION_KEY) === "done") {
    setRepairStatus("本次登入已完成活動閱讀權限檢查。", "success");
    return;
  }
  window.setTimeout(() => repairEventAccess({ manual: false }), 700);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installRepairControl, { once: true });
} else {
  installRepairControl();
}

onAuthStateChanged(auth, startForAdmin);
