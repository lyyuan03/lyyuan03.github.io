import { auth, provider, isAdminEmail } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const functions = getFunctions(undefined, "asia-east1");
const api = {
  status: httpsCallable(functions, "youtubeAdminStatus"),
  authUrl: httpsCallable(functions, "youtubeCreateAuthUrl"),
  list: httpsCallable(functions, "youtubeListVideos"),
  preview: httpsCallable(functions, "youtubePreviewVideoUpdate"),
  apply: httpsCallable(functions, "youtubeApplyVideoUpdate"),
  disconnect: httpsCallable(functions, "youtubeDisconnect")
};

const gate = document.getElementById("gate");
const app = document.getElementById("app");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const connectButton = document.getElementById("connect");
const disconnectButton = document.getElementById("disconnect");
const refreshButton = document.getElementById("refresh");
const connectionStatus = document.getElementById("connection-status");
const videoStatus = document.getElementById("video-status");
const videoList = document.getElementById("video-list");
const editorPanel = document.getElementById("editor-panel");
const editor = document.getElementById("editor");
const videoIdInput = document.getElementById("video-id");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const previewBox = document.getElementById("preview");
const beforeBox = document.getElementById("before");
const afterBox = document.getElementById("after");
const applyButton = document.getElementById("apply");
const cancelButton = document.getElementById("cancel");
const editStatus = document.getElementById("edit-status");
let videos = [];
let pendingPreview = null;

function message(error) {
  return error?.message?.replace(/^Firebase:\s*/i, "") || "操作失敗，請稍後重試。";
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW").format(Number(value || 0));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

async function loadStatus() {
  connectionStatus.textContent = "檢查中…";
  const result = await api.status();
  const { connected, channelTitle } = result.data;
  connectionStatus.textContent = connected ? `已連接：${channelTitle || "YouTube 頻道"}` : "尚未連接";
  connectButton.disabled = connected;
  disconnectButton.disabled = !connected;
  refreshButton.disabled = !connected;
  if (connected) await loadVideos();
}

async function loadVideos() {
  videoStatus.textContent = "讀取中…";
  videoList.innerHTML = '<div class="status">正在讀取 YouTube 資料…</div>';
  try {
    const result = await api.list({ maxResults: 25 });
    videos = result.data.videos || [];
    videoStatus.textContent = `${result.data.channel?.title || "頻道"}｜${videos.length} 支影片`;
    renderVideos();
  } catch (error) {
    videoStatus.textContent = message(error);
    videoList.innerHTML = '<div class="status">無法載入影片。</div>';
  }
}

function renderVideos() {
  if (!videos.length) {
    videoList.innerHTML = '<div class="status">目前沒有可顯示的影片。</div>';
    return;
  }
  videoList.innerHTML = videos.map((video) => `
    <article class="video">
      <img src="${escapeHtml(video.thumbnail)}" alt="">
      <div>
        <h3>${escapeHtml(video.title)}</h3>
        <div class="meta">
          <span>觀看 ${formatNumber(video.viewCount)}</span>
          <span>按讚 ${formatNumber(video.likeCount)}</span>
          <span>留言 ${formatNumber(video.commentCount)}</span>
          <span>${escapeHtml(video.privacyStatus)}</span>
        </div>
      </div>
      <button class="btn edit-video" data-id="${escapeHtml(video.id)}">修改</button>
    </article>`).join("");
  document.querySelectorAll(".edit-video").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.dataset.id));
  });
}

function openEditor(id) {
  const video = videos.find((item) => item.id === id);
  if (!video) return;
  videoIdInput.value = video.id;
  titleInput.value = video.title;
  descriptionInput.value = video.description;
  pendingPreview = null;
  previewBox.classList.add("hidden");
  editorPanel.classList.remove("hidden");
  editStatus.textContent = "先產生預覽，不會立即修改。";
  editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editorPanel.classList.add("hidden");
  previewBox.classList.add("hidden");
  pendingPreview = null;
  editor.reset();
}

loginButton.addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); } catch (error) { alert(message(error)); }
});
logoutButton.addEventListener("click", () => signOut(auth));
connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  try {
    const result = await api.authUrl();
    location.href = result.data.url;
  } catch (error) {
    alert(message(error));
    connectButton.disabled = false;
  }
});
disconnectButton.addEventListener("click", async () => {
  if (!confirm("確定撤銷 YouTube 頻道連接？撤銷後需重新授權才能管理。")) return;
  await api.disconnect();
  videos = [];
  closeEditor();
  await loadStatus();
});
refreshButton.addEventListener("click", loadVideos);
cancelButton.addEventListener("click", closeEditor);

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  editStatus.textContent = "正在產生修改前後差異…";
  try {
    const result = await api.preview({
      videoId: videoIdInput.value,
      title: titleInput.value,
      description: descriptionInput.value
    });
    pendingPreview = result.data;
    beforeBox.textContent = `標題：${pendingPreview.before.title}\n\n說明：\n${pendingPreview.before.description}`;
    afterBox.textContent = `標題：${pendingPreview.after.title}\n\n說明：\n${pendingPreview.after.description}`;
    previewBox.classList.remove("hidden");
    editStatus.textContent = "請核對差異後再確認套用。";
  } catch (error) {
    editStatus.textContent = message(error);
  }
});

applyButton.addEventListener("click", async () => {
  if (!pendingPreview || !confirm("已確認修改內容，確定寫入 YouTube？")) return;
  applyButton.disabled = true;
  editStatus.textContent = "正在寫入 YouTube…";
  try {
    await api.apply({
      videoId: videoIdInput.value,
      title: pendingPreview.after.title,
      description: pendingPreview.after.description,
      confirmationToken: pendingPreview.confirmationToken,
      confirmed: true
    });
    editStatus.textContent = "修改完成，已建立稽核紀錄。";
    await loadVideos();
    closeEditor();
  } catch (error) {
    editStatus.textContent = message(error);
  } finally {
    applyButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  const allowed = Boolean(user && isAdminEmail(user.email));
  gate.classList.toggle("hidden", allowed);
  app.classList.toggle("hidden", !allowed);
  logoutButton.classList.toggle("hidden", !allowed);
  if (!allowed) return;
  const params = new URLSearchParams(location.search);
  if (params.get("oauthError")) alert(params.get("oauthError"));
  if (params.has("connected") || params.has("oauthError")) history.replaceState({}, "", location.pathname);
  try { await loadStatus(); } catch (error) { connectionStatus.textContent = message(error); }
});
