import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, getDocs, query, collection, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
let currentArticle = null;
let latestDiagnosis = null;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function reloadKey(email = "") {
  return `lyyuan-event-access-reload:${activeId}:${normalizeEmail(email)}`;
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

async function loadArticle() {
  if (!activeId) return null;
  const direct = await getDoc(doc(db, "articles", activeId));
  if (direct.exists()) return { id: direct.id, ...direct.data() };

  const bySlug = await getDocs(query(collection(db, "articles"), where("slug", "==", activeId)));
  if (bySlug.empty) return null;
  const item = bySlug.docs[0];
  return { id: item.id, ...item.data() };
}

function diagnosisMessage(diagnosis) {
  const email = diagnosis.email ? `<strong>${diagnosis.email}</strong>` : "";
  const messages = {
    "signed-out": "請使用活動報名時登記的 Google Email 登入。",
    "in-app-browser": "目前是在 LINE、Facebook 或 Instagram 的內建瀏覽器中。請改用 Safari 或 Chrome 開啟本頁後登入。",
    "member-record-missing": `已登入 ${email}，但後台找不到這個 Email 的活動資格。請確認登入帳號與報名 Email 完全相同。`,
    "permission-denied": `已登入 ${email}，但系統無法讀取這個帳號的權限資料。通常是後台 Email 文件與登入 Email 不一致。`,
    "event-inactive": `已登入 ${email}，但這個帳號目前沒有啟用本次活動的閱讀資格。`,
    "article-key-missing": `已登入 ${email}，活動資格正常，但這篇文章的解密金鑰尚未同步。請由後台重新執行全面檢查。`,
    "article-config-missing": "活動文章的加密資料不完整，需由管理員重新儲存文章。",
    "decrypt-failed": `已登入 ${email}，活動資格與文章金鑰都存在，但解密資料不一致，需由後台重新同步。`,
    "granted": `已確認 ${email} 具有本篇文章閱讀資格，正在重新載入全文。`
  };
  return messages[diagnosis.code] || "目前無法確認活動閱讀資格，請稍後再試。";
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setHtml(node, value) {
  if (node && node.innerHTML !== value) node.innerHTML = value;
}

function updateGate(diagnosis) {
  latestDiagnosis = diagnosis;
  const gate = document.querySelector('[aria-label="活動限定文章"]');
  if (!gate) return false;

  const paragraph = gate.querySelector(".paid-lock-card p");
  const button = gate.querySelector("#article-event-login-button");
  const small = gate.querySelector("small");
  setHtml(paragraph, diagnosisMessage(diagnosis));

  if (button) {
    let label = "重新讀取活動資格";
    let disabled = false;
    if (diagnosis.code === "signed-out" || diagnosis.code === "in-app-browser") {
      label = "使用活動報名 Email 登入";
    } else if (diagnosis.code === "granted") {
      label = "正在開啟文章…";
      disabled = true;
    }
    setText(button, label);
    if (button.disabled !== disabled) button.disabled = disabled;
  }

  setText(
    small,
    diagnosis.code === "granted"
      ? "活動閱讀資格已通過"
      : `資格檢查代碼：${diagnosis.code}`
  );
  return true;
}

function updateGateWhenReady(diagnosis) {
  if (updateGate(diagnosis)) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (updateGate(diagnosis) || attempts >= 40) window.clearInterval(timer);
  }, 150);
}

async function diagnose(user = auth.currentUser) {
  try {
    currentArticle = currentArticle || await loadArticle();
    if (!currentArticle || currentArticle.accessType !== "event" || !currentArticle.eventId) return null;

    if (!user) {
      const diagnosis = { code: isInAppBrowser ? "in-app-browser" : "signed-out", email: "" };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    if (isAdminEmail(user.email)) {
      const diagnosis = { code: "granted", email: normalizeEmail(user.email) };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    const email = normalizeEmail(user.email);
    let memberSnapshot;
    try {
      memberSnapshot = await getDoc(doc(db, "memberAccess", email));
    } catch (error) {
      const diagnosis = {
        code: error?.code === "permission-denied" ? "permission-denied" : "member-record-missing",
        email
      };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    if (!memberSnapshot.exists()) {
      const diagnosis = { code: "member-record-missing", email };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    const member = memberSnapshot.data();
    if (member.eventAccess?.[currentArticle.eventId]?.status !== "active") {
      const diagnosis = { code: "event-inactive", email };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    const key = member.eventArticleKeys?.[currentArticle.id] || "";
    if (!key) {
      const diagnosis = { code: "article-key-missing", email };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    if (!currentArticle.encryptedContent || !currentArticle.eventIv) {
      const diagnosis = { code: "article-config-missing", email };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    try {
      await verifyDecrypt(currentArticle, key);
    } catch (error) {
      console.error("活動文章前台解密驗證失敗：", error);
      const diagnosis = { code: "decrypt-failed", email };
      updateGateWhenReady(diagnosis);
      return diagnosis;
    }

    const diagnosis = { code: "granted", email };
    updateGateWhenReady(diagnosis);
    const keyName = reloadKey(email);
    if (!sessionStorage.getItem(keyName)) {
      sessionStorage.setItem(keyName, "1");
      window.setTimeout(() => location.reload(), 350);
    }
    return diagnosis;
  } catch (error) {
    console.error("活動文章資格診斷失敗：", error);
    const diagnosis = { code: "permission-denied", email: normalizeEmail(user?.email) };
    updateGateWhenReady(diagnosis);
    return diagnosis;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("#article-event-login-button");
  if (!button) return;

  if (!auth.currentUser) {
    if (!isInAppBrowser) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert("LINE、Facebook 或 Instagram 內建瀏覽器會限制 Google 登入。請改用 Safari 或 Chrome 開啟本頁。");
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  button.disabled = true;
  button.textContent = "正在重新讀取資格…";
  sessionStorage.removeItem(reloadKey(auth.currentUser.email));
  diagnose(auth.currentUser).then((diagnosis) => {
    if (diagnosis?.code !== "granted") {
      button.disabled = false;
      button.textContent = "重新讀取活動資格";
    }
  });
}, true);

onAuthStateChanged(auth, (user) => {
  diagnose(user);
});

const observer = new MutationObserver(() => {
  if (latestDiagnosis) updateGate(latestDiagnosis);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
