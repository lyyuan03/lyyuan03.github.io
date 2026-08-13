import "./article-admin-core.js?v=20260813-manual-image-markdown-3";
import { app } from "./firebase-config.js?v=20260813-manual-image-markdown-3";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const functions = getFunctions(app, "asia-east1");
const previewNotification = httpsCallable(functions, "previewArticleNotification");
const getNotificationStatus = httpsCallable(functions, "getArticleNotificationStatus");
const sendNotification = httpsCallable(functions, "notifyArticleSubscribers");

const form = document.getElementById("article-form");
const listEl = document.getElementById("article-list");
const newButton = document.getElementById("new-article");
const saveActions = document.querySelector(".save-actions");
const adminToast = document.getElementById("admin-toast");

let previewButton = null;
let notifyButton = null;
let notifyStatus = null;
let toastTimer = null;

function currentArticleId() {
  return listEl?.querySelector(".article-item.is-active")?.dataset?.id || "";
}

function isPublished() {
  return form?.elements?.status?.value === "published";
}

function setNotificationStatus(message, state = "") {
  if (!notifyStatus) return;
  const isPublishNotice = message === "只有已發布文章可以預覽或通知訂閱者";
  notifyStatus.textContent = isPublishNotice ? `⚠️ ${message}` : (message || "");
  notifyStatus.classList.toggle("notice-warning", isPublishNotice);
  if (state) notifyStatus.dataset.state = state;
  else delete notifyStatus.dataset.state;
}

function showToast(message, state = "success") {
  if (!adminToast) return;
  window.clearTimeout(toastTimer);
  adminToast.textContent = message;
  adminToast.className = `admin-toast is-visible is-${state}`;
  toastTimer = window.setTimeout(() => adminToast.classList.remove("is-visible"), state === "error" ? 6000 : 3600);
}

function errorMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("already-exists")) return "這篇文章已寄送過通知，系統已阻擋重複寄送。";
  if (code.includes("failed-precondition")) return error?.message || "只有已發布文章可以使用通知功能。";
  if (code.includes("permission-denied")) return "目前帳號沒有文章通知權限。";
  if (code.includes("not-found")) return "找不到這篇文章的 Firestore 紀錄，請先確認文章已儲存到後台。";
  if (code.includes("aborted")) return "郵件伺服器可能已接收通知，但系統未完成確認。請勿重複寄送，請先查看寄件備份。";
  if (code.includes("internal")) return "通知信未完成寄送。請先確認寄件備份與寄件信箱設定，不要立即重複按下寄送。";
  return error?.message || "操作失敗，請稍後再試。";
}

function updateButtonState() {
  const enabled = Boolean(currentArticleId()) && isPublished();
  [previewButton, notifyButton].forEach((button) => {
    if (!button) return;
    button.disabled = !enabled;
    button.title = enabled ? "" : "只有已發布文章可以使用通知功能";
  });
  if (!enabled) setNotificationStatus("只有已發布文章可以預覽或通知訂閱者");
  else if (notifyStatus?.textContent?.includes("只有已發布")) setNotificationStatus("");
}

function openPreviewWindow() {
  const previewWindow = window.open("", "_blank");
  if (previewWindow) {
    previewWindow.document.write("<!doctype html><html lang='zh-Hant'><meta charset='utf-8'><title>通知信預覽</title><body style='font-family:sans-serif;padding:24px'>正在產生通知信預覽…</body></html>");
    previewWindow.document.close();
  }
  return previewWindow;
}

async function getPreview(articleId) {
  const result = await previewNotification({ articleId });
  return result.data || {};
}

async function refreshNotificationDeliveryStatus() {
  const articleId = currentArticleId();
  if (!articleId || !isPublished()) return;
  try {
    const result = await getNotificationStatus({ articleId });
    const data = result.data || {};
    const count = Number(data.recipientCount || 0).toLocaleString("zh-TW");
    if (data.status === "sent") {
      notifyButton.disabled = true;
      setNotificationStatus(`已確認寄出｜共 ${count} 位收件者`, "success");
    } else if (["sending", "smtp-accepted", "delivery-unknown"].includes(data.status)) {
      notifyButton.disabled = true;
      setNotificationStatus("寄送狀態尚未確認，請勿重複寄送；請先查看寄件備份。", "error");
    } else if (data.status === "error") {
      const detail = String(data.errorMessage || "").trim();
      setNotificationStatus(
        detail
          ? `寄送失敗｜${detail}`
          : "寄送失敗｜系統沒有取得詳細原因，請檢查 Firebase Functions 記錄。",
        "error"
      );
    }
  } catch (error) {
    console.warn("無法讀取文章通知寄送狀態。", error);
  }
}

