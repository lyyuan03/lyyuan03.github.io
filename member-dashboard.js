import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { LINGJI_THRESHOLD, evaluateMember } from "./member-dashboard-logic.js";

const accessPanel = document.getElementById("dashboard-access-panel");
const dashboard = document.getElementById("member-dashboard");
const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });

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
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(date) : "未設定";
}

function formatDateKey(value) {
  if (!value) return "未設定";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function isActiveWellnessMember(member = {}) {
  const isWellness = member.wellnessAccess === true || member.memberType === "wellness-channel" || ["wellness", "lingji"].includes(member.memberLevel);
  const expiry = toDate(member.expiresAt);
  return isWellness && member.status === "active" && Boolean(expiry && expiry > new Date());
}

function hasMemberCenterAccess(member = {}) {
  if (!member) return false;
  const expiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!expiry || expiry > new Date());
  return Boolean(activeQualification || Number(member.cashbackBalance) > 0 || (Array.isArray(member.purchasedCourses) && member.purchasedCourses.length));
}

function safeCourseUrl(value = "") {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderCourses(courses = []) {
  const list = document.getElementById("dashboard-course-list");
  const validCourses = Array.isArray(courses) ? courses.filter((course) => course?.title) : [];
  document.getElementById("dashboard-course-count").textContent = `${validCourses.length} 門課程`;
  if (!validCourses.length) {
    list.innerHTML = '<div class="empty-benefit">目前沒有已購買的線上課程</div>';
    return;
  }
  list.innerHTML = validCourses.map((course) => {
    const startsAt = course.startsAt ? formatDateKey(course.startsAt) : "未設定";
    const expiresAt = course.expiresAt === "永久" ? "永久觀看" : course.expiresAt ? formatDateKey(course.expiresAt) : "未設定";
    const courseUrl = safeCourseUrl(course.url);
    const action = courseUrl ? `<a class="course-link" href="${escapeHtml(courseUrl)}" target="_blank" rel="noopener">前往課程</a>` : "";
    return `<article class="course-item"><div><h3>${escapeHtml(course.title)}</h3><div class="course-meta">觀看期間：${escapeHtml(startsAt)}－${escapeHtml(expiresAt)}</div></div>${action}</article>`;
  }).join("");
}

function showAccessState(title, message, actions = "") {
  dashboard.hidden = true;
  accessPanel.hidden = false;
  accessPanel.innerHTML = `<span class="eyebrow">MEMBER ACCESS</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actions ? `<div class="access-actions">${actions}</div>` : ""}`;
}

function openMemberLogin() {
  document.getElementById("member-login-button")?.click();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-dashboard-login]")) openMemberLogin();
});

