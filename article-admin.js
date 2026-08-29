import "./article-admin-core.js?v=20260829-preserve-backend-edits-1";
import "./article-admin-paid-security.js?v=20260825-paid-save-race-1";
import "./article-admin-secure-import.js?v=20260828-yuanqin-secure-import-1";
import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OFFICIAL_SENDER_EMAIL = "lyyuan03@gmail.com";
const SITE_URL = "https://lyyuan.tw";

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
  notifyStatus.textContent = message || "";
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

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function notExpired(value) {
  const expiry = dateValue(value);
  return !expiry || expiry > new Date();
}

function hasDirectSponsorAccess(member = {}) {
  return member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && notExpired(member.expiresAt);
}

function hasWellnessArticleAccess(member = {}) {
  const benefit = member.wellnessBenefit || {};
  return benefit.status === "active"
    && benefit.articleAccess === true
    && notExpired(benefit.expiresAt);
}

async function collectArticleNotificationRecipients() {
  const snapshot = await getDocs(collection(db, "sponsorMemberAccess"));
  const emails = new Set();
  snapshot.docs.forEach((item) => {
    const member = item.data() || {};
    if (!hasDirectSponsorAccess(member) && !hasWellnessArticleAccess(member)) return;
    const email = normalizeEmail(member.email || item.id);
    if (email && email.includes("@") && email !== OFFICIAL_SENDER_EMAIL) emails.add(email);
  });
  return [...emails].sort((a, b) => a.localeCompare(b, "zh-TW"));
}

function currentArticleInfo() {
  const articleId = currentArticleId();
  const title = String(form?.elements?.title?.value || "靈元院最新文章").trim() || "靈元院最新文章";
  const excerpt = String(form?.elements?.excerpt?.value || "").trim();
  const slug = String(form?.elements?.slug?.value || "").trim();
  const routeId = slug || articleId;
  const url = `${SITE_URL}/articles.html?id=${encodeURIComponent(routeId)}`;
  return { articleId, title, excerpt, url };
}

function notificationEmailContent() {
  const article = currentArticleInfo();
  const subject = `靈元院文選｜${article.title}`;
  const body = `師兄／師姐您好：\n\n靈元院文選已有最新文章上架：\n\n《${article.title}》\n\n${article.excerpt ? `${article.excerpt}\n\n` : ""}閱讀完整文章：\n${article.url}\n\n請使用目前具有贊助文章閱讀資格的 Gmail 登入靈元院官網，即可閱讀完整內容。\n\n祝福吉祥　母娘護佑\n靈元院行政團隊`;
  return { ...article, subject, body };
}

function officialGmailComposeUrl(recipients, subject, body) {
  const bcc = recipients.join(",");
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(OFFICIAL_SENDER_EMAIL)}&view=cm&fs=1&to=${encodeURIComponent(OFFICIAL_SENDER_EMAIL)}&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function prepareGmailWindow() {
  const emailWindow = window.open("about:blank", "_blank");
  if (!emailWindow) return null;
  emailWindow.document.title = "準備靈元院文章通知信";
  emailWindow.document.body.innerHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif;padding:32px;color:#594F47;line-height:1.8">正在以靈元院官方信箱 <strong>${OFFICIAL_SENDER_EMAIL}</strong> 建立文章通知信，請稍候…</div>`;
  return emailWindow;
}

function openOfficialGmailDraft(recipients, subject, body, emailWindow = null) {
  const url = officialGmailComposeUrl(recipients, subject, body);
  const draftWindow = emailWindow && !emailWindow.closed ? emailWindow : prepareGmailWindow();
  if (!draftWindow) {
    alert("瀏覽器阻擋了 Gmail 新視窗。請允許 lyyuan.tw 開啟彈出式視窗後再試一次；目前後台頁面會保留不變。");
    return false;
  }
  draftWindow.location.href = url;
  try { draftWindow.opener = null; } catch {}
  return true;
}

function updateButtonState() {
  const enabled = Boolean(currentArticleId()) && isPublished();
  [previewButton, notifyButton].forEach((button) => {
    if (!button) return;
    button.disabled = !enabled;
    button.title = enabled ? "" : "文章發布後才能建立通知信";
  });
  if (!enabled) setNotificationStatus("文章發布後，即可預覽並以靈元院 Gmail 建立上架通知信。", "");
  else if (notifyStatus?.textContent?.includes("文章發布後")) setNotificationStatus("");
}

