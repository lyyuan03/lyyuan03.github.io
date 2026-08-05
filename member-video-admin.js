import { auth, db, storage, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const form = document.getElementById("member-video-form");
const listEl = document.getElementById("member-video-list");
const statusEl = document.getElementById("member-video-status-message");
const resetButton = document.getElementById("member-video-reset");
const coverUrlInput = document.getElementById("member-video-cover-url");
const MAX_COVER_SIZE = 8 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let videos = [];
let pendingCoverFile = null;
let coverPreviewObjectUrl = "";
let coverFileInput = null;
let coverPreviewImage = null;
let coverPreviewPlaceholder = null;
let coverUploadStatus = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function youtubeVideoId(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com"].includes(host)) id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/)?.[1] || "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function safeCoverUrl(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function dateValue(value) {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function revokeCoverPreviewUrl() {
  if (!coverPreviewObjectUrl) return;
  URL.revokeObjectURL(coverPreviewObjectUrl);
  coverPreviewObjectUrl = "";
}

function setCoverUploadStatus(message = "", state = "") {
  if (!coverUploadStatus) return;
  coverUploadStatus.textContent = message;
  if (state) coverUploadStatus.dataset.state = state;
  else delete coverUploadStatus.dataset.state;
}

function showCoverPreview(url = "", alt = "影片封面預覽") {
  if (!coverPreviewImage || !coverPreviewPlaceholder) return;
  coverPreviewImage.onerror = null;
  if (!url) {
    coverPreviewImage.hidden = true;
    coverPreviewImage.removeAttribute("src");
    coverPreviewPlaceholder.hidden = false;
    return;
  }
  coverPreviewImage.hidden = false;
  coverPreviewImage.alt = alt;
  coverPreviewImage.src = url;
  coverPreviewPlaceholder.hidden = true;
  coverPreviewImage.onerror = () => {
    coverPreviewImage.hidden = true;
    coverPreviewPlaceholder.hidden = false;
    setCoverUploadStatus("目前封面無法載入，請重新選擇圖片上傳。", "error");
  };
}

function clearPendingCover({ keepExisting = false } = {}) {
  pendingCoverFile = null;
  if (coverFileInput) coverFileInput.value = "";
  revokeCoverPreviewUrl();
  if (!keepExisting && coverUrlInput) coverUrlInput.value = "";
  const existingUrl = keepExisting ? safeCoverUrl(coverUrlInput?.value.trim()) : "";
  showCoverPreview(existingUrl);
  setCoverUploadStatus(existingUrl ? "目前使用已上傳的封面圖片。" : "尚未選擇封面圖片。", existingUrl ? "success" : "");
}

function selectCoverFile(file) {
  if (!file) return;
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    if (coverFileInput) coverFileInput.value = "";
    setCoverUploadStatus("封面僅支援 JPG、PNG、WebP 或 GIF 圖片。", "error");
    return;
  }
  if (file.size > MAX_COVER_SIZE) {
    if (coverFileInput) coverFileInput.value = "";
    setCoverUploadStatus("封面圖片不可超過 8 MB。", "error");
    return;
  }
  revokeCoverPreviewUrl();
  pendingCoverFile = file;
  coverPreviewObjectUrl = URL.createObjectURL(file);
  showCoverPreview(coverPreviewObjectUrl, `${file.name} 預覽`);
  setCoverUploadStatus(`已選擇：${file.name}，儲存時會自動上傳。`, "success");
}

function setupCoverUploader() {
  if (!coverUrlInput || document.getElementById("member-video-cover-upload-tools")) return;
  const field = coverUrlInput.closest(".field");
  if (!field) return;

  const label = field.querySelector("label");
  if (label) label.textContent = "影片封面圖片";
  coverUrlInput.type = "hidden";
  coverUrlInput.removeAttribute("placeholder");

  const tools = document.createElement("div");
  tools.id = "member-video-cover-upload-tools";
  tools.className = "member-video-cover-upload-tools";
  tools.innerHTML = `
    <div class="member-video-cover-preview">
      <img id="member-video-cover-preview-image" alt="影片封面預覽" hidden>
      <span id="member-video-cover-preview-placeholder">尚未上傳封面</span>
    </div>
    <div class="member-video-cover-actions">
      <button id="member-video-cover-select" class="btn" type="button">選擇圖片</button>
      <button id="member-video-cover-remove" class="btn danger" type="button">移除封面</button>
      <input id="member-video-cover-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
    </div>
    <small id="member-video-cover-upload-status" class="member-video-cover-upload-status">可直接上傳 JPG、PNG、WebP 或 GIF，檔案上限 8 MB；建議使用 16：9 圖片。</small>
  `;
  field.appendChild(tools);

  if (!document.getElementById("member-video-cover-upload-styles")) {
    const style = document.createElement("style");
    style.id = "member-video-cover-upload-styles";
    style.textContent = `
      .member-video-cover-upload-tools{display:grid;gap:10px}
      .member-video-cover-preview{position:relative;display:grid;place-items:center;overflow:hidden;aspect-ratio:16/9;border:1px solid rgba(165,130,84,.28);background:linear-gradient(145deg,rgba(96,99,48,.35),rgba(4,8,3,.75));color:rgba(245,240,232,.5);font-size:12px;letter-spacing:.08em}
      .member-video-cover-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
      .member-video-cover-actions{display:flex;gap:8px;flex-wrap:wrap}.member-video-cover-actions .btn{padding:8px 11px;font-size:12px}
      .member-video-cover-upload-status{display:block;color:rgba(245,240,232,.48);font-size:11px;line-height:1.7}
      .member-video-cover-upload-status[data-state="success"]{color:#BFD39C}.member-video-cover-upload-status[data-state="error"]{color:#F1AAA2}.member-video-cover-upload-status[data-state="saving"]{color:#D8BD91}
    `;
    document.head.appendChild(style);
  }

  coverFileInput = tools.querySelector("#member-video-cover-file");
  coverPreviewImage = tools.querySelector("#member-video-cover-preview-image");
  coverPreviewPlaceholder = tools.querySelector("#member-video-cover-preview-placeholder");
  coverUploadStatus = tools.querySelector("#member-video-cover-upload-status");

  tools.querySelector("#member-video-cover-select")?.addEventListener("click", () => coverFileInput?.click());
  tools.querySelector("#member-video-cover-remove")?.addEventListener("click", () => clearPendingCover());
  coverFileInput?.addEventListener("change", () => selectCoverFile(coverFileInput.files?.[0]));
  clearPendingCover();
}

function resetForm() {
  form?.reset();
  document.getElementById("member-video-id").value = "";
  document.getElementById("member-video-category").value = "養護與修持";
  document.getElementById("member-video-access-level").value = "wellness";
  document.getElementById("member-video-status").value = "draft";
  document.getElementById("member-video-sort-order").value = "0";
  clearPendingCover();
}

function renderVideos() {
  if (!videos.length) {
    listEl.innerHTML = '<div class="empty">目前尚未建立會員影片入口</div>';
    return;
  }
  listEl.innerHTML = videos.map((video) => `<div class="member-row"><div><strong>${escapeHtml(video.title || "未命名影片")}｜${video.status === "published" ? "已發布" : "草稿"}</strong><small>${video.accessLevel === "lingji" ? "僅靈極會員" : "所有養生會員"}｜${escapeHtml(video.category || "未分類")}｜${escapeHtml(dateValue(video.publishedAt) || "未設定日期")}｜${safeCoverUrl(video.coverImageUrl) ? "已上傳封面" : "未上傳封面"}<br>${escapeHtml(video.youtubeUrl || "")}</small></div><div class="member-row-actions"><button class="btn" type="button" data-video-edit="${escapeHtml(video.id)}">編輯</button><button class="btn danger" type="button" data-video-delete="${escapeHtml(video.id)}">刪除</button></div></div>`).join("");
  listEl.querySelectorAll("[data-video-edit]").forEach((button) => button.addEventListener("click", () => editVideo(button.dataset.videoEdit)));
  listEl.querySelectorAll("[data-video-delete]").forEach((button) => button.addEventListener("click", () => removeVideo(button.dataset.videoDelete)));
}

async function loadVideos() {
  const snapshot = await getDocs(collection(db, "memberVideos"));
  videos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  renderVideos();
}

function editVideo(id) {
  const video = videos.find((item) => item.id === id);
  if (!video) return;
  document.getElementById("member-video-id").value = video.id;
  document.getElementById("member-video-title").value = video.title || "";
  document.getElementById("member-video-youtube-url").value = video.youtubeUrl || "";
  document.getElementById("member-video-description").value = video.description || "";
  document.getElementById("member-video-category").value = video.category || "";
  coverUrlInput.value = safeCoverUrl(video.coverImageUrl || "");
  pendingCoverFile = null;
  if (coverFileInput) coverFileInput.value = "";
  revokeCoverPreviewUrl();
  showCoverPreview(coverUrlInput.value, `${video.title || "影片"}封面`);
  setCoverUploadStatus(coverUrlInput.value ? "目前使用已上傳的封面圖片；重新選擇圖片即可替換。" : "這支影片尚未上傳封面。", coverUrlInput.value ? "success" : "");
  document.getElementById("member-video-duration").value = video.duration || "";
  document.getElementById("member-video-access-level").value = video.accessLevel === "lingji" ? "lingji" : "wellness";
  document.getElementById("member-video-status").value = video.status === "published" ? "published" : "draft";
  document.getElementById("member-video-published-at").value = dateValue(video.publishedAt);
  document.getElementById("member-video-sort-order").value = Number(video.sortOrder) || 0;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadCoverImage(videoId) {
  if (!pendingCoverFile) return safeCoverUrl(coverUrlInput?.value.trim());
  const safeName = pendingCoverFile.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "cover-image";
  const storagePath = `articles/member-videos/${videoId}/${Date.now()}-${safeName}`;
  const imageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(imageRef, pendingCoverFile, {
    contentType: pendingCoverFile.type,
    customMetadata: {
      uploadedBy: auth.currentUser?.email || "",
      videoId
    }
  });
  return getDownloadURL(snapshot.ref);
}

async function saveVideo(event) {
  event.preventDefault();
  const submitButton = form?.querySelector('button[type="submit"]');
  const rawUrl = document.getElementById("member-video-youtube-url").value.trim();
  const videoId = youtubeVideoId(rawUrl);
  if (!videoId) {
    statusEl.textContent = "請輸入有效的 YouTube 影片網址";
    return;
  }
  const rawCover = coverUrlInput?.value.trim() || "";
  if (!pendingCoverFile && rawCover && !safeCoverUrl(rawCover)) {
    statusEl.textContent = "目前封面資料無效，請重新選擇圖片上傳";
    return;
  }

  const originalId = document.getElementById("member-video-id").value;
  const publishedDate = document.getElementById("member-video-published-at").value;
  if (submitButton) submitButton.disabled = true;
  try {
    if (pendingCoverFile) {
      statusEl.textContent = "正在上傳影片封面…";
      setCoverUploadStatus("正在上傳封面圖片…", "saving");
    } else {
      statusEl.textContent = "正在儲存會員影片入口…";
    }
    const coverImageUrl = await uploadCoverImage(videoId);
    const data = {
      title: document.getElementById("member-video-title").value.trim(),
      description: document.getElementById("member-video-description").value.trim(),
      category: document.getElementById("member-video-category").value.trim(),
      youtubeVideoId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      coverImageUrl,
      duration: document.getElementById("member-video-duration").value.trim(),
      accessLevel: document.getElementById("member-video-access-level").value === "lingji" ? "lingji" : "wellness",
      status: document.getElementById("member-video-status").value === "published" ? "published" : "draft",
      publishedAt: publishedDate ? `${publishedDate}T00:00:00+08:00` : "",
      sortOrder: Math.max(0, Number(document.getElementById("member-video-sort-order").value) || 0),
      updatedAt: serverTimestamp()
    };
    const isNewDocument = !originalId || originalId !== videoId;
    await setDoc(doc(db, "memberVideos", videoId), {
      ...data,
      ...(isNewDocument ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });
    if (originalId && originalId !== videoId) await deleteDoc(doc(db, "memberVideos", originalId));
    statusEl.textContent = "會員影片入口與封面圖片已儲存";
    resetForm();
    await loadVideos();
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function removeVideo(id) {
  const video = videos.find((item) => item.id === id);
  if (!confirm(`確定刪除「${video?.title || "這支影片"}」的官網入口嗎？YouTube 原始影片與已上傳封面檔案不會被刪除。`)) return;
  await deleteDoc(doc(db, "memberVideos", id));
  statusEl.textContent = "官網影片入口已刪除；請另至 YouTube Studio 維護私人分享名單";
  await loadVideos();
}

function showError(error) {
  console.error(error);
  if (error?.code === "storage/unauthorized") {
    statusEl.textContent = "封面上傳權限尚未生效，請稍候幾分鐘後再試";
    setCoverUploadStatus("Firebase Storage 權限尚未發布完成。", "error");
    return;
  }
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 影片權限規則尚未發布" : "會員影片資料處理失敗";
}

setupCoverUploader();
form?.addEventListener("submit", (event) => saveVideo(event).catch(showError));
resetButton?.addEventListener("click", resetForm);

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    resetForm();
    await loadVideos();
  } catch (error) {
    showError(error);
    listEl.innerHTML = '<div class="empty">會員影片資料暫時無法載入。</div>';
  }
});
