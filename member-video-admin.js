import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("member-video-form");
const listEl = document.getElementById("member-video-list");
const statusEl = document.getElementById("member-video-status-message");
const resetButton = document.getElementById("member-video-reset");
let videos = [];

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

function resetForm() {
  form?.reset();
  document.getElementById("member-video-id").value = "";
  document.getElementById("member-video-category").value = "養護與修持";
  document.getElementById("member-video-access-level").value = "wellness";
  document.getElementById("member-video-status").value = "draft";
  document.getElementById("member-video-sort-order").value = "0";
}

function renderVideos() {
  if (!videos.length) {
    listEl.innerHTML = '<div class="empty">目前尚未建立會員影片入口</div>';
    return;
  }
  listEl.innerHTML = videos.map((video) => `<div class="member-row"><div><strong>${escapeHtml(video.title || "未命名影片")}｜${video.status === "published" ? "已發布" : "草稿"}</strong><small>${video.accessLevel === "lingji" ? "僅靈極會員" : "所有養生會員"}｜${escapeHtml(video.category || "未分類")}｜${escapeHtml(dateValue(video.publishedAt) || "未設定日期")}<br>${escapeHtml(video.youtubeUrl || "")}</small></div><div class="member-row-actions"><button class="btn" type="button" data-video-edit="${escapeHtml(video.id)}">編輯</button><button class="btn danger" type="button" data-video-delete="${escapeHtml(video.id)}">刪除</button></div></div>`).join("");
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
  document.getElementById("member-video-cover-url").value = video.coverImageUrl || "";
  document.getElementById("member-video-duration").value = video.duration || "";
  document.getElementById("member-video-access-level").value = video.accessLevel === "lingji" ? "lingji" : "wellness";
  document.getElementById("member-video-status").value = video.status === "published" ? "published" : "draft";
  document.getElementById("member-video-published-at").value = dateValue(video.publishedAt);
  document.getElementById("member-video-sort-order").value = Number(video.sortOrder) || 0;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveVideo(event) {
  event.preventDefault();
  const rawUrl = document.getElementById("member-video-youtube-url").value.trim();
  const videoId = youtubeVideoId(rawUrl);
  if (!videoId) {
    statusEl.textContent = "請輸入有效的 YouTube 影片網址";
    return;
  }
  const rawCover = document.getElementById("member-video-cover-url").value.trim();
  const coverImageUrl = safeCoverUrl(rawCover);
  if (rawCover && !coverImageUrl) {
    statusEl.textContent = "封面圖片網址必須使用 https";
    return;
  }
  const originalId = document.getElementById("member-video-id").value;
  const publishedDate = document.getElementById("member-video-published-at").value;
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
  statusEl.textContent = "會員影片入口已儲存";
  resetForm();
  await loadVideos();
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
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 影片權限規則尚未發布" : "會員影片資料處理失敗";
}

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
