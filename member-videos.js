import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import { collection, doc, getDoc, getDocs, query, where } from "./firebase-config.js";
import { evaluateMember } from "./member-dashboard-logic.js";

const accessPanel = document.getElementById("video-access-panel");
const library = document.getElementById("video-library");
const memberTitle = document.getElementById("video-member-title");
const memberMeta = document.getElementById("video-member-meta");
const accountGuide = document.getElementById("video-account-guide");
const videoGrid = document.getElementById("member-video-grid");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "long" }).format(date) : "未設定";
}

function safeHttpsUrl(value = "") {
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

function safeCoverSource(video = {}) {
  return safeImageData(video.coverImageData || "")
    || safeHttpsUrl(video.coverImageUrl || video.coverUrl || video.thumbnailUrl || video.coverImage || "");
}

function safeYouTubeUrl(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com"].includes(host)) {
      id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : "";
  } catch {
    return "";
  }
}

function membershipLevel(member = {}) {
  return evaluateMember(member).effectiveLevel === "lingji" ? "靈極會員" : "一般會員";
}

function isActiveWellnessMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.disabled !== true
    && member.suspended !== true
    && member.revokedAt == null
    && Boolean(expiry && expiry > new Date());
}

function showAccessState(title, message, actions = "") {
  library.hidden = true;
  accessPanel.hidden = false;
  accessPanel.innerHTML = `<div class="access-mark">MEMBER ACCESS</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actions ? `<div class="access-actions">${actions}</div>` : ""}`;
}

function videoSort(a, b) {
  const order = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  if (order) return order;
  return (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0);
}

async function loadMemberVideos(level, isAdmin = false) {
  const videosRef = collection(db, "memberVideos");
  let snapshots;
  if (isAdmin) {
    snapshots = [await getDocs(videosRef)];
  } else {
    const levels = level === "lingji" ? ["wellness", "lingji"] : ["wellness"];
    snapshots = await Promise.all(levels.map((accessLevel) => getDocs(query(
      videosRef,
      where("status", "==", "published"),
      where("accessLevel", "==", accessLevel)
    ))));
  }
  const now = new Date();
  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    .filter((video) => video.status === "published")
    .filter((video) => !toDate(video.publishedAt) || toDate(video.publishedAt) <= now)
    .sort(videoSort);
}

function replaceBrokenCover(image) {
  const placeholder = document.createElement("span");
  placeholder.className = "video-cover-placeholder";
  placeholder.textContent = "PRIVATE MEMBER VIDEO";
  image.replaceWith(placeholder);
}

function renderVideos(videos, email) {
  if (!videos.length) {
    videoGrid.innerHTML = `<div class="empty-library"><span class="empty-symbol">◇</span><h3>會員影片即將上架</h3><p>新的養護與靈性修練內容，將依本期進度陸續放入這裡。</p></div>`;
    return;
  }

  videoGrid.innerHTML = videos.map((video) => {
    const watchUrl = safeYouTubeUrl(video.youtubeUrl);
    const coverSource = safeCoverSource(video);
    const accessLabel = video.accessLevel === "lingji" ? "靈極會員專屬" : "養生會員專屬";
    const date = toDate(video.publishedAt);
    return `<article class="video-card">
      <div class="video-cover">${coverSource ? `<img src="${escapeHtml(coverSource)}" alt="${escapeHtml(video.title)}影片封面" loading="lazy" data-member-video-cover>` : '<span class="video-cover-placeholder">PRIVATE MEMBER VIDEO</span>'}<span class="video-access-badge">${escapeHtml(accessLabel)}</span></div>
      <div class="video-copy"><div class="video-meta"><span class="video-tag">${escapeHtml(video.category || "MEMBER VIDEO")}</span><span class="video-date">${escapeHtml(video.duration || (date ? formatDate(date) : ""))}</span></div><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.description || "")}</p>${watchUrl ? `<a class="video-watch" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">前往 YouTube 觀看私人影片</a><p class="video-account">請以 ${escapeHtml(email)} 登入 YouTube</p>` : ""}</div>
    </article>`;
  }).join("");

  videoGrid.querySelectorAll("[data-member-video-cover]").forEach((image) => {
    if (image.complete && image.naturalWidth === 0) {
      replaceBrokenCover(image);
      return;
    }
    image.addEventListener("error", () => replaceBrokenCover(image), { once: true });
  });
}

function openMemberLogin() {
  document.getElementById("member-login-button")?.click();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-member-video-login]")) openMemberLogin();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAccessState(
      "請先登入會員帳號",
      "請使用登記養生會員資格的 Google 帳號登入，系統將自動核對您的有效會籍。",
      '<button class="access-button" type="button" data-member-video-login>會員登入</button><a class="access-link" href="/membership.html">查看會員制度</a>'
    );
    return;
  }

  try {
    const email = (user.email || "").trim().toLowerCase();
    if (isAdminEmail(email)) {
      const videos = await loadMemberVideos("lingji", true);
      accessPanel.hidden = true;
      library.hidden = false;
      memberTitle.textContent = "管理員預覽｜養生會員影片";
      memberMeta.textContent = email || "管理員帳號";
      accountGuide.textContent = `私人影片仍須在 YouTube Studio 授權；預覽帳號為 ${email}。`;
      renderVideos(videos, email);
      return;
    }

    const snapshot = await getDoc(doc(db, "memberAccess", email));
    const member = snapshot.exists() ? snapshot.data() : null;
    if (!member || !isActiveWellnessMember(member)) {
      const expired = member?.expiresAt
        ? `目前紀錄的會籍到期日為 ${formatDate(member.expiresAt)}。`
        : "系統目前查無有效的養生會員資格。";
      showAccessState(
        "目前沒有有效的影片權限",
        `${expired} 如需確認續會或會員資料，請聯繫靈元院行政團隊。`,
        '<a class="access-link" href="/membership.html">查看續會方式</a><a class="access-button" href="https://t.me/lyyuan" target="_blank" rel="noopener">聯繫行政團隊</a>'
      );
      return;
    }

    const level = evaluateMember(member).effectiveLevel;
    const videos = await loadMemberVideos(level);
    accessPanel.hidden = true;
    library.hidden = false;
    memberTitle.textContent = `${member.name || user.displayName || "會員"}｜${membershipLevel(member)}`;
    memberMeta.innerHTML = `有效會籍至<br>${escapeHtml(formatDate(member.expiresAt))}`;
    accountGuide.textContent = `請確認 YouTube 目前登入的帳號為 ${email}；不同帳號即使取得連結也無法觀看。`;
    renderVideos(videos, email);
  } catch (error) {
    console.error("養生會員影片權限確認失敗：", error);
    const denied = String(error?.code || "").includes("permission-denied");
    showAccessState(
      denied ? "會員影片權限核對失敗" : "暫時無法確認會員資格",
      denied
        ? "系統已登入您的會員帳號，但影片權限核對未通過。請重新整理頁面；若仍持續發生，請聯繫靈元院行政團隊。"
        : "系統目前無法完成權限核對，請稍後重新整理頁面再試。",
      '<button class="access-button" type="button" onclick="location.reload()">重新整理</button>'
    );
  }
});
