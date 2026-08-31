import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { staticArticles } from "./static-articles.js?v=20260802-event-admin-fix-1";

const firebaseConfig = {
  apiKey: "AIzaSyAgHy-nPOErzs7NDJossVGPITbenXOfjQY",
  authDomain: "lyyuan03-membership.firebaseapp.com",
  projectId: "lyyuan03-membership",
  storageBucket: "lyyuan03-membership.firebasestorage.app",
  messagingSenderId: "77417213320",
  appId: "1:77417213320:web:221afecf62eedb66f41e3d"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

function base64ToBytes(value = "") {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptEventContent(encryptedContent, iv, rawKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(rawKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encryptedContent)
  );
  return new TextDecoder().decode(decrypted);
}

function setStatus(message, state = "") {
  [document.getElementById("save-status"), document.getElementById("save-status-inline")].forEach((node) => {
    if (!node) return;
    node.textContent = message;
    if (state) node.dataset.state = state;
    else delete node.dataset.state;
  });
}

function activeArticleId() {
  return document.querySelector(".article-item.is-active")?.dataset.id || "";
}

async function hydrateStaticEventArticle() {
  const id = activeArticleId();
  const article = staticArticles.find((item) => item.id === id && item.accessType === "event" && !item.requiredPermission);
  const content = document.getElementById("content");
  const saveButton = document.getElementById("save-article");
  if (!content || !saveButton) return;

  if (!article) {
    saveButton.disabled = false;
    return;
  }

  if (content.value.trim()) {
    saveButton.disabled = false;
    return;
  }

  saveButton.disabled = true;
  setStatus("正在解密活動文章…", "saving");

  try {
    const snapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
    const key = snapshot.exists() ? snapshot.data().keys?.[id] : "";

    if (!key) {
      setStatus("此篇為 GitHub 加密文章，但後台尚未保存解密金鑰；因此前台有文章、後台內文為空。", "error");
      return;
    }

    if (!article.encryptedContent || !article.eventIv) {
      setStatus("找不到此活動文章的加密內容或 IV，請檢查文章資料。", "error");
      return;
    }

    const plainText = await decryptEventContent(article.encryptedContent, article.eventIv, key);
    content.value = plainText;
    content.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton.disabled = false;
    setStatus("活動文章已解密，可在後台編輯。", "success");
  } catch (error) {
    console.error("靜態活動文章解密失敗：", error);
    setStatus("活動文章解密失敗，請確認金鑰與加密資料是否相符。", "error");
  }
}

function install() {
  const list = document.getElementById("article-list");
  if (!list || list.dataset.eventStaticFix === "ready") return;
  list.dataset.eventStaticFix = "ready";
  list.addEventListener("click", () => window.setTimeout(hydrateStaticEventArticle, 80));
  new MutationObserver(() => window.setTimeout(hydrateStaticEventArticle, 80))
    .observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

install();
new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
