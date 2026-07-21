import { auth, db, provider, storage, isAdminEmail } from "./firebase-config.js";
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
