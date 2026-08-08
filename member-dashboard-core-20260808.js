import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { LINGJI_THRESHOLD, evaluateMember } from "./member-dashboard-logic.js?v=20260805-taipei-cycle-1";

const accessPanel = document.getElementById("dashboard-access-panel");
const dashboard = document.getElementById("member-dashboard");
const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });

const treeBackgroundStyle = document.createElement("style");
treeBackgroundStyle.id = "member-dashboard-tree-background";
treeBackgroundStyle.textContent = `
.lyy-sacred-atmosphere,
body.member-tier-general .lyy-sacred-atmosphere {
  background:
    radial-gradient(circle at 50% 4%,rgba(216,184,120,.24),transparent 37%),
    radial-gradient(circle at 13% 55%,rgba(96,99,48,.11),transparent 36%),
    linear-gradient(145deg,rgba(245,239,228,.78) 0%,rgba(231,223,209,.82) 100%),
    url('/forest-path.jpg') center center / cover no-repeat fixed !important;
}
body.member-tier-lingji .lyy-sacred-atmosphere {
  background:
    radial-gradient(circle at 50% 4%,rgba(229,196,126,.3),transparent 31%),
    radial-gradient(circle at 18% 65%,rgba(78,104,57,.24),transparent 34%),
    radial-gradient(circle at 86% 42%,rgba(165,130,84,.15),transparent 33%),
    linear-gradient(155deg,rgba(11,18,13,.84) 0%,rgba(23,36,26,.8) 48%,rgba(12,20,14,.86) 100%),
    url('/forest-path.jpg') center center / cover no-repeat fixed !important;
}
body.member-tier-sponsor .lyy-sacred-atmosphere {
  background:
    radial-gradient(circle at 50% 8%,rgba(198,166,126,.2),transparent 35%),
    radial-gradient(circle at 15% 65%,rgba(118,86,106,.13),transparent 33%),
    linear-gradient(145deg,rgba(242,234,229,.78),rgba(231,222,220,.82)),
    url('/forest-path.jpg') center center / cover no-repeat fixed !important;
}
`;
document.head.appendChild(treeBackgroundStyle);

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

function isWellnessMemberRecord(member = {}) {
  return member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt;
}

function isActiveWellnessMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return isWellnessMemberRecord(member)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && Boolean(expiry && expiry > new Date());
}

function isActiveSponsorMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim())
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && Boolean(expiry && expiry > new Date());
}

function activeWellnessArticleBenefit(sponsorMember = {}, member = {}) {
  const benefit = sponsorMember?.wellnessBenefit;
  if (!benefit || benefit.active !== true || benefit.articleAccess !== true || benefit.status !== "active") return null;
  if (benefit.accessScope !== "sponsor-paid-articles" || Number(benefit.accessVersion || 0) < 1) return null;
  if (!isActiveWellnessMember(member) || benefit.linkedMemberLevel !== member.memberLevel) return null;
  const memberExpiry = toDate(member.expiresAt);
  const benefitExpiry = toDate(benefit.expiresAt);
  if (!memberExpiry || !benefitExpiry || benefitExpiry <= new Date()) return null;
  if (benefitExpiry.getTime() > memberExpiry.getTime() + 60000) return null;
  if (benefit.source === "lingji-member" && member.memberLevel === "lingji") return benefit;
  if (benefit.source === "single-purchase-15000"
      && Number(benefit.qualifyingPurchaseAmount || 0) >= 15000
      && benefit.confirmedBy
      && benefit.confirmedAt) return benefit;
  return null;
}

function isPendingSponsorReservation(member = {}) {
  const deadline = toDate(member.pendingPaymentDeadline);
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "pending"
    && member.status === "pending"
    && Boolean(String(member.pendingOrderNo || "").trim())
    && [1, 3].includes(Number(member.pendingPlanMonths || member.planMonths))
    && Number(member.pendingAmount || member.amount || 0) > 0
    && Boolean(deadline && deadline > new Date());
}

function showPendingSponsorReservation(member) {
  const months = Number(member.pendingPlanMonths || member.planMonths || 0);
  const amount = money.format(Number(member.pendingAmount || member.amount || 0));
  const tier = (member.pendingPriceTier || member.priceTier) === "promo" ? "前200名優惠" : "一般價格";
  const deadline = formatDate(member.pendingPaymentDeadline);
  const paymentUrl = String(member.pendingPaymentUrl || "");
  const action = paymentUrl.startsWith("https://")
    ? `<a class="access-link" href="${escapeHtml(paymentUrl)}">返回綠界付款頁面</a>`
    : '<a class="access-link" href="/articles.html">返回贊助文章</a>';
  showAccessState(
    "付款資料待核對",
    `您已選擇${months}個月贊助閱讀方案，金額為${amount}，本次適用${tier}。名額保留至${deadline}。完成付款後，行政團隊將於核對款項後開通閱讀資格。`,
    action
  );
}