function renderDashboard(member, user) {
  const state = evaluateMember(member);
  const isLingji = state.effectiveLevel === "lingji";
  const name = member.name || user.displayName || "會員";
  const expiry = formatDate(member.expiresAt);
  const startsAt = formatDate(member.startsAt || member.firstJoinedAt);
  const membershipNumber = member.memberNumber || member.id || (user.email || "").split("@")[0];
  const wellnessActive = isActiveWellnessMember(member);
  const qualificationExpiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!qualificationExpiry || qualificationExpiry > new Date());
  const articleActive = activeQualification && (member.articleAccess === true || member.memberType === "sponsor-member" || isLingji);

  dashboard.dataset.memberLevel = state.effectiveLevel;
  document.getElementById("dashboard-greeting").textContent = `${name}，平安`;
  document.getElementById("dashboard-member-meta").textContent = `會員編號 ${membershipNumber}｜靈元院會員帳號`;
  document.getElementById("dashboard-card-number").textContent = String(membershipNumber).toUpperCase();
  document.getElementById("dashboard-level").textContent = isLingji ? "靈極會員" : "一般會員";
  document.getElementById("dashboard-level-en").textContent = isLingji ? "LINGJI PRIVILEGE" : "GENERAL MEMBER";
  document.getElementById("dashboard-spend").textContent = money.format(state.currentSpend);
  document.getElementById("dashboard-spend-note").textContent = state.nextQualified ? "已達次年度門檻" : `距次年度門檻尚差 ${money.format(state.remaining)}`;
  document.getElementById("dashboard-membership-status").textContent = "有效";
  document.getElementById("dashboard-membership-date").textContent = `${startsAt}－${expiry}`;
  document.getElementById("dashboard-period-membership").textContent = `${startsAt}－${expiry}`;
  document.getElementById("dashboard-cashback").textContent = money.format(Math.max(0, Number(member.cashbackBalance) || 0));
  document.getElementById("dashboard-wellness-access").textContent = wellnessActive ? `有效｜至 ${expiry}` : "尚未開通或已到期";
  document.getElementById("dashboard-article-access").textContent = articleActive ? `閱讀資格有效｜至 ${expiry}` : "尚未開通";
  ["dashboard-spend", "dashboard-membership-status", "dashboard-tier-status", "dashboard-period-heading", "dashboard-progress", "dashboard-rights-summary"].forEach((id) => {
    const section = document.getElementById(id)?.closest("section");
    if (section) section.hidden = !wellnessActive;
  });
  const upgradeSection = [...document.querySelectorAll(".upgrade-section")][0];
  if (upgradeSection) upgradeSection.hidden = !wellnessActive;
  renderCourses(member.purchasedCourses);

  const tierLabel = document.getElementById("dashboard-tier-label");
  const tierStatus = document.getElementById("dashboard-tier-status");
  const tierDate = document.getElementById("dashboard-tier-date");
  const lingjiPeriodRow = document.getElementById("dashboard-lingji-period-row");
  const lingjiRights = document.getElementById("dashboard-lingji-rights");
  const periodHeading = document.getElementById("dashboard-period-heading");
  const periodSide = document.getElementById("dashboard-period-side");
  if (isLingji) {
    tierLabel.textContent = "本期靈極會員資格";
    tierStatus.textContent = "有效";
    tierDate.textContent = `${formatDateKey(state.lingjiStartsAt)}－${formatDateKey(state.lingjiExpiresAt)}`;
    document.getElementById("dashboard-period-lingji").textContent = tierDate.textContent;
    lingjiPeriodRow.hidden = false;
    lingjiRights.hidden = false;
    periodHeading.textContent = "會籍與靈極資格效期";
    periodSide.textContent = "兩種效期分開計算";
    document.getElementById("dashboard-rights-summary").textContent = "一般會員權益＋靈極會員加贈權益";
    document.getElementById("dashboard-period-note").textContent = "目前靈極會員身分，是依前一年度消費達標取得；進入新年度後，本年度累積金額由零重新計算，用來判定下一年度是否續享靈極資格。年度資格有效期間內，仍須每四個月完成續會並維持有效會籍。";
  } else {
    tierLabel.textContent = "次年度靈極資格";
    tierStatus.textContent = state.nextQualified ? "符合資格" : "尚未達成";
    tierDate.textContent = state.nextQualified ? `${formatDateKey(state.cycle.nextStart)} 起生效` : `門檻 ${money.format(LINGJI_THRESHOLD)}`;
    lingjiPeriodRow.hidden = true;
    lingjiRights.hidden = true;
    periodHeading.textContent = "會籍效期";
    periodSide.textContent = "一般會員每 4 個月續會";
    document.getElementById("dashboard-rights-summary").textContent = "目前為一般會員權益";
    document.getElementById("dashboard-period-note").textContent = state.nextQualified
      ? `您已符合次年度靈極會員資格；於 ${formatDateKey(state.cycle.nextStart)} 登入後，系統將自動顯示靈極會員頁面與完整權益。`
      : "本年度累積消費達新台幣 100,000 元後，系統會先標示為「符合次年度靈極會員資格」，並於次年 2 月 1 日起自動切換會員身分。";
  }

  const roundedProgress = Math.round(state.progress * 10) / 10;
  const gaugeAngle = -90 + roundedProgress * 1.8;
  document.getElementById("dashboard-gauge-progress").style.strokeDasharray = `${roundedProgress} 100`;
  document.getElementById("dashboard-gauge-needle").style.transform = `rotate(${gaugeAngle}deg)`;
  document.getElementById("dashboard-gauge").setAttribute("aria-label", `本年度已累積 ${money.format(state.currentSpend)}，達成次年度門檻的 ${roundedProgress}%`);
  document.getElementById("dashboard-ring").style.setProperty("--progress", String(roundedProgress));
  document.getElementById("dashboard-progress").textContent = `${roundedProgress}%`;
  document.getElementById("dashboard-progress-title").textContent = `本年度已累積 ${money.format(state.currentSpend)}`;
  document.getElementById("dashboard-progress-detail").textContent = state.nextQualified
    ? `已達次年度門檻 ${money.format(LINGJI_THRESHOLD)}。`
    : `次年度門檻 ${money.format(LINGJI_THRESHOLD)}，尚差 ${money.format(state.remaining)}。`;
  document.getElementById("dashboard-progress-status").textContent = state.nextQualified
    ? `符合次年度靈極會員資格，將於 ${formatDateKey(state.cycle.nextStart)} 生效。`
    : `本年度計算期間：${formatDateKey(state.cycle.start)}－${formatDateKey(state.cycle.end)}`;

  accessPanel.hidden = true;
  dashboard.hidden = false;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAccessState("請先登入會員帳號", "請以登記會員資格、文章權限或線上課程的 Google 帳號登入。", '<button class="access-button" type="button" data-dashboard-login>會員登入</button><a class="access-link" href="/membership.html">查看會員制度</a>');
    return;
  }
  if (isAdminEmail(user.email)) {
    showAccessState("請改用會員帳號", "此頁依養生會員資料顯示個人會籍；管理員帳號不會載入會員資料。", '<a class="access-link" href="/admin.html">返回管理後台</a>');
    return;
  }
  try {
    const email = (user.email || "").trim().toLowerCase();
    const snapshot = await getDoc(doc(db, "memberAccess", email));
    const member = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    if (!member || !hasMemberCenterAccess(member)) {
      const expired = member?.expiresAt ? `目前紀錄的資格到期日為 ${formatDate(member.expiresAt)}。` : "系統目前查無可顯示的會員資格、文章權限或已購課程。";
      showAccessState("目前沒有有效的會員資料", `${expired} 如需確認資料，請聯繫靈元院行政團隊。`, '<a class="access-link" href="/membership.html">查看會員制度</a>');
      return;
    }
    renderDashboard(member, user);
  } catch (error) {
    console.error("會員中心資料載入失敗：", error);
    showAccessState("暫時無法載入會員資料", "系統目前無法完成資料核對，請稍後重新整理頁面再試。", "");
  }
});