async function handlePreview() {
  const articleId = currentArticleId();
  if (!articleId || !isPublished()) return;
  const previewWindow = openPreviewWindow();
  previewButton.disabled = true;
  setNotificationStatus("正在產生預覽…", "saving");
  try {
    const data = await getPreview(articleId);
    if (previewWindow) {
      previewWindow.document.open();
      previewWindow.document.write(data.html || "<p>無法產生預覽。</p>");
      previewWindow.document.close();
    } else {
      showToast("瀏覽器封鎖了新分頁，請允許彈出視窗後再試。", "error");
    }
    setNotificationStatus(`預覽完成｜預計通知 ${Number(data.recipientCount || 0).toLocaleString("zh-TW")} 位`, "success");
  } catch (error) {
    if (previewWindow) previewWindow.close();
    const message = errorMessage(error);
    setNotificationStatus(message, "error");
    showToast(message, "error");
  } finally {
    updateButtonState();
  }
}

async function handleNotify() {
  const articleId = currentArticleId();
  if (!articleId || !isPublished()) return;
  notifyButton.disabled = true;
  previewButton.disabled = true;
  setNotificationStatus("正在確認收件對象…", "saving");
  try {
    const preview = await getPreview(articleId);
    const confirmed = window.confirm(
      `確定要通知這篇文章的訂閱者嗎？\n\n收件對象：${preview.recipientScope || "依文章權限判定"}\n預計收件人數：${Number(preview.recipientCount || 0).toLocaleString("zh-TW")} 位\n\n每篇文章成功寄送後只能通知一次。`
    );
    if (!confirmed) {
      setNotificationStatus("已取消寄送");
      return;
    }

    setNotificationStatus("通知信寄送中…", "saving");
    const result = await sendNotification({ articleId });
    const data = result.data || {};
    const message = `通知完成｜已寄送 ${Number(data.recipientCount || 0).toLocaleString("zh-TW")} 位`;
    setNotificationStatus(message, "success");
    showToast(message, "success");
  } catch (error) {
    const message = errorMessage(error);
    setNotificationStatus(message, "error");
    showToast(message, "error");
  } finally {
    updateButtonState();
    await refreshNotificationDeliveryStatus();
  }
}

function installNotificationControls() {
  if (!saveActions || document.getElementById("preview-article-notification")) return;

  previewButton = document.createElement("button");
  previewButton.id = "preview-article-notification";
  previewButton.className = "btn";
  previewButton.type = "button";
  previewButton.textContent = "預覽通知信";
  previewButton.addEventListener("click", handlePreview);

  notifyButton = document.createElement("button");
  notifyButton.id = "notify-article-subscribers";
  notifyButton.className = "btn primary";
  notifyButton.type = "button";
  notifyButton.textContent = "通知訂閱者";
  notifyButton.addEventListener("click", handleNotify);

  notifyStatus = document.createElement("span");
  notifyStatus.id = "article-notification-status";
  notifyStatus.className = "save-status-inline";
  notifyStatus.setAttribute("role", "status");
  notifyStatus.setAttribute("aria-live", "polite");

  const deleteButton = document.getElementById("delete-article");
  saveActions.insertBefore(previewButton, deleteButton || null);
  saveActions.insertBefore(notifyButton, deleteButton || null);
  saveActions.insertBefore(notifyStatus, deleteButton || null);
  updateButtonState();
  void refreshNotificationDeliveryStatus();
}

installNotificationControls();
form?.elements?.status?.addEventListener("change", () => {
  updateButtonState();
  void refreshNotificationDeliveryStatus();
});
listEl?.addEventListener("click", () => queueMicrotask(() => {
  updateButtonState();
  void refreshNotificationDeliveryStatus();
}));
newButton?.addEventListener("click", () => queueMicrotask(updateButtonState));
form?.addEventListener("submit", () => window.setTimeout(() => {
  updateButtonState();
  void refreshNotificationDeliveryStatus();
}, 500));

const observer = new MutationObserver(updateButtonState);
if (listEl) observer.observe(listEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

const ADMIN_WELLNESS_OLD_LABEL = "養生療癒";
const ADMIN_WELLNESS_NEW_LABEL = "養生療遇";

function replaceAdminWellnessWording(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    if (node.nodeValue?.includes(ADMIN_WELLNESS_OLD_LABEL)) {
      node.nodeValue = node.nodeValue.replaceAll(ADMIN_WELLNESS_OLD_LABEL, ADMIN_WELLNESS_NEW_LABEL);
    }
  });

  document.querySelectorAll('[placeholder*="養生療癒"],[title*="養生療癒"],[aria-label*="養生療癒"]').forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value?.includes(ADMIN_WELLNESS_OLD_LABEL)) {
        element.setAttribute(attribute, value.replaceAll(ADMIN_WELLNESS_OLD_LABEL, ADMIN_WELLNESS_NEW_LABEL));
      }
    });
  });
}

replaceAdminWellnessWording();
const adminWellnessWordingObserver = new MutationObserver(() => replaceAdminWellnessWording());
adminWellnessWordingObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "title", "aria-label"]
});
