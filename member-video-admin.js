import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("member-video-form");
const listEl = document.getElementById("member-video-list");
const statusEl = document.getElementById("member-video-status-message");
const resetButton = document.getElementById("member-video-reset");
const coverUrlInput = document.getElementById("member-video-cover-url");
const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_COVER_DATA_LENGTH = 700 * 1024;
const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let videos = [];
let pendingCoverFile = null;
let existingCoverData = "";
let coverPreviewObjectUrl = "";
let coverFileInput = null;
let coverPreviewImage = null;
let coverPreviewPlaceholder = null;
let coverUploadStatus = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function youtubeVideoId(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com"].includes(host)) {
      id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function safeHttpsUrl(value = "") {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeImageData(value = "") {
  return /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(value) ? value : "";
}

function coverSource(video = {}) {
  return safeImageData(video.coverImageData || "")
    || safeHttpsUrl(video.coverImageUrl || video.coverUrl || video.thumbnailUrl || video.coverImage || "");
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

function showCoverPreview(source = "", alt = "影片封面預覽") {
  if (!coverPreviewImage || !coverPreviewPlaceholder) return;
  coverPreviewImage.onerror = null;
  if (!source) {
    coverPreviewImage.hidden = true;
    coverPreviewImage.removeAttribute("src");
    coverPreviewPlaceholder.hidden = false;
    return;
  }
  coverPreviewImage.hidden = false;
  coverPreviewImage.alt = alt;
  coverPreviewImage.src = source;
  coverPreviewPlaceholder.hidden = true;
  coverPreviewImage.onerror = () => {
    coverPreviewImage.hidden = true;
    coverPreviewPlaceholder.hidden = false;
    setCoverUploadStatus("目前封面無法載入，請重新選擇圖片。", "error");
  };
}

function clearPendingCover({ keepExisting = false } = {}) {
  pendingCoverFile = null;
  if (coverFileInput) coverFileInput.value = "";
  revokeCoverPreviewUrl();
  if (!keepExisting) {
    existingCoverData = "";
    if (coverUrlInput) coverUrlInput.value = "";
  }
  const source = keepExisting
    ? (safeImageData(existingCoverData) || safeHttpsUrl(coverUrlInput?.value.trim()))
    : "";
  showCoverPreview(source);
  setCoverUploadStatus(source ? "目前使用已儲存的封面圖片。" : "尚未選擇封面圖片。", source ? "success" : "");
}

function selectCoverFile(file) {
  if (!file) return;
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    if (coverFileInput) coverFileInput.value = "";
    setCoverUploadStatus("封面僅支援 JPG、PNG、WebP 或 GIF 圖片。", "error");
    return;
  }
  if (file.size > MAX_SOURCE_SIZE) {
    if (coverFileInput) coverFileInput.value = "";
    setCoverUploadStatus("封面圖片不可超過 8 MB。", "error");
    return;
  }
  revokeCoverPreviewUrl();
  pendingCoverFile = file;
  coverPreviewObjectUrl = URL.createObjectURL(file);
  showCoverPreview(coverPreviewObjectUrl, `${file.name} 預覽`);
  setCoverUploadStatus(`已選擇：${file.name}，儲存時會自動壓縮並寫入影片資料。`, "success");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("cover-image-read-failed"));
    };
    image.src = objectUrl;
  });
}

function drawCoverCanvas(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("canvas-not-supported");

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  return canvas;
}

