import { auth, db, provider, storage, isAdminEmail } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js";
import { signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

let articles = [];
let currentId = null;
let metricsByArticle = new Map();

const gate = document.getElementById("login-gate");
const app = document.getElementById("admin-app");
const gateStatus = document.getElementById("gate-status");
const loginButton = document.getElementById("admin-login");
const logoutButton = document.getElementById("admin-logout");
const userLabel = document.getElementById("admin-user");
const listEl = document.getElementById("article-list");
const metricsEl = document.getElementById("article-metrics");
const form = document.getElementById("article-form");
const preview = document.getElementById("preview");
const saveStatus = document.getElementById("save-status");
const saveStatusInline = document.getElementById("save-status-inline");
const saveButton = document.getElementById("save-article");
const adminToast = document.getElementById("admin-toast");
const deleteButton = document.getElementById("delete-article");
const newButton = document.getElementById("new-article");
const uploadButton = document.getElementById("upload-image");
const imageInput = document.getElementById("image-input");
const uploadStatus = document.getElementById("upload-status");
const exportButton = document.getElementById("export-articles");
const exportStatus = document.getElementById("export-status");
const accessTypeInput = document.getElementById("accessType");
const eventIdInput = document.getElementById("eventId");
const eventAccessField = document.getElementById("event-access-field");
let toastTimer = null;
let isSaving = false;
let eventOptions = [];

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptEventContent(content) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(content));
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return {
    key: bytesToBase64(new Uint8Array(rawKey)),
    iv: bytesToBase64(iv),
    encryptedContent: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptEventContent(encryptedContent, iv, rawKey) {
  const key = await crypto.subtle.importKey("raw", base64ToBytes(rawKey), { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encryptedContent)
  );
  return new TextDecoder().decode(decrypted);
}

function renderEventOptions(selected = "") {
  if (!eventIdInput) return;
  eventIdInput.innerHTML = '<option value="">請選擇活動</option>' + eventOptions.map((event) =>
    `<option value="${escapeHtml(event.id)}"${event.id === selected ? " selected" : ""}>${escapeHtml(event.name)}${event.status === "inactive" ? "（停用）" : ""}</option>`
  ).join("");
}

function toggleEventAccess() {
  if (!eventAccessField) return;
  const isEvent = accessTypeInput?.value === "event";
  eventAccessField.classList.toggle("hidden", !isEvent);
  if (eventIdInput) eventIdInput.required = isEvent;
}

async function loadEventOptions() {
  const snapshot = await getDoc(doc(db, "membershipSettings", "eventManagement"));
  eventOptions = snapshot.exists() && Array.isArray(snapshot.data().events) ? snapshot.data().events : [];
  renderEventOptions(eventIdInput?.value || "");
  toggleEventAccess();
}

async function loadAdminEventKeys() {
  const snapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
  return snapshot.exists() ? snapshot.data().keys || {} : {};
}

async function saveAdminEventKey(articleId, key) {
  const ref = doc(db, "membershipSettings", "eventArticleKeys");
  const snapshot = await getDoc(ref);
  const keys = snapshot.exists() ? snapshot.data().keys || {} : {};
  await setDoc(ref, { keys: { ...keys, [articleId]: key }, updatedAt: serverTimestamp() }, { merge: true });
}

async function distributeEventKey(eventId, articleId, key) {
  const snapshot = await getDocs(collection(db, "memberAccess"));
  const participants = snapshot.docs.filter((item) => item.data().eventAccess?.[eventId]?.status === "active");
  await Promise.all(participants.map((item) => {
    const data = item.data();
    return setDoc(item.ref, {
      eventArticleKeys: { ...(data.eventArticleKeys || {}), [articleId]: key },
      updatedAt: serverTimestamp()
    }, { merge: true });
  }));
  return participants.length;
}

const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .then(() => true)
  .catch((error) => {
    console.error("管理員登入狀態保存設定失敗：", error);
    return false;
  });

function setSaveStatus(message, state = "") {
  saveStatus.textContent = message;
  if (saveStatusInline) {
    saveStatusInline.textContent = message;
    if (state) saveStatusInline.dataset.state = state;
    else delete saveStatusInline.dataset.state;
  }
}

function showAdminToast(message, state = "success") {
  if (!adminToast) return;
  window.clearTimeout(toastTimer);
  adminToast.textContent = message;
  adminToast.className = `admin-toast is-visible is-${state}`;
  toastTimer = window.setTimeout(() => {
    adminToast.classList.remove("is-visible");
  }, state === "error" ? 6000 : 3600);
}

function savedTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function slugify(value) {
  const text = (value || "").trim().toLowerCase();
  const ascii = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `article-${Date.now()}`;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, '<img src="$2" alt="$1">');
}

