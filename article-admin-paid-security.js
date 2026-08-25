import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "./firebase-config.js";

const PAID_MARKER = "<!-- paid-only -->";
const PRIVATE_COLLECTION = "paidArticleBodies";
const form = document.getElementById("article-form");
const listEl = document.getElementById("article-list");
const saveStatus = document.getElementById("save-status");
const saveStatusInline = document.getElementById("save-status-inline");
const adminToast = document.getElementById("admin-toast");
let hydrationSerial = 0;
let toastTimer = 0;
let forwardingSafeSubmit = false;

function showToast(message, state = "success") {
  if (!adminToast) return;
  clearTimeout(toastTimer);
  adminToast.textContent = message;
  adminToast.className = `admin-toast is-visible is-${state}`;
  toastTimer = window.setTimeout(() => adminToast.classList.remove("is-visible"), state === "error" ? 6500 : 3600);
}

function setStatus(message, state = "") {
  if (saveStatus) saveStatus.textContent = message;
  if (saveStatusInline) {
    saveStatusInline.textContent = message;
    if (state) saveStatusInline.dataset.state = state;
    else delete saveStatusInline.dataset.state;
  }
}

function splitPaidContent(value = "") {
  const content = String(value || "");
  const markerIndex = content.indexOf(PAID_MARKER);
  if (markerIndex < 0) return null;
  return {
    publicContent: content.slice(0, markerIndex).trim(),
    privateContent: content.slice(markerIndex + PAID_MARKER.length).trim()
  };
}

function safePublicContent(split) {
  return `${split.publicContent}\n\n${PAID_MARKER}`.trim();
}

function activeArticleId() {
  return listEl?.querySelector(".article-item.is-active[data-id]")?.dataset?.id || "";
}

