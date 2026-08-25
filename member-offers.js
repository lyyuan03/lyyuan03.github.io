import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import { collection, getDocs, query, where } from "./firebase-config.js";
import {
  escapeHtml,
  evaluateOfferForRoles,
  formatTaipeiDateTime,
  loadOfferMemberProfile,
  roleLabels,
  safeWebUrl
} from "./member-offers-core.js?v=20260812-2";

const gate = document.getElementById("offer-access");
const appRoot = document.getElementById("offer-app");
const identity = document.getElementById("offer-member-identity");
const currentList = document.getElementById("offer-current-list");
const upcomingList = document.getElementById("offer-upcoming-list");
const historyList = document.getElementById("offer-history-list");
const currentSection = document.getElementById("offer-current-section");
const upcomingSection = document.getElementById("offer-upcoming-section");
const historySection = document.getElementById("offer-history-section");

function showGate(title, message, actions = "") {
  appRoot.hidden = true;
  gate.hidden = false;
  gate.innerHTML = `<span class="eyebrow">MEMBER EXCLUSIVE</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actions ? `<div class="access-actions">${actions}</div>` : ""}`;
}

async function loadPublishedOffers() {
  const snapshot = await getDocs(query(collection(db, "articles"), where("status", "==", "published")));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((offer) => offer.systemRecord === true && offer.systemType === "memberOffer");
}

function phaseSchedule(phases) {
  if (!phases.length) return "";
  return `<div class="offer-phases">${phases.map((phase, index) => {
    const allowed = roleLabels(phase.allowedTypes).join("、") || "未設定";
    return `<div class="offer-phase"><span class="phase-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(phase.name || `第 ${index + 1} 階段`)}</strong><small>${escapeHtml(formatTaipeiDateTime(phase.startsAtDate))} 起｜${escapeHtml(allowed)}</small></div></div>`;
  }).join("")}</div>`;
}

function currentAction(state) {
  if (!state.currentEligible || !state.currentPhase) return null;
  const url = safeWebUrl(state.currentPhase.actionUrl);
  return url ? { url, label: String(state.currentPhase.actionLabel || "立即參加") } : null;
}

function renderOfferCard(item) {
  const { offer, state, action } = item;
  const image = safeWebUrl(offer.imageUrl);
  const tag = state.ended ? "已結束" : state.currentEligible ? "目前開放" : state.bucket === "upcoming" ? "即將開放" : "會員限定";
  const quota = offer.limited && Number(offer.quota) > 0 ? `<span>限量 ${Number(offer.quota).toLocaleString("zh-TW")} 名／份</span>` : "";
  const period = state.endsAt ? `<span>截止 ${escapeHtml(formatTaipeiDateTime(state.endsAt))}</span>` : "";
  const actionHtml = state.ended
    ? '<span class="offer-button is-disabled">活動已結束</span>'
    : action
      ? `<a class="offer-button" href="${escapeHtml(action.url)}" target="_blank" rel="noopener">${escapeHtml(action.label)}</a>`
      : `<span class="offer-button is-disabled">${escapeHtml(state.currentEligible ? "訂購／報名連結尚未設定" : state.message)}</span>`;

  return `<article class="offer-card ${state.currentEligible ? "is-open" : ""}">
    ${image ? `<div class="offer-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(offer.title || "會員專屬優惠")}" loading="lazy"></div>` : ""}
    <div class="offer-copy">
      <div class="offer-kicker"><span>${escapeHtml(tag)}</span>${quota}${period}</div>
      <h3>${escapeHtml(offer.title || "會員專屬優惠")}</h3>
      ${offer.summary ? `<p class="offer-summary">${escapeHtml(offer.summary)}</p>` : ""}
      ${offer.description ? `<p class="offer-description">${escapeHtml(offer.description).replace(/\n/g, "<br>")}</p>` : ""}
      <div class="offer-status ${state.currentEligible ? "is-eligible" : ""}">${escapeHtml(state.message)}</div>
      ${phaseSchedule(state.phases)}
      <div class="offer-actions">${actionHtml}</div>
    </div>
  </article>`;
}

function renderBucket(section, list, items) {
  if (!items.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }
  section.hidden = false;
  list.innerHTML = items.map(renderOfferCard).join("");
}

function renderOffers(roles, offers) {
  const now = new Date();
  const visible = (Array.isArray(offers) ? offers : []).map((offer) => {
    const state = evaluateOfferForRoles(offer, roles, now);
    return { offer, state, action: currentAction(state) };
  }).filter((item) => !item.state.hidden);

  visible.sort((a, b) => {
    const aTime = (a.state.startsAt || a.state.endsAt || new Date(0)).getTime();
    const bTime = (b.state.startsAt || b.state.endsAt || new Date(0)).getTime();
    if (a.state.bucket === "history" && b.state.bucket === "history") return bTime - aTime;
    return aTime - bTime;
  });

  renderBucket(currentSection, currentList, visible.filter((item) => item.state.bucket === "current"));
  renderBucket(upcomingSection, upcomingList, visible.filter((item) => item.state.bucket === "upcoming"));
  renderBucket(historySection, historyList, visible.filter((item) => item.state.bucket === "history"));

  if (!visible.length) {
    currentSection.hidden = false;
    currentList.innerHTML = '<div class="offer-empty">目前沒有可顯示的會員專屬優惠；新活動會在這裡公布。</div>';
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-offer-login]")) document.getElementById("member-login-button")?.click();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showGate("請先登入會員帳號", "會員專屬優惠只開放有效的養生療癒頻道會員與贊助專屬文章付費會員查看。", '<button class="access-button" type="button" data-offer-login>會員登入</button><a class="access-link" href="/membership.html">查看會員制度</a>');
    return;
  }
  if (isAdminEmail(user.email)) {
    showGate("目前使用管理員帳號", "管理員請由管理後台設定會員優惠；若要測試會員畫面，請改用實際會員帳號登入。", '<a class="access-link" href="/admin.html#member-offer-management">前往優惠後台</a>');
    return;
  }

  try {
    const profile = await loadOfferMemberProfile(db, user);
    if (!profile.active) {
      showGate("目前沒有有效優惠資格", "此帳號目前不是有效的養生療癒頻道會員或贊助專屬文章付費會員。", '<a class="access-link" href="/member-dashboard.html">返回會員中心</a>');
      return;
    }
    const offers = await loadPublishedOffers();
    identity.textContent = `目前資格｜${roleLabels(profile.roles).join("＋")}`;
    gate.hidden = true;
    appRoot.hidden = false;
    renderOffers(profile.roles, offers);
  } catch (error) {
    console.error("會員優惠載入失敗：", error);
    showGate("暫時無法載入會員優惠", "系統目前無法完成會員資料或活動資料核對，請稍後重新整理頁面。", '<a class="access-link" href="/member-dashboard.html">返回會員中心</a>');
  }
});
