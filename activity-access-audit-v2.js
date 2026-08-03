import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MAX_BATCH_WRITES = 400;
const RELOAD_KEY = "lyyuan-event-access-audit-v2-reloaded";
let running = false;
let button = null;
let statusEl = null;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function emailIsValid(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptEventContent(article, rawKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(rawKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(article.eventIv) },
    key,
    base64ToBytes(article.encryptedContent)
  );
}

function installControl() {
  if (button || document.getElementById("activity-full-access-audit")) return;
  const panelHead = document.querySelector("#activity-management .panel-head");
  if (!panelHead) return;

  const controls = document.createElement("div");
  controls.className = "top-actions";
  controls.innerHTML = `
    <button id="activity-full-access-audit" class="btn primary" type="button">全面檢查活動閱讀權限</button>
    <span id="activity-full-access-audit-status" class="status activity-status" role="status" aria-live="polite"></span>
  `;
  panelHead.appendChild(controls);
  button = controls.querySelector("#activity-full-access-audit");
  statusEl = controls.querySelector("#activity-full-access-audit-status");
  button.addEventListener("click", () => runAudit({ manual: true }));
}

function setStatus(message, state = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.state = state;
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

function mergeRecords(records, canonicalEmail) {
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

function sameKeyMap(left = {}, right = {}) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

async function loadContext() {
  const [membersSnapshot, articlesSnapshot, keysSnapshot] = await Promise.all([
    getDocs(collection(db, "memberAccess")),
    getDocs(collection(db, "articles")),
    getDoc(doc(db, "membershipSettings", "eventArticleKeys"))
  ]);

  const masterKeys = keysSnapshot.exists() ? keysSnapshot.data().keys || {} : {};
  const articlesByEvent = new Map();
  const invalidArticles = [];

  for (const articleDoc of articlesSnapshot.docs) {
    const article = { id: articleDoc.id, ...articleDoc.data() };
    if (article.accessType !== "event" || !article.eventId) continue;

    const masterKey = masterKeys[article.id] || "";
    let valid = Boolean(masterKey && article.encryptedContent && article.eventIv);
    if (valid) {
      try {
        await decryptEventContent(article, masterKey);
      } catch (error) {
        console.error("活動文章主金鑰驗證失敗：", article.id, error);
        valid = false;
      }
    }

    if (!valid) {
      invalidArticles.push(article.id);
      continue;
    }

    if (!articlesByEvent.has(article.eventId)) articlesByEvent.set(article.eventId, {});
    articlesByEvent.get(article.eventId)[article.id] = masterKey;
  }

  const groups = new Map();
  const invalidMemberDocuments = [];

  membersSnapshot.docs.forEach((memberDoc) => {
    const data = memberDoc.data();
    const idEmail = normalizeEmail(memberDoc.id);
    const fieldEmail = normalizeEmail(data.email);
    const canonicalEmail = emailIsValid(idEmail) ? idEmail : fieldEmail;

    if (!emailIsValid(canonicalEmail)) {
      invalidMemberDocuments.push(memberDoc.id);
      return;
    }

    if (!groups.has(canonicalEmail)) groups.set(canonicalEmail, []);
    groups.get(canonicalEmail).push({
      id: memberDoc.id,
      ref: memberDoc.ref,
      data
    });
  });

  return {
    groups,
    articlesByEvent,
    invalidArticles,
    invalidMemberDocuments,
    totalDocuments: membersSnapshot.size
  };
}

async function runAudit({ manual = false } = {}) {
  if (running) return;
  running = true;
  installControl();

  if (button) {
    button.disabled = true;
    button.textContent = "全面檢查中…";
  }
  setStatus("正在檢查所有參加者、Email 文件、活動資格、文章金鑰及解密資料…", "saving");

  try {
    const context = await loadContext();
    const operations = [];
    const problemEmails = new Set();
    const activeEventIds = new Set();
    let activeParticipants = 0;
    let repairedParticipants = 0;
    let repairedKeys = 0;
    let migratedDocuments = 0;
    let eventsWithoutArticles = 0;

    context.groups.forEach((records, email) => {
      const { canonical, merged, eventAccess, eventArticleKeys } = mergeRecords(records, email);
      const participantEvents = Object.entries(eventAccess)
        .filter(([, access]) => access?.status === "active")
        .map(([eventId]) => eventId);

      if (!participantEvents.length) return;
      activeParticipants += 1;
      participantEvents.forEach((eventId) => activeEventIds.add(eventId));

      const nextKeys = { ...eventArticleKeys };
      participantEvents.forEach((eventId) => {
        const articleKeys = context.articlesByEvent.get(eventId);
        if (!articleKeys || !Object.keys(articleKeys).length) {
          eventsWithoutArticles += 1;
          problemEmails.add(email);
          return;
        }

        Object.entries(articleKeys).forEach(([articleId, masterKey]) => {
          if (nextKeys[articleId] === masterKey) return;
          nextKeys[articleId] = masterKey;
          repairedKeys += 1;
          problemEmails.add(email);
        });
      });

      const canonicalData = canonical?.data || {};
      const hasLegacyDocuments = records.some((record) => record.id !== email);
      const needsWrite = !canonical
        || hasLegacyDocuments
        || normalizeEmail(canonicalData.email) !== email
        || JSON.stringify(canonicalData.eventAccess || {}) !== JSON.stringify(eventAccess)
        || !sameKeyMap(canonicalData.eventArticleKeys || {}, nextKeys);

      if (needsWrite) {
        operations.push({
          ref: doc(db, "memberAccess", email),
          data: {
            ...merged,
            email,
            eventAccess,
            eventArticleKeys: nextKeys,
            eventAccessAuditVersion: "20260803-v2",
            eventAccessCheckedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          options: { merge: true }
        });
        repairedParticipants += 1;
        problemEmails.add(email);
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
        migratedDocuments += 1;
      });
    });

    if (operations.length) await commitOperations(operations);

    const summary = {
      version: "20260803-v2",
      checkedAt: serverTimestamp(),
      totalMemberDocuments: context.totalDocuments,
      activeParticipants,
      activeEvents: activeEventIds.size,
      validEventArticles: [...context.articlesByEvent.values()].reduce((total, keys) => total + Object.keys(keys).length, 0),
      repairedParticipants,
      repairedKeys,
      migratedDocuments,
      invalidEventArticles: context.invalidArticles,
      invalidMemberDocuments: context.invalidMemberDocuments.slice(0, 25),
      eventsWithoutArticles,
      problemEmails: [...problemEmails].slice(0, 50)
    };
    await setDoc(doc(db, "membershipSettings", "eventAccessAudit"), summary, { merge: true });

    const problems = context.invalidArticles.length
      + context.invalidMemberDocuments.length
      + eventsWithoutArticles;
    const message = operations.length
      ? `全面檢查完成：已修復 ${repairedParticipants} 位參加者、補齊 ${repairedKeys} 筆文章金鑰，並整理 ${migratedDocuments} 筆舊資料。`
      : `全面檢查完成：${activeParticipants} 位活動參加者的 Email 與文章金鑰均已同步。`;
    const warning = problems
      ? `另發現 ${problems} 項需人工確認的文章或 Email 資料，已記錄於後台稽核結果。`
      : "";
    setStatus(`${message}${warning}`, problems ? "error" : "success");

    if (operations.length && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.setTimeout(() => location.reload(), manual ? 900 : 1200);
    }
  } catch (error) {
    console.error("活動閱讀權限全面稽核失敗：", error);
    const message = error?.code === "permission-denied"
      ? "目前登入帳號沒有全面檢查活動權限的管理權限。"
      : "全面檢查失敗，請確認網路後再按一次。";
    setStatus(message, "error");
  } finally {
    running = false;
    if (button) {
      button.disabled = false;
      button.textContent = "全面檢查活動閱讀權限";
    }
  }
}

function start(user) {
  if (!user || !isAdminEmail(user.email)) return;
  installControl();
  window.setTimeout(() => runAudit({ manual: false }), 900);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installControl, { once: true });
} else {
  installControl();
}

onAuthStateChanged(auth, start);
