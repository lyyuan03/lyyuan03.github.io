import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("member-video-form");
const list = document.getElementById("member-video-list");
const status = document.getElementById("member-video-status");
const reset = document.getElementById("member-video-reset");
let videos = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function youtubeId(value = "") {
  const text = value.trim();
  const patterns = [/youtu\.be\/([A-Za-z0-9_-]{6,})/, /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/, /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/, /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return /^[A-Za-z0-9_-]{6,}$/.test(text) ? text : "";
}

function resetForm() {
  form.reset();
  document.getElementById("member-video-id").value = "";
  document.getElementById("member-video-status-select").value = "published";
}

async function saveVideo(event) {
  event.preventDefault();
  const youtubeUrl = document.getElementById("member-video-url").value.trim();
  if (!youtubeId(youtubeUrl)) {
    status.textContent = "請輸入有效的 YouTube 網址";
    return;
  }
  const originalId = document.getElementById("member-video-id").value.trim();
  const id = originalId || `video-${Date.now()}`;
  const existing = videos.find((video) => video.id === originalId);
  const payload = {
    title: document.getElementById("member-video-title").value.trim(),
    description: document.getElementById("member-video-description").value.trim(),
    youtubeUrl,
    status: document.getElementById("member-video-status-select").value,
    publishedAt: existing?.publishedAt || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "memberVideos", id), payload, { merge: true });
  status.textContent = originalId ? "影片已更新" : "影片已發布到靈極會員專區";
  resetForm();
  await loadVideos();
}

function renderVideos() {
  if (!videos.length) {
    list.innerHTML = '<div class="empty">目前尚未新增影片</div>';
    return;
  }
  list.innerHTML = videos.map((video) => `<div class="member-row"><div><strong>${escapeHtml(video.title || "未命名影片")}｜${video.status === "published" ? "已發布" : "草稿"}</strong><small>${escapeHtml(video.youtubeUrl || "")}</small></div><div class="member-row-actions"><button class="btn" type="button" data-video-edit="${escapeHtml(video.id)}">編輯</button><button class="btn danger" type="button" data-video-delete="${escapeHtml(video.id)}">刪除</button></div></div>`).join("");
  list.querySelectorAll("[data-video-edit]").forEach((button) => button.addEventListener("click", () => editVideo(button.dataset.videoEdit)));
  list.querySelectorAll("[data-video-delete]").forEach((button) => button.addEventListener("click", () => removeVideo(button.dataset.videoDelete)));
}

function editVideo(id) {
  const video = videos.find((item) => item.id === id);
  if (!video) return;
  document.getElementById("member-video-id").value = video.id;
  document.getElementById("member-video-title").value = video.title || "";
  document.getElementById("member-video-description").value = video.description || "";
  document.getElementById("member-video-url").value = video.youtubeUrl || "";
  document.getElementById("member-video-status-select").value = video.status || "draft";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeVideo(id) {
  const video = videos.find((item) => item.id === id);
  if (!confirm(`確定要刪除「${video?.title || "這支影片"}」嗎？`)) return;
  await deleteDoc(doc(db, "memberVideos", id));
  status.textContent = "影片已刪除";
  await loadVideos();
}

async function loadVideos() {
  const snapshot = await getDocs(collection(db, "memberVideos"));
  videos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  renderVideos();
}

form?.addEventListener("submit", (event) => saveVideo(event).catch(showError));
reset?.addEventListener("click", resetForm);

function showError(error) {
  console.error(error);
  status.textContent = error?.code === "permission-denied" ? "Firebase 影片管理權限尚未發布" : "影片資料處理失敗";
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try { await loadVideos(); } catch (error) { showError(error); }
});