function renderContent(value = "") {
  return value
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${renderInline(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${renderInline(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${renderInline(trimmed.slice(2))}</h1>`;
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    title: data.title.trim(),
    slug: slugify(data.slug || data.title),
    category: data.category,
    status: data.status,
    excerpt: data.excerpt.trim(),
    coverImage: data.coverImage.trim(),
    bookTitle: data.bookTitle.trim(),
    bookAuthor: data.bookAuthor.trim(),
    bookPublisher: data.bookPublisher.trim(),
    bookPurchaseUrl: data.bookPurchaseUrl.trim(),
    accessType: data.accessType || "open",
    eventId: (data.eventId || "").trim(),
    content: data.content.trim()
  };
}

function setFormData(article = {}) {
  form.title.value = article.title || "";
  form.slug.value = article.slug || "";
  form.category.value = article.category || "spiritual";
  form.status.value = article.status || "draft";
  form.excerpt.value = article.excerpt || "";
  form.coverImage.value = article.coverImage || "";
  form.bookTitle.value = article.bookTitle || "";
  form.bookAuthor.value = article.bookAuthor || "";
  form.bookPublisher.value = article.bookPublisher || "";
  form.bookPurchaseUrl.value = article.bookPurchaseUrl || "";
  form.accessType.value = article.accessType || ((article.content || "").includes("<!-- paid-only -->") ? "paid" : "open");
  renderEventOptions(article.eventId || "");
  toggleEventAccess();
  form.content.value = article.content || "";
  preview.innerHTML = renderContent(form.content.value);
  deleteButton.disabled = !currentId;
}

function newArticle() {
  currentId = null;
  setFormData();
  setSaveStatus("新增文章｜尚未儲存", "dirty");
  document.querySelectorAll(".article-item").forEach((item) => item.classList.remove("is-active"));
}

function renderList() {
  if (!articles.length) {
    listEl.innerHTML = '<div class="empty">目前尚無文章</div>';
    return;
  }
  listEl.innerHTML = articles.map((article) => `
    <button class="article-item${article.id === currentId ? " is-active" : ""}" type="button" data-id="${article.id}">
      <div class="article-item-title">${escapeHtml(article.title || "未命名文章")}</div>
      <div class="article-item-meta">${categoryLabels[article.category] || "未分類"}｜${article.status === "published" ? "已發布" : "草稿"}｜${article.source === "github-static" ? "網站文章" : "後台文章"}</div>
    </button>
  `).join("");
  listEl.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      currentId = button.dataset.id;
      const article = articles.find((item) => item.id === currentId);
      setFormData(article);
      renderList();
      setSaveStatus("尚未修改");
    });
  });
}

function renderMetricsDashboard() {
  if (!metricsEl) return;
  const titleMap = new Map();
  staticArticles.forEach((article) => titleMap.set(article.id, article.title || "未命名文章"));
  articles.forEach((article) => titleMap.set(article.id, article.title || "未命名文章"));
  metricsByArticle.forEach((value, id) => {
    if (!titleMap.has(id)) titleMap.set(id, value.articleTitle || id);
  });
  const rows = [...titleMap.entries()]
    .map(([id, title]) => ({ id, title, ...(metricsByArticle.get(id) || {}) }))
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  if (!rows.length) {
    metricsEl.innerHTML = '<div class="metrics-empty">尚無統計資料</div>';
    return;
  }
  metricsEl.innerHTML = rows.map((item) => `
    <div class="metrics-row">
      <div class="metrics-title">${escapeHtml(item.title)}</div>
      <div class="metrics-values">
        <span>閱讀 ${Number(item.views || 0).toLocaleString("zh-TW")}</span>
        <span>分享 ${Number(item.shares || 0).toLocaleString("zh-TW")}</span>
        <span>複製 ${Number(item.copies || 0).toLocaleString("zh-TW")}</span>
      </div>
    </div>
  `).join("");
}

function showFirestoreError(error) {
  console.error(error);
  const code = error?.code || "";
  if (code === "permission-denied") {
    listEl.innerHTML = '<div class="empty">Firestore 權限尚未開通。請確認 firestore.rules 已發布，且目前登入帳號為靈元院管理員 Gmail。</div>';
    saveStatus.textContent = "權限未開通";
    return;
  }
  if (code === "unavailable" || code === "failed-precondition" || code === "not-found") {
    listEl.innerHTML = '<div class="empty">Firestore Database 尚未建立或索引尚未完成，請先完成 Firebase 部署設定。</div>';
    saveStatus.textContent = "資料庫尚未就緒";
    return;
  }
  listEl.innerHTML = '<div class="empty">文章資料暫時無法載入，請稍後再試。</div>';
  saveStatus.textContent = "載入失敗";
}

async function loadArticles() {
  listEl.innerHTML = '<div class="empty">載入中…</div>';
  try {
    const snapshot = await getDocs(collection(db, "articles"));
    try {
      const metricsSnapshot = await getDocs(collection(db, "articleMetrics"));
      metricsByArticle = new Map(metricsSnapshot.docs.map((item) => [item.id, item.data()]));
    } catch (metricsError) {
      console.warn("文章統計暫時無法載入。", metricsError);
      metricsByArticle = new Map();
    }
    const adminKeys = await loadAdminEventKeys();
    const firestoreArticles = await Promise.all(snapshot.docs.map(async (item) => {
      const article = { id: item.id, ...item.data(), source: "firestore" };
      if (article.accessType === "event" && article.encryptedContent && article.eventIv && adminKeys[item.id]) {
        try {
          article.content = await decryptEventContent(article.encryptedContent, article.eventIv, adminKeys[item.id]);
        } catch (error) {
          console.error("活動文章解密失敗：", item.id, error);
          article.content = "";
        }
      }
      return article;
    }));
    const mergedArticles = new Map(
      staticArticles.map((article) => [article.id, { ...article, source: "github-static" }])
    );
    firestoreArticles.forEach((article) => mergedArticles.set(article.id, article));
    const articleTime = (value) => {
      if (!value) return 0;
      if (typeof value?.toMillis === "function") return value.toMillis();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    articles = [...mergedArticles.values()].sort((a, b) =>
      articleTime(b.updatedAt || b.publishedAt) - articleTime(a.updatedAt || a.publishedAt)
    );
    renderList();
    renderMetricsDashboard();
  } catch (error) {
    showFirestoreError(error);
  }
}

async function saveArticle(event) {
  event.preventDefault();
  const data = getFormData();
  if (!data.title || !data.content) {
    setSaveStatus("無法儲存｜請填寫標題與內文", "error");
    showAdminToast("文章尚未儲存：請至少填寫標題與內文。", "error");
    return;
  }
  if (data.accessType === "event" && !data.eventId) {
    setSaveStatus("無法儲存｜請指定活動", "error");
    showAdminToast("活動限定文章必須先指定活動。", "error");
    return;
  }
  isSaving = true;
  saveButton.disabled = true;
  saveButton.textContent = "儲存中…";
  setSaveStatus("正在儲存，請稍候…", "saving");
  try {
    const articleRef = currentId ? doc(db, "articles", currentId) : doc(collection(db, "articles"));
    currentId = articleRef.id;
    const payload = {
      ...data,
      updatedAt: serverTimestamp()
    };

    let distributedCount = 0;
    if (data.accessType === "event") {
      const protectedContent = await encryptEventContent(data.content);
      payload.content = "";
      payload.encryptedContent = protectedContent.encryptedContent;
      payload.eventIv = protectedContent.iv;
      payload.encryption = "AES-GCM-256";
      await saveAdminEventKey(currentId, protectedContent.key);
      distributedCount = await distributeEventKey(data.eventId, currentId, protectedContent.key);
    } else {
      payload.eventId = "";
      payload.encryptedContent = "";
      payload.eventIv = "";
      payload.encryption = "";
    }

    if (data.status === "published") payload.publishedAt = serverTimestamp();
    if (!articles.some((article) => article.id === currentId)) payload.createdAt = serverTimestamp();
    await setDoc(articleRef, payload, { merge: true });

    await loadArticles();
    const savedAt = savedTimeLabel();
    const note = data.accessType === "event" ? `｜已授權 ${distributedCount} 位活動參加者` : "";
    setSaveStatus(`已儲存｜${savedAt}${note}`, "success");
    showAdminToast(`文章已成功儲存｜${savedAt}${note}`, "success");
  } catch (error) {
    console.error(error);
    setSaveStatus("儲存失敗｜內容尚未更新", "error");
    showAdminToast("文章儲存失敗，請確認網路或管理員權限後再試。", "error");
  } finally {
    isSaving = false;
    saveButton.disabled = false;
    saveButton.textContent = "儲存文章";
  }
}

async function deleteArticle() {
  if (!currentId) return;
  if (!confirm("確定要刪除這篇文章嗎？")) return;
  saveStatus.textContent = "刪除中…";
  await deleteDoc(doc(db, "articles", currentId));
  currentId = null;
  setFormData();
  saveStatus.textContent = "已刪除";
  await loadArticles();
}

async function uploadImages(files) {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    alert("請先使用靈元院管理員 Gmail 登入。");
    return;
  }
  const selected = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!selected.length) return;

  uploadButton.disabled = true;
  uploadStatus.textContent = `上傳中 0/${selected.length}…`;

  const inserted = [];
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const articleKey = currentId || "draft";
    const storagePath = `articles/${articleKey}/${Date.now()}-${index + 1}-${safeName}`;
    const imageRef = ref(storage, storagePath);
    await uploadBytes(imageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: user.email || "",
        articleId: articleKey
      }
    });
    const url = await getDownloadURL(imageRef);
    inserted.push(`![${file.name}](${url})`);
    uploadStatus.textContent = `上傳中 ${index + 1}/${selected.length}…`;
  }

  const addition = `\n\n${inserted.join("\n\n")}\n\n`;
  const start = form.content.selectionStart || form.content.value.length;
  const end = form.content.selectionEnd || form.content.value.length;
  form.content.value = form.content.value.slice(0, start) + addition + form.content.value.slice(end);
  preview.innerHTML = renderContent(form.content.value);
  uploadStatus.textContent = `已插入 ${inserted.length} 張圖片`;
  uploadButton.disabled = false;
  imageInput.value = "";
}

function exportDate(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") return value;
  return "";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFileName(value, fallback = "article") {
  const cleaned = String(value || fallback)
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function articleForExport(article, source) {
  return {
    id: article.id || "",
    slug: article.slug || "",
    title: article.title || "",
    category: article.category || "",
    categoryLabel: categoryLabels[article.category] || "",
    status: article.status || "published",
    excerpt: article.excerpt || "",
    coverImage: article.coverImage || "",
    bookTitle: article.bookTitle || "",
    bookAuthor: article.bookAuthor || "",
    bookPublisher: article.bookPublisher || "",
    bookPurchaseUrl: article.bookPurchaseUrl || "",
    content: article.content || "",
    createdAt: exportDate(article.createdAt),
    updatedAt: exportDate(article.updatedAt),
    publishedAt: exportDate(article.publishedAt),
    source
  };
}

function articleMarkdown(article) {
  const frontMatter = [
    "---",
    `id: ${JSON.stringify(article.id)}`,
    `slug: ${JSON.stringify(article.slug)}`,
    `title: ${JSON.stringify(article.title)}`,
    `category: ${JSON.stringify(article.category)}`,
    `categoryLabel: ${JSON.stringify(article.categoryLabel)}`,
    `status: ${JSON.stringify(article.status)}`,
    `excerpt: ${JSON.stringify(article.excerpt)}`,
    `coverImage: ${JSON.stringify(article.coverImage)}`,
    `publishedAt: ${JSON.stringify(article.publishedAt)}`,
    `source: ${JSON.stringify(article.source)}`,
    "---",
    ""
  ].join("\n");
  return `${frontMatter}\n${article.content}\n`;
}

function collectImageRows(items) {
  const rows = [["文章ID", "文章標題", "類型", "圖片網址", "來源"]];
  items.forEach((article) => {
    if (article.coverImage) rows.push([article.id, article.title, "封面", article.coverImage, article.source]);
    const pattern = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    let match;
    while ((match = pattern.exec(article.content))) {
      rows.push([article.id, article.title, match[1] || "內文圖片", match[2], article.source]);
    }
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function joinBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    joined.set(part, offset);
    offset += part.length;
  });
  return joined;
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const stamp = zipDateTime();
  let localOffset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const dataBytes = typeof content === "string" ? encoder.encode(content) : content;
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localParts.push(localHeader, nameBytes, dataBytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralParts.push(centralHeader, nameBytes);

    localOffset += localHeader.length + nameBytes.length + dataBytes.length;
  });

  const centralDirectory = joinBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return joinBytes([...localParts, centralDirectory, end]);
}

async function exportAllArticles() {
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    alert("請先使用靈元院管理員 Gmail 登入。");
    return;
  }

  exportButton.disabled = true;
  exportButton.textContent = "整理文章中…";
  exportStatus.textContent = "";

  try {
    const snapshot = await getDocs(collection(db, "articles"));
    const firestoreItems = snapshot.docs.map((item) => articleForExport({ id: item.id, ...item.data() }, "firestore"));
    const staticItems = staticArticles.map((item) => articleForExport(item, "github-static"));
    const allItems = [...firestoreItems, ...staticItems].sort((a, b) =>
      String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt))
    );
    const exportedAt = new Date().toISOString();

    const indexRows = [
      ["ID", "網址代稱", "標題", "分類", "狀態", "發布時間", "來源"],
      ...allItems.map((article) => [
        article.id,
        article.slug,
        article.title,
        article.categoryLabel,
        article.status,
        article.publishedAt,
        article.source
      ])
    ];

    const files = [
      {
        name: "README.txt",
        content: [
          "靈元院文章完整匯出",
          `匯出時間：${exportedAt}`,
          `文章總數：${allItems.length}`,
          "",
          "all-articles.json：完整結構化文章資料。",
          "articles/：每篇文章的 Markdown 版本。",
          "article-index.csv：文章索引。",
          "image-manifest.csv：封面與內文圖片網址清單。",
          "",
          "注意：圖片本體仍存放在 GitHub assets 或 Firebase Storage；搬遷前請依 image-manifest.csv 下載備份。"
        ].join("\r\n")
      },
      {
        name: "all-articles.json",
        content: JSON.stringify({ exportedAt, project: "lyyuan03-membership", articles: allItems }, null, 2)
      },
      {
        name: "article-index.csv",
        content: "\ufeff" + indexRows.map((row) => row.map(csvCell).join(",")).join("\r\n")
      },
      {
        name: "image-manifest.csv",
        content: "\ufeff" + collectImageRows(allItems)
      },
      ...allItems.map((article, index) => ({
        name: `articles/${String(index + 1).padStart(3, "0")}-${safeFileName(article.slug || article.title)}.md`,
        content: articleMarkdown(article)
      }))
    ];

    const zipBytes = buildZip(files);
    const blob = new Blob([zipBytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `ling-yuan-yuan-articles-${date}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    exportStatus.textContent = `已匯出 ${allItems.length} 篇文章`;
  } catch (error) {
    console.error(error);
    exportStatus.textContent = "匯出失敗，請稍後再試。";
    alert("文章匯出失敗，請確認網路與 Firebase 權限。");
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = "匯出全部文章";
  }
}

loginButton.addEventListener("click", async () => {
  gateStatus.textContent = "登入中…";
  loginButton.disabled = true;
  loginButton.textContent = "登入中…";
  try {
    const persistenceEnabled = await authPersistenceReady;
    if (!persistenceEnabled) {
      throw new Error("無法啟用瀏覽器登入狀態保存");
    }
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
      gateStatus.textContent = "登入已取消。";
    } else {
      gateStatus.textContent = "登入失敗，請確認瀏覽器允許 Cookie 與網站資料後再試。";
    }
  } finally {
    if (!auth.currentUser) {
      loginButton.disabled = false;
      loginButton.textContent = "使用 Google 登入";
    }
  }
});

logoutButton.addEventListener("click", () => signOut(auth));
exportButton.addEventListener("click", exportAllArticles);
newButton.addEventListener("click", newArticle);
form.addEventListener("submit", saveArticle);
deleteButton.addEventListener("click", deleteArticle);
uploadButton.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => uploadImages(imageInput.files).catch((error) => {
  console.error(error);
  uploadStatus.textContent = "圖片上傳失敗，請確認 Firebase Storage 權限。";
  uploadButton.disabled = false;
}));
form.content.addEventListener("input", () => {
  preview.innerHTML = renderContent(form.content.value);
});
accessTypeInput?.addEventListener("change", toggleEventAccess);
window.addEventListener("activity-events-updated", (event) => {
  eventOptions = event.detail?.events || [];
  renderEventOptions(eventIdInput?.value || "");
  toggleEventAccess();
});
form.addEventListener("input", () => {
  if (!isSaving) setSaveStatus("內容已修改｜尚未儲存", "dirty");
});

onAuthStateChanged(auth, async (user) => {
  const persistenceEnabled = await authPersistenceReady;
  if (!user) {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
    loginButton.disabled = false;
    loginButton.textContent = "使用 Google 登入";
    gateStatus.textContent = persistenceEnabled
      ? "登入狀態已確認，請使用管理員帳號登入。"
      : "瀏覽器無法保存登入狀態，請確認 Cookie 與網站資料權限。";
    return;
  }
  if (!isAdminEmail(user.email)) {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
    loginButton.disabled = false;
    loginButton.textContent = "改用 Google 帳號登入";
    gateStatus.textContent = "此帳號沒有文章後台權限，請改用靈元院指定 Gmail 登入。";
    return;
  }
  gate.classList.add("hidden");
  app.classList.remove("hidden");
  userLabel.textContent = user.email;
  await loadEventOptions();
  await loadArticles();
  if (!currentId && !saveStatus.textContent) newArticle();
});
