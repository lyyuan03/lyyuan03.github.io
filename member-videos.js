import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { evaluateMember } from "./member-dashboard-logic.js";

// 新影片上架時，依序加入標題、說明與 YouTube 嵌入網址即可。
const memberVideos = [];

const accessPanel = document.getElementById("video-access-panel");
const library = document.getElementById("video-library");
const memberTitle = document.getElementById("video-member-title");
const memberMeta = document.getElementById("video-member-meta");
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

function membershipLevel(member = {}) {
  return evaluateMember(member).effectiveLevel === "lingji"
    ? "靈極會員"
    : "一般會員";
}

function isActiveWellnessMember(member = {}) {
  const isWellness = member.memberType === "wellness-channel" || ["wellness", "lingji"].includes(member.memberLevel);
  const expiry = toDate(member.expiresAt);
  return isWellness && member.status === "active" && Boolean(expiry && expiry > new Date());
}

function showAccessState(title, message, actions = "") {
  library.hidden = true;
  accessPanel.hidden = false;
  accessPanel.innerHTML = `<div class="access-mark">MEMBER ACCESS</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actions ? `<div class="access-actions">${actions}</div>` : ""}`;
}

function renderVideos() {
  if (!memberVideos.length) {
    videoGrid.innerHTML = `<div class="empty-library"><span class="empty-symbol">◇</span><h3>會員影片即將上架</h3><p>新的養護與靈性修練內容，將依本期進度陸續放入這裡。</p></div>`;
    return;
  }
  videoGrid.innerHTML = memberVideos.map((video) => `
    <article class="video-card">
      <div class="video-frame"><iframe src="${escapeHtml(video.embedUrl)}" title="${escapeHtml(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      <div class="video-copy"><span class="video-tag">${escapeHtml(video.category || "MEMBER VIDEO")}</span><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.description || "")}</p></div>
    </article>`).join("");
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

  if (isAdminEmail(user.email)) {
    accessPanel.hidden = true;
    library.hidden = false;
    memberTitle.textContent = "管理員預覽｜養生會員影片";
    memberMeta.textContent = user.email || "管理員帳號";
    renderVideos();
    return;
  }

  try {
    const email = (user.email || "").trim().toLowerCase();
    const snapshot = await getDoc(doc(db, "memberAccess", email));
    const member = snapshot.exists() ? snapshot.data() : null;
    if (!member || !isActiveWellnessMember(member)) {
      const expired = member?.expiresAt ? `目前紀錄的會籍到期日為 ${formatDate(member.expiresAt)}。` : "系統目前查無有效的養生會員資格。";
      showAccessState(
        "目前沒有有效的影片權限",
        `${expired} 如需確認續會或會員資料，請聯繫靈元院行政團隊。`,
        '<a class="access-link" href="/membership.html">查看續會方式</a><a class="access-button" href="https://t.me/lyyuan" target="_blank" rel="noopener">聯繫行政團隊</a>'
      );
      return;
    }
    accessPanel.hidden = true;
    library.hidden = false;
    memberTitle.textContent = `${member.name || user.displayName || "會員"}｜${membershipLevel(member)}`;
    memberMeta.innerHTML = `有效會籍至<br>${escapeHtml(formatDate(member.expiresAt))}`;
    renderVideos();
  } catch (error) {
    console.error("養生會員影片權限確認失敗：", error);
    showAccessState("暫時無法確認會員資格", "系統目前無法完成權限核對，請稍後重新整理頁面再試。");
  }
});