function hasMemberCenterAccess(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(isActiveWellnessMember(member) || Number(member.cashbackBalance) > 0 || hasCourses);
}

function wellnessHistorySchema(record = {}) {
  return record.memberType === "wellness-channel"
    && record.wellnessAccess === true
    && ["wellness", "lingji"].includes(record.memberLevel)
    && record.paymentStatus === "paid"
    && Boolean(toDate(record.startsAt || record.firstJoinedAt))
    && Boolean(toDate(record.expiresAt));
}

function sponsorHistorySchema(record = {}) {
  return record.memberType === "sponsor-member"
    && record.paymentStatus === "paid"
    && record.articleAccess === true
    && record.accessScope === "sponsor-paid-articles"
    && Number(record.accessVersion || 0) >= 2
    && Boolean(String(record.lastOrderNo || "").trim())
    && Boolean(toDate(record.startsAt || record.firstJoinedAt))
    && Boolean(toDate(record.expiresAt));
}

function formerPeriodEnded(record = {}, explicitHistory = false) {
  const end = toDate(record.endedAt || record.expiresAt);
  if (!end) return false;
  if (explicitHistory && record.verified !== true) return false;
  return record.historicalStatus === "ended" || end <= new Date();
}

function formerMembershipLabel(record = {}) {
  if (record.memberType === "sponsor-member") return "贊助專屬文章會員";
  return record.memberLevel === "lingji"
    ? "養生療癒頻道｜靈極會員"
    : "養生療癒頻道｜一般會員";
}

function findFormerMembership(member, sponsorMember, history = {}) {
  const candidates = [];
  const add = (record, kind, explicitHistory = false) => {
    if (!record) return;
    const validSchema = kind === "sponsor"
      ? sponsorHistorySchema(record)
      : wellnessHistorySchema(record);
    if (!validSchema || !formerPeriodEnded(record, explicitHistory)) return;
    const endedAt = toDate(record.endedAt || record.expiresAt);
    candidates.push({ record, endedAt });
  };

  add(history.wellness, "wellness", true);
  add(history.sponsor, "sponsor", true);
  add(member, "wellness", false);
  add(sponsorMember, "sponsor", false);
  candidates.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
  return candidates[0]?.record || null;
}

