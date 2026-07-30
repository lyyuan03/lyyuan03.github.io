import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const root = document.getElementById("member-video-root");
let currentUser = null;
let currentAccess = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function youtubeId(value = "") {
  const text = value.trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return /^[A-Za-z0-9_-]{6,}$/.test(text) ? text : "";
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLevel(value = "") {
  if (value === "lingji") return "lingji";
  return "general";
}

function accessLevel() {
  if (isAdminEmail(currentUser?.email)) return "lingji";
  return normalizeLevel(currentAccess?.memberLevel || currentAccess?.level);
}

function isActiveMember() {
  if (isAdminEmail(currentUser?.email)) return true;
  const expiry = dateValue(currentAccess?.expiresAt);
  return currentAccess?.status === "active" && expiry && expiry > new Date();
}

function memberStartDate() {
  if (isAdminEmail(currentUser?.email)) return new Date(0);
  return dateValue(currentAccess?.firstJoinedAt || currentAccess?.startsAt);
}

function canWatch(video) {
  if (!isActiveMember()) return false;
  const requiredLevel = normalizeLevel(video.accessLevel || video.memberLevel || "general");
  if (requiredLevel === "lingji" && accessLevel() !== "lingji") return false;
  const joinedAt = memberStartDate();
  const publishedAt = dateValue(video.publishedAt || video.createdAt);
  if (!joinedAt || !publishedAt) return false;
  return publishedAt >= joinedAt;
}

async function loadAccess(user) {
  currentAccess = null;
  if (!user?.email || isAdminEmail(user.email)) return;
  const email = user.email.trim().toLowerCase();
  const snapshot = await getDoc(doc(db, "memberAccess", email));
  if (snapshot.exists()) currentAccess = snapshot.data();
}

async function loadVideos() {
  let videos = [];
  try {
    const snapshot = await getDocs(query(collection(db, "memberVideos"), where("status", "==", "published"), orderBy("publishedAt", "desc")));
    videos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("會員影片暫時無法載入。", error);
  }
  render(videos);
}

function lockedMessage(video) {
  if (!currentUser) return "請先使用登記的 Gmail 登入。";
  if (!isActiveMember()) return "目前帳號沒有有效會員資格，或資格已到期。";
  if (normalizeLevel(video.accessLevel) === "lingji" && accessLevel() !== "lingji") return "此影片為靈極會員專屬內容。";
  return "此影片發布於您首次加入會員之前，因此不在本次會員權益範圍內。";
}

function render(videos) {
  if (!videos.length) {
    root.innerHTML = '<div class="video-empty">目前尚未發布會員影片。</div>';
    return;
  }
  root.innerHTML = `<div class="video-grid">${videos.map((video) => {
    const id = youtubeId(video.youtubeUrl || video.youtubeId || "");
    const title = escapeHtml(video.title || "會員專屬影片");
    const description = escapeHtml(video.description || "");
    const date = dateValue(video.publishedAt || video.createdAt);
    const dateLabel = date ? new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric" }).format(date) : "";
    const levelLabel = normalizeLevel(video.accessLevel) === "lingji" ? "靈極會員專屬" : "一般會員影片";
    if (canWatch(video) && id) {
      return `<article class="video-card is-open"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="video-copy"><span>${escapeHtml(levelLabel)}｜${escapeHtml(dateLabel)}</span><h2>${title}</h2>${description ? `<p>${description}</p>` : ""}</div></article>`;
    }
    return `<article class="video-card is-locked"><div class="video-lock"><span>${escapeHtml(levelLabel)}</span><strong>${title}</strong><p>${escapeHtml(lockedMessage(video))}</p><button type="button" data-member-login>${currentUser ? "重新確認會員資格" : "會員登入"}</button></div></article>`;
  }).join("")}</div>`;
  root.querySelectorAll("[data-member-login]").forEach((button) => button.addEventListener("click", () => document.getElementById("member-login-button")?.click()));
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  try { await loadAccess(user); } catch (error) { console.warn("會員資格暫時無法確認。", error); }
  await loadVideos();
});

loadVideos();
