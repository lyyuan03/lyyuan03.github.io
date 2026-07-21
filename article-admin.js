import { auth, db, provider, storage, isAdminEmail } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

let articles = [];
let currentId = null;

const gate = document.getElementById("login-gate");
const app = document.getElementById("admin-app");
const gateStatus = document.getElementById("gate-status");
const loginButton = document.getElementById("admin-login");
const logoutButton = document.getElementById("admin-logout");
const userLabel = document.getElementById("admin-user");
const listEl = document.getElementById("article-list");
const form = document.getElementById("article-form");
const preview = document.getElementById("preview");
const saveStatus = document.getElementById("save-status");
const deleteButton = document.getElementById("delete-article");
const newButton = document.getElementById("new-article");
const uploadButton = document.getElementById("upload-image");
const imageInput = document.getElementById("image-input");
const uploadStatus = document.getElementById("upload-status");
const exportButton = document.getElementById("export-articles");
const exportStatus = document.getElementById("export-status");

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
  return escapeHtml(value).replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
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
  form.content.value = article.content || "";
  preview.innerHTML = renderContent(form.content.value);
  deleteButton.disabled = !currentId;
}

function newArticle() {
  currentId = null;
  setFormData();
  saveStatus.textContent = "新增文章";
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
      <div class="article-item-meta">${categoryLabels[article.category] || "未分類"}｜${article.status === "published" ? "已發布" : "草稿"}</div>
    </button>
  `).join("");
  listEl.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      currentId = button.dataset.id;
      const article = articles.find((item) => item.id === currentId);
      setFormData(article);
      renderList();
      saveStatus.textContent = "";
    });
  });
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
    articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const at = a.updatedAt?.toMillis?.() || 0;
        const bt = b.updatedAt?.toMillis?.() || 0;
        return bt - at;
      });
    renderList();
  } catch (error) {
    showFirestoreError(error);
  }
}

async function saveArticle(event) {
  event.preventDefault();
  const data = getFormData();
  if (!data.title || !data.content) {
    alert("請至少填寫標題與內文。");
    return;
  }
  saveStatus.textContent = "儲存中…";
  const payload = {
    ...data,
    updatedAt: serverTimestamp()
  };
  if (data.status === "published") {
    payload.publishedAt = serverTimestamp();
  }
  if (currentId) {
    await updateDoc(doc(db, "articles", currentId), payload);
  } else {
    const created = await addDoc(collection(db, "articles"), {
      ...payload,
      createdAt: serverTimestamp()
    });
    currentId = created.id;
  }
  saveStatus.textContent = "已儲存";
  await loadArticles();
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
    URL.revokeObjectURL(url);

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
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    gateStatus.textContent = "登入失敗，請稍後再試。";
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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
    gateStatus.textContent = "";
    return;
  }
  if (!isAdminEmail(user.email)) {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
    gateStatus.textContent = "此帳號沒有文章後台權限，請改用靈元院指定 Gmail 登入。";
    return;
  }
  gate.classList.add("hidden");
  app.classList.remove("hidden");
  userLabel.textContent = user.email;
  await loadArticles();
  if (!currentId && !saveStatus.textContent) newArticle();
});