function showFormerMembership(record) {
  const start = formatDate(record.startsAt || record.firstJoinedAt);
  const end = formatDate(record.endedAt || record.expiresAt);
  const label = formerMembershipLabel(record);
  showAccessState(
    "前期會員資格已結束",
    `此帳號曾登記為「${label}」。前期資格期間：${start}至${end}。目前尚無有效會員資格。`,
    '<a class="access-link" href="/membership.html">查看會員制度</a>'
  );
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

function renderDashboard(member, user, sponsorMember = null) {
  const state = evaluateMember(member);
  const isLingji = state.effectiveLevel === "lingji";
  const name = member.name || user.displayName || "會員";
  const expiry = formatDate(member.expiresAt);
  const startsAt = formatDate(member.startsAt || member.firstJoinedAt);
  const membershipNumber = member.memberNumber || member.id || (user.email || "").split("@")[0];
  const wellnessActive = isActiveWellnessMember(member);
  const sponsorRecord = sponsorMember || (member.memberType === "sponsor-member" ? member : null);
  const sponsorActive = Boolean(sponsorRecord && isActiveSponsorMember(sponsorRecord));
  const wellnessArticleBenefit = activeWellnessArticleBenefit(sponsorRecord, member);
  const sponsorOnly = sponsorActive && !wellnessActive;
  const articleActive = sponsorActive || Boolean(wellnessArticleBenefit);
  const articleExpiry = sponsorActive
    ? formatDate(sponsorRecord.expiresAt)
    : wellnessArticleBenefit
      ? formatDate(wellnessArticleBenefit.expiresAt)
      : "未設定";
  const articleSource = sponsorActive
    ? "贊助閱讀方案"
    : wellnessArticleBenefit?.source === "lingji-member"
      ? "靈極會員加贈"
      : wellnessArticleBenefit
        ? "一般會員單筆滿額加贈"
        : "";

  dashboard.dataset.memberLevel = state.effectiveLevel;
  dashboard.dataset.memberKind = sponsorOnly ? "sponsor" : "wellness";
  document.getElementById("dashboard-greeting").textContent = `${name}，吉祥平安 🙏`;
  document.querySelector(".identity .eyebrow").textContent = sponsorOnly ? "SPONSORED ARTICLE MEMBERSHIP" : "WELLNESS CHANNEL MEMBERSHIP";
  document.getElementById("dashboard-member-meta").textContent = sponsorOnly
    ? `會員編號 ${membershipNumber}｜贊助專屬文章會員`
    : `會員編號 ${membershipNumber}｜養生療癒頻道會員`;
  document.getElementById("dashboard-card-number").textContent = String(membershipNumber).toUpperCase();
  document.getElementById("dashboard-level").textContent = sponsorOnly ? "贊助文章會員" : isLingji ? "養生療癒頻道｜靈極會員" : "養生療癒頻道｜一般會員";
  document.getElementById("dashboard-level-en").textContent = sponsorOnly ? "SPONSORED READING" : isLingji ? "WELLNESS · LINGJI" : "WELLNESS · GENERAL";
  document.querySelector(".tier-card-bottom span:last-child").textContent = sponsorOnly ? "ARTICLE" : "WELLNESS";
  const generalSymbol = document.querySelector(".tier-card-symbol.general");
  if (generalSymbol) {
    generalSymbol.innerHTML = sponsorOnly
      ? '<rect x="10" y="9" width="28" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 17h16M16 23h16M16 29h11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
      : '<circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M24 34V20M24 26c-7 0-11-4-11-10 7 0 11 4 11 10Zm0-2c7 0 11-4 11-10-7 0-11 4-11 10Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  document.getElementById("dashboard-spend").textContent = money.format(state.currentSpend);
  document.getElementById("dashboard-spend-note").textContent = state.nextQualified ? "已達次年度門檻" : `距次年度門檻尚差 ${money.format(state.remaining)}`;
  document.getElementById("dashboard-membership-status").textContent = "有效";
  document.getElementById("dashboard-membership-date").textContent = `${startsAt}－${expiry}`;
  document.getElementById("dashboard-period-membership").textContent = `${startsAt}－${expiry}`;
  document.getElementById("dashboard-cashback").textContent = money.format(Math.max(0, Number(member.cashbackBalance) || 0));
  document.getElementById("dashboard-wellness-access").textContent = wellnessActive ? `有效｜至 ${expiry}` : "尚未開通或已到期";
  document.getElementById("dashboard-article-access").textContent = articleActive ? `${articleSource}｜至 ${articleExpiry}` : "尚未開通";
  ["dashboard-spend", "dashboard-membership-status", "dashboard-tier-status", "dashboard-period-heading", "dashboard-progress", "dashboard-rights-summary", "dashboard-cashback"].forEach((id) => {
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
    const [snapshot, sponsorSnapshot, historySnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email)),
      getDoc(doc(db, "membershipHistory", email))
    ]);
    const member = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    const sponsorMember = sponsorSnapshot.exists() ? { id: sponsorSnapshot.id, ...sponsorSnapshot.data() } : null;
    const history = historySnapshot.exists() ? historySnapshot.data() : {};
    const sponsorActive = Boolean(sponsorMember && isActiveSponsorMember(sponsorMember));
    const primaryMember = member && hasMemberCenterAccess(member)
      ? member
      : sponsorActive
        ? sponsorMember
        : null;
    if (!primaryMember) {
      if (sponsorMember && isPendingSponsorReservation(sponsorMember)) {
        showPendingSponsorReservation(sponsorMember);
        return;
      }
      const former = findFormerMembership(member, sponsorMember, history);
      if (former) {
        showFormerMembership(former);
      } else {
        showAccessState(
          "此帳號目前沒有會員資料",
          "您登入的 Google 帳號尚未登記任何靈元院會員資格。如曾使用其他 Email 登記，請登出後改用原登記帳號登入。",
          '<a class="access-link" href="/membership.html">查看會員制度</a>'
        );
      }
      return;
    }
    renderDashboard(primaryMember, user, sponsorMember);
  } catch (error) {
    console.error("會員中心資料載入失敗：", error);
    showAccessState("暫時無法載入會員資料", "系統目前無法完成資料核對，請稍後重新整理頁面再試。", "");
  }
});