async function optimizeCoverFile(file) {
  const image = await loadImage(file);
  const attempts = [
    [1280, 720, 0.84],
    [1280, 720, 0.72],
    [1120, 630, 0.72],
    [960, 540, 0.7],
    [800, 450, 0.66]
  ];

  for (const [width, height, quality] of attempts) {
    const canvas = drawCoverCanvas(image, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_COVER_DATA_LENGTH) return dataUrl;
  }
  throw new Error("cover-image-too-large-after-compression");
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
    <small id="member-video-cover-upload-status" class="member-video-cover-upload-status">直接選擇圖片即可；系統會自動裁切為 16：9 並壓縮儲存，不再使用外部圖片網址。</small>
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

function setSubmitState(isSaving) {
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isSaving;
  submitButton.textContent = isSaving ? "正在儲存…" : "儲存影片入口";
}

function resetForm() {
  form?.reset();
  document.getElementById("member-video-id").value = "";
  document.getElementById("member-video-category").value = "養護與修持";
  document.getElementById("member-video-access-level").value = "wellness";
  document.getElementById("member-video-status").value = "draft";
  document.getElementById("member-video-sort-order").value = "0";
  clearPendingCover();
  setSubmitState(false);
}

function renderVideos() {
  if (!videos.length) {
    listEl.innerHTML = '<div class="empty">目前尚未建立會員影片入口</div>';
    return;
  }
  listEl.innerHTML = videos.map((video) => {
    const hasCover = Boolean(coverSource(video));
    return `<div class="member-row"><div><strong>${escapeHtml(video.title || "未命名影片")}｜${video.status === "published" ? "已發布" : "草稿"}</strong><small>${video.accessLevel === "lingji" ? "僅靈極會員" : "所有養生會員"}｜${escapeHtml(video.category || "未分類")}｜${escapeHtml(dateValue(video.publishedAt) || "未設定日期")}｜${hasCover ? "已上傳封面" : "未上傳封面"}<br>${escapeHtml(video.youtubeUrl || "")}</small></div><div class="member-row-actions"><button class="btn" type="button" data-video-edit="${escapeHtml(video.id)}">編輯</button><button class="btn danger" type="button" data-video-delete="${escapeHtml(video.id)}">刪除</button></div></div>`;
  }).join("");
  listEl.querySelectorAll("[data-video-edit]").forEach((button) => button.addEventListener("click", () => editVideo(button.dataset.videoEdit)));
  listEl.querySelectorAll("[data-video-delete]").forEach((button) => button.addEventListener("click", () => removeVideo(button.dataset.videoDelete)));
}

async function loadVideos() {
  const snapshot = await getDocs(collection(db, "memberVideos"));
  videos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
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
  existingCoverData = safeImageData(video.coverImageData || "");
  coverUrlInput.value = safeHttpsUrl(video.coverImageUrl || video.coverUrl || video.thumbnailUrl || video.coverImage || "");
  pendingCoverFile = null;
  if (coverFileInput) coverFileInput.value = "";
  revokeCoverPreviewUrl();
  const source = existingCoverData || coverUrlInput.value;
  showCoverPreview(source, `${video.title || "影片"}封面`);
  setCoverUploadStatus(source ? "目前使用已儲存的封面圖片；重新選擇即可替換。" : "這支影片尚未上傳封面。", source ? "success" : "");
  document.getElementById("member-video-duration").value = video.duration || "";
  document.getElementById("member-video-access-level").value = video.accessLevel === "lingji" ? "lingji" : "wellness";
  document.getElementById("member-video-status").value = video.status === "published" ? "published" : "draft";
  document.getElementById("member-video-published-at").value = dateValue(video.publishedAt);
  document.getElementById("member-video-sort-order").value = Number(video.sortOrder) || 0;
  setSubmitState(false);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveVideo(event) {
  event.preventDefault();
  if (!form?.reportValidity()) return;

  const rawUrl = document.getElementById("member-video-youtube-url").value.trim();
  const videoId = youtubeVideoId(rawUrl);
  if (!videoId) {
    statusEl.textContent = "請輸入有效的 YouTube 影片網址";
    return;
  }

  const originalId = document.getElementById("member-video-id").value;
  const publishedDate = document.getElementById("member-video-published-at").value;
  setSubmitState(true);

  try {
    let coverImageData = existingCoverData;
    let coverImageUrl = safeHttpsUrl(coverUrlInput?.value.trim());

    if (pendingCoverFile) {
      statusEl.textContent = "正在處理影片封面…";
      setCoverUploadStatus("正在裁切、壓縮並儲存封面圖片…", "saving");
      coverImageData = await optimizeCoverFile(pendingCoverFile);
      coverImageUrl = "";
    }

    statusEl.textContent = "正在儲存會員影片入口…";
    const data = {
      title: document.getElementById("member-video-title").value.trim(),
      description: document.getElementById("member-video-description").value.trim(),
      category: document.getElementById("member-video-category").value.trim(),
      youtubeVideoId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      coverImageData,
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
    setCoverUploadStatus("封面圖片已儲存。", "success");
    resetForm();
    await loadVideos();
  } catch (error) {
    showError(error);
  } finally {
    setSubmitState(false);
  }
}

async function removeVideo(id) {
  const video = videos.find((item) => item.id === id);
  if (!confirm(`確定刪除「${video?.title || "這支影片"}」的官網入口嗎？YouTube 原始影片不會被刪除。`)) return;
  await deleteDoc(doc(db, "memberVideos", id));
  statusEl.textContent = "官網影片入口已刪除；請另至 YouTube Studio 維護私人分享名單";
  await loadVideos();
}

function showError(error) {
  console.error(error);
  if (error?.message === "cover-image-too-large-after-compression") {
    statusEl.textContent = "封面圖片處理後仍過大，請改用較小的 JPG 或 PNG 圖片";
    setCoverUploadStatus("圖片仍過大，請重新選擇尺寸較小的封面。", "error");
    return;
  }
  if (error?.message === "cover-image-read-failed") {
    statusEl.textContent = "無法讀取這張封面圖片，請重新選擇檔案";
    setCoverUploadStatus("圖片檔案無法讀取。", "error");
    return;
  }
  statusEl.textContent = error?.code === "permission-denied"
    ? "目前帳號沒有儲存會員影片的權限"
    : `會員影片資料處理失敗${error?.message ? `：${error.message}` : ""}`;
  setCoverUploadStatus("儲存失敗，按鈕已恢復，可修正後重新儲存。", "error");
}

setupCoverUploader();
form?.addEventListener("submit", saveVideo);
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
