import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "./firebase-config.js";

const GUANYIN_ARTICLE_ID = "2026-guanyin-vow-lamp-record-v2";
let currentDiagnosis = null;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function emailIsValid(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function gmailIdentity(value = "") {
  const email = normalizeEmail(value);
  const [local = "", domain = ""] = email.split("@");
  if (!["gmail.com", "googlemail.com"].includes(domain)) return email;
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyDecrypt(article, rawKey) {
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
  if (document.getElementById("activity-email-access-check")) return;
  const panel = document.getElementById("activity-management");
  const layout = panel?.querySelector(".activity-layout");
  if (!panel || !layout) return;

  const card = document.createElement("div");
  card.id = "activity-email-access-check";
  card.className = "membership-card";
  card.style.margin = "0 26px 24px";
  card.innerHTML = `
    <h3>指定 Email 閱讀權限檢查</h3>
    <div class="membership-form">
      <div class="field">
        <label for="activity-email-check-input">信眾登入 Email</label>
        <input id="activity-email-check-input" type="email" autocomplete="off" placeholder="例如：name@gmail.com">
      </div>
      <div class="top-actions">
        <button id="activity-email-check-button" class="btn primary" type="button">檢查此 Email</button>
        <button id="activity-email-repair-button" class="btn" type="button" hidden>補齊可修復權限</button>
      </div>
      <div id="activity-email-check-result" class="membership-summary" style="margin-top:14px;white-space:normal;line-height:1.8">輸入信眾實際登入的 Google Email，即可逐項檢查活動資格、文章金鑰及解密狀態。</div>
    </div>
  `;
  panel.insertBefore(card, layout);

  const input = card.querySelector("#activity-email-check-input");
  const checkButton = card.querySelector("#activity-email-check-button");
  const repairButton = card.querySelector("#activity-email-repair-button");
  const queryEmail = normalizeEmail(new URLSearchParams(location.search).get("checkEmail"));
  if (queryEmail) input.value = queryEmail;

  checkButton.addEventListener("click", () => checkEmail(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkEmail(input.value);
    }
  });
  repairButton.addEventListener("click", repairCurrentDiagnosis);

  if (queryEmail) window.setTimeout(() => checkEmail(queryEmail), 700);
}

function setResult(html, state = "") {
  const result = document.getElementById("activity-email-check-result");
  if (!result) return;
  result.innerHTML = html;
  result.dataset.state = state;
}

function setBusy(busy) {
  const button = document.getElementById("activity-email-check-button");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "檢查中…" : "檢查此 Email";
}

async function findMemberRecord(email) {
  const exact = await getDoc(doc(db, "memberAccess", email));
  if (exact.exists()) {
    return {
      exact: true,
      id: exact.id,
      ref: exact.ref,
      data: exact.data(),
      matchedEmail: normalizeEmail(exact.data().email || exact.id)
    };
  }

  const identity = gmailIdentity(email);
  const snapshot = await getDocs(collection(db, "memberAccess"));
  for (const item of snapshot.docs) {
    const data = item.data();
    const candidates = [item.id, data.email].map(normalizeEmail).filter(Boolean);
    if (candidates.some((candidate) => gmailIdentity(candidate) === identity)) {
      return {
        exact: false,
        id: item.id,
        ref: item.ref,
        data,
        matchedEmail: normalizeEmail(data.email || item.id)
      };
    }
  }
  return null;
}

async function loadEventContext() {
  const [articlesSnapshot, keySnapshot] = await Promise.all([
    getDocs(collection(db, "articles")),
    getDoc(doc(db, "membershipSettings", "eventArticleKeys"))
  ]);
  const masterKeys = keySnapshot.exists() ? keySnapshot.data().keys || {} : {};
  const articles = articlesSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((article) => article.accessType === "event" && article.eventId);
  return { articles, masterKeys };
}

async function checkEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const repairButton = document.getElementById("activity-email-repair-button");
  if (repairButton) repairButton.hidden = true;
  currentDiagnosis = null;

  if (!emailIsValid(email)) {
    setResult("請輸入完整且正確的 Email。", "error");
    return;
  }

  setBusy(true);
  setResult(`正在檢查 <strong>${escapeHtml(email)}</strong> 的活動資格與文章解密資料…`, "saving");

  try {
    const [member, context] = await Promise.all([
      findMemberRecord(email),
      loadEventContext()
    ]);

    if (!member) {
      setResult(
        `<strong>後台找不到 ${escapeHtml(email)}。</strong><br>`
        + "這表示信眾登入的 Google Email 尚未建立活動權限，或報名 Email 與實際登入 Email 不同。",
        "error"
      );
      return;
    }

    const eventAccess = member.data.eventAccess || {};
    const activeEventIds = Object.entries(eventAccess)
      .filter(([, access]) => access?.status === "active")
      .map(([eventId]) => eventId);

    const issues = [];
    const checks = [];

    if (!member.exact) {
      issues.push(`資料目前存放在文件 <code>${escapeHtml(member.id)}</code>，不是登入 Email 文件 <code>${escapeHtml(email)}</code>。`);
    }
    if (!activeEventIds.length) {
      issues.push("這筆資料沒有任何已啟用的活動閱讀資格。");
    }

    const relevantArticles = context.articles.filter((article) => activeEventIds.includes(article.eventId));
    if (!relevantArticles.length && activeEventIds.length) {
      issues.push("活動資格已啟用，但找不到對應的活動文章設定。");
    }

    for (const article of relevantArticles) {
      const masterKey = context.masterKeys[article.id] || "";
      const memberKey = member.data.eventArticleKeys?.[article.id] || "";
      let code = "ok";
      let detail = "金鑰一致，解密驗證通過。";

      if (!masterKey || !article.encryptedContent || !article.eventIv) {
        code = "article-config";
        detail = "文章主金鑰或加密資料不完整。";
        issues.push(`${article.title || article.id}：文章加密設定不完整。`);
      } else if (!memberKey) {
        code = "key-missing";
        detail = "信眾資料缺少這篇文章的解密金鑰。";
        issues.push(`${article.title || article.id}：缺少信眾文章金鑰。`);
      } else if (memberKey !== masterKey) {
        code = "key-mismatch";
        detail = "信眾文章金鑰與目前主金鑰不同步。";
        issues.push(`${article.title || article.id}：文章金鑰不同步。`);
      } else {
        try {
          await verifyDecrypt(article, memberKey);
        } catch {
          code = "decrypt-failed";
          detail = "金鑰存在，但實際解密失敗。";
          issues.push(`${article.title || article.id}：實際解密失敗。`);
        }
      }

      checks.push({
        articleId: article.id,
        title: article.title || article.id,
        eventId: article.eventId,
        code,
        detail,
        masterKey
      });
    }

    const guanyinCheck = checks.find((item) => item.articleId === GUANYIN_ARTICLE_ID);
    const summary = issues.length
      ? `<strong>發現 ${issues.length} 項問題。</strong>`
      : `<strong>後台權限正常。</strong>這個 Email 的活動資格、文章金鑰與解密驗證均已通過。`;

    const rows = checks.length
      ? `<ul style="margin:10px 0 0;padding-left:20px">${checks.map((item) => `<li>${escapeHtml(item.title)}：${escapeHtml(item.detail)}</li>`).join("")}</ul>`
      : "";
    const issueRows = issues.length
      ? `<ul style="margin:10px 0 0;padding-left:20px">${issues.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "";
    const guanyinNote = guanyinCheck
      ? `<br>觀音成道日文章檢查結果：<strong>${escapeHtml(guanyinCheck.detail)}</strong>`
      : `<br>這筆資料目前沒有對應到觀音成道日文章。`;

    setResult(
      `檢查帳號：<strong>${escapeHtml(email)}</strong><br>`
      + `後台資料 Email：<strong>${escapeHtml(member.matchedEmail || member.id)}</strong><br>`
      + `${summary}${guanyinNote}${issueRows}${rows}`,
      issues.length ? "error" : "success"
    );

    currentDiagnosis = {
      requestedEmail: email,
      member,
      activeEventIds,
      checks,
      context,
      repairable: Boolean(activeEventIds.length && issues.some((issue) => /文件|金鑰/.test(issue)))
    };
    if (repairButton) repairButton.hidden = !currentDiagnosis.repairable;
  } catch (error) {
    console.error("指定 Email 活動閱讀權限檢查失敗：", error);
    setResult(
      error?.code === "permission-denied"
        ? "目前管理員帳號沒有讀取這筆權限資料的權限。"
        : "檢查失敗，請確認網路連線後再試一次。",
      "error"
    );
  } finally {
    setBusy(false);
  }
}

async function repairCurrentDiagnosis() {
  const diagnosis = currentDiagnosis;
  const repairButton = document.getElementById("activity-email-repair-button");
  if (!diagnosis?.repairable || !repairButton) return;

  repairButton.disabled = true;
  repairButton.textContent = "修復中…";
  try {
    const nextKeys = { ...(diagnosis.member.data.eventArticleKeys || {}) };
    diagnosis.checks.forEach((item) => {
      if (item.masterKey && ["key-missing", "key-mismatch", "decrypt-failed"].includes(item.code)) {
        nextKeys[item.articleId] = item.masterKey;
      }
    });

    await setDoc(doc(db, "memberAccess", diagnosis.requestedEmail), {
      ...diagnosis.member.data,
      email: diagnosis.requestedEmail,
      eventArticleKeys: nextKeys,
      eventAccessCheckedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      repairedFromDocument: diagnosis.member.id !== diagnosis.requestedEmail ? diagnosis.member.id : ""
    }, { merge: true });

    await checkEmail(diagnosis.requestedEmail);
  } catch (error) {
    console.error("指定 Email 權限修復失敗：", error);
    setResult("權限修復失敗，請稍後再試。", "error");
  } finally {
    repairButton.disabled = false;
    repairButton.textContent = "補齊可修復權限";
  }
}

function start(user) {
  if (!user || !isAdminEmail(user.email)) return;
  installControl();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installControl, { once: true });
} else {
  installControl();
}

onAuthStateChanged(auth, start);