async function sha256(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findSavedArticleId({ existingId, slug, title, safeContent }) {
  if (existingId) return existingId;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (slug) {
      try {
        const snapshot = await getDocs(query(collection(db, "articles"), where("slug", "==", slug)));
        const match = snapshot.docs.find((item) => {
          const data = item.data() || {};
          return data.accessType === "paid"
            && (!title || data.title === title)
            && String(data.content || "").trim() === safeContent;
        });
        if (match) return match.id;
      } catch (error) {
        console.warn("查找新付費文章識別碼失敗，稍後重試。", error);
      }
    }
    const selectedId = activeArticleId();
    if (selectedId) return selectedId;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return "";
}

async function persistPrivateBody({ existingId, slug, title, status, split }) {
  const safeContent = safePublicContent(split);
  const articleId = await findSavedArticleId({ existingId, slug, title, safeContent });
  if (!articleId) throw new Error("SAVE_ID_NOT_FOUND");

  const articleRef = doc(db, "articles", articleId);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const publicSnapshot = await getDoc(articleRef);
    if (publicSnapshot.exists() && String(publicSnapshot.data()?.content || "").trim() === safeContent) break;
    if (attempt === 23) throw new Error("PUBLIC_PREVIEW_NOT_VERIFIED");
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  // paidArticleBodies 的寫入由 Firestore Rules 限定為管理員帳號。
  // 一般會員只有符合閱讀資格時才可讀取，永遠無法修改正文。
  const privateRef = doc(db, PRIVATE_COLLECTION, articleId);
  const previousPrivate = await getDoc(privateRef);
  const previousVersion = Math.max(0, Number(previousPrivate.data()?.contentVersion || 0));
  const contentVersion = previousVersion + 1;
  const contentHash = await sha256(split.privateContent);

  await setDoc(privateRef, {
    articleId,
    title,
    status: status === "draft" ? "draft" : "published",
    content: split.privateContent,
    contentHash,
    contentVersion,
    source: "article-admin-secure-addon",
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const privateVerify = await getDoc(privateRef);
  if (!privateVerify.exists() || String(privateVerify.data()?.content || "") !== split.privateContent) {
    throw new Error("PRIVATE_BODY_VERIFY_FAILED");
  }

  await setDoc(articleRef, {
    content: safeContent,
    accessType: "paid",
    privatePaidContent: true,
    paidContentHash: contentHash,
    paidContentVersion: contentVersion,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const publicVerify = await getDoc(articleRef);
  const publicSplit = splitPaidContent(publicVerify.data()?.content || "");
  if (!publicVerify.exists() || !publicSplit || publicSplit.privateContent) {
    throw new Error("PUBLIC_BODY_VERIFY_FAILED");
  }
  return { articleId, contentVersion };
}

async function hydrateEditorPaidBody() {
  if (!form) return;
  const serial = ++hydrationSerial;
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  if (serial !== hydrationSerial) return;
  const accessType = String(form.elements?.accessType?.value || "");
  const articleId = activeArticleId();
  const contentField = form.elements?.content;
  if (accessType !== "paid" || !articleId || !contentField) return;
  const split = splitPaidContent(contentField.value);
  if (!split || split.privateContent) return;

  try {
    const snapshot = await getDoc(doc(db, PRIVATE_COLLECTION, articleId));
    if (serial !== hydrationSerial || !snapshot.exists()) return;
    const privateContent = String(snapshot.data()?.content || "").trim();
    if (!privateContent) return;
    contentField.value = `${split.publicContent}\n\n${PAID_MARKER}\n\n${privateContent}`;
    contentField.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (error) {
    console.error("後台付費文章私有正文載入失敗。", error);
    showToast("文章試閱內容已載入，但私有正文暫時無法讀取，請先不要覆寫儲存。", "error");
  }
}

if (form) {
  form.addEventListener("submit", (event) => {
    if (forwardingSafeSubmit) return;
    const accessType = String(form.elements?.accessType?.value || "");
    if (accessType !== "paid") return;
    const contentField = form.elements?.content;
    if (!contentField) return;

    const split = splitPaidContent(contentField.value);
    if (!split || !split.publicContent || !split.privateContent) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus("無法儲存｜請設定付費分隔位置", "error");
      showToast("付費文章必須保留 <!-- paid-only -->，而且分隔線前後都需要有內容。", "error");
      return;
    }

    const fullContent = contentField.value;
    const safeContent = safePublicContent(split);
    const existingId = activeArticleId();
    const slug = String(form.elements?.slug?.value || "").trim();
    const title = String(form.elements?.title?.value || "").trim();
    const status = String(form.elements?.status?.value || "draft");

    // 外層 submit 不再交給其他 listener，避免 capture callback 結束後的
    // microtask checkpoint 提前恢復全文。改由同一呼叫堆疊同步派送一個
    // 只含安全試閱內容的 submit；article-admin-core 會在 dispatchEvent
    // 返回前同步讀取 FormData，之後才能安全地把完整內容放回編輯器。
    event.preventDefault();
    event.stopImmediatePropagation();
    contentField.value = safeContent;
    forwardingSafeSubmit = true;
    try {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    } finally {
      forwardingSafeSubmit = false;
      contentField.value = fullContent;
      contentField.dispatchEvent(new Event("input", { bubbles: true }));
    }

    void persistPrivateBody({ existingId, slug, title, status, split })
      .then(({ contentVersion }) => {
        setStatus(`已安全儲存｜付費正文版本 ${contentVersion}`, "success");
        showToast("付費文章已分離儲存：公開區只有試閱，完整正文已寫入私有資料區。", "success");
      })
      .catch((error) => {
        console.error("付費文章私有正文安全儲存失敗。", error);
        setStatus("文章試閱已儲存｜私有正文儲存失敗", "error");
        showToast("公開區未寫入付費正文，但私有正文儲存未完成。請保留目前編輯畫面並再按一次儲存。", "error");
      });
  }, true);
}

listEl?.addEventListener("click", () => {
  window.setTimeout(() => void hydrateEditorPaidBody(), 40);
}, true);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void hydrateEditorPaidBody();
});

window.addEventListener("pageshow", () => void hydrateEditorPaidBody());