async function handlePreview() {
  const articleId = currentArticleId();
  if (!articleId || !isPublished()) return;
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    showToast("瀏覽器封鎖了新分頁，請允許彈出式視窗後再試。", "error");
    return;
  }
  previewButton.disabled = true;
  setNotificationStatus("正在整理通知名單與內容…", "saving");
  try {
    const [recipients, mail] = await Promise.all([
      collectArticleNotificationRecipients(),
      Promise.resolve(notificationEmailContent())
    ]);
    previewWindow.document.open();
    previewWindow.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文章通知信預覽</title></head><body style="margin:0;background:#f3eee5;color:#2c261f;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif"><div style="max-width:760px;margin:24px auto;padding:0 18px"><div style="background:#17130d;color:#f5f0e8;padding:18px 20px;line-height:1.8"><strong>文章通知信預覽</strong><br><span style="font-size:13px;color:#d8c7a7">寄件帳號：${OFFICIAL_SENDER_EMAIL}<br>收件方式：密件副本 BCC<br>預計通知：${recipients.length.toLocaleString("zh-TW")} 位</span></div><div style="background:white;padding:30px;border:1px solid #d8c7a7"><div style="font-size:13px;color:#8a7354;margin-bottom:10px">主旨：${mail.subject}</div><pre style="white-space:pre-wrap;font:16px/1.9 -apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif">${mail.body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></div></div></body></html>`);
    previewWindow.document.close();
    setNotificationStatus(`預覽完成｜靈元院 Gmail｜預計通知 ${recipients.length.toLocaleString("zh-TW")} 位`, "success");
  } catch (error) {
    previewWindow.close();
    console.error(error);
    setNotificationStatus("無法取得會員通知名單，請確認管理員權限後再試。", "error");
    showToast("無法取得會員通知名單。", "error");
  } finally {
    updateButtonState();
  }
}

async function handleNotify() {
  const articleId = currentArticleId();
  if (!articleId || !isPublished()) return;

  const emailWindow = prepareGmailWindow();
  if (!emailWindow) {
    showToast("瀏覽器阻擋了 Gmail 新視窗。請允許 lyyuan.tw 開啟彈出式視窗後再試。", "error");
    return;
  }

  notifyButton.disabled = true;
  previewButton.disabled = true;
  setNotificationStatus("正在建立靈元院 Gmail 通知草稿…", "saving");

  try {
    const recipients = await collectArticleNotificationRecipients();
    if (!recipients.length) {
      emailWindow.document.body.innerHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif;padding:32px;color:#594F47;line-height:1.8"><strong>目前沒有符合贊助文章閱讀資格的會員。</strong><br><br>此視窗不會寄出任何信件，可以直接關閉。</div>`;
      setNotificationStatus("目前沒有符合贊助文章閱讀資格的會員。", "error");
      showToast("目前沒有符合閱讀資格的會員，因此未建立通知信。", "error");
      return;
    }

    const mail = notificationEmailContent();
    const opened = openOfficialGmailDraft(recipients, mail.subject, mail.body, emailWindow);
    if (!opened) return;

    setNotificationStatus(`已開啟 ${OFFICIAL_SENDER_EMAIL}｜BCC ${recipients.length.toLocaleString("zh-TW")} 位｜請在 Gmail 確認內容後按「寄送」`, "success");
    showToast("已開啟靈元院官方 Gmail 草稿，請確認內容與收件名單後再按寄送。", "success");
  } catch (error) {
    console.error(error);
    if (!emailWindow.closed) {
      emailWindow.document.body.innerHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif;padding:32px;color:#8b3f35;line-height:1.8"><strong>通知草稿建立失敗。</strong><br><br>無法取得會員名單，請回到文章後台再試一次。</div>`;
    }
    setNotificationStatus("通知信尚未建立｜無法取得會員名單。", "error");
    showToast("無法取得會員通知名單，請確認管理員權限後再試。", "error");
  } finally {
    updateButtonState();
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
  notifyButton.textContent = "開啟靈元院 Gmail 通知信";
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
}

installNotificationControls();
form?.elements?.status?.addEventListener("change", updateButtonState);
listEl?.addEventListener("click", () => queueMicrotask(updateButtonState));
newButton?.addEventListener("click", () => queueMicrotask(updateButtonState));
form?.addEventListener("submit", () => window.setTimeout(updateButtonState, 700));

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
