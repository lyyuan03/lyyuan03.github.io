import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { evaluateOfferForRoles, loadOfferMemberProfile } from "./member-offers-core.js?v=20260812-2";

const MENU_LINK_ID = "member-offers-menu-link";
let currentUser = null;
let refreshToken = 0;

function installStyles() {
  if (document.getElementById("member-offers-menu-styles")) return;
  const style = document.createElement("style");
  style.id = "member-offers-menu-styles";
  style.textContent = `
    #${MENU_LINK_ID}{display:flex!important;align-items:center;justify-content:space-between;gap:12px}
    #${MENU_LINK_ID}[hidden]{display:none!important}
    #${MENU_LINK_ID} .member-offers-menu-label{min-width:0}
    .member-offers-new-badge{flex:0 0 auto;color:#ff5757;font-size:10px;font-weight:700;line-height:1;letter-spacing:.12em;text-shadow:0 0 8px rgba(255,87,87,.28);animation:memberOffersNewPulse 1.15s ease-in-out infinite}
    .member-offers-new-badge[hidden]{display:none!important}
    @keyframes memberOffersNewPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.32;transform:scale(.94)}}
    @media(prefers-reduced-motion:reduce){.member-offers-new-badge{animation:none}}
  `;
  document.head.appendChild(style);
}

function findMenu() {
  return document.getElementById("site-account-menu");
}

function installMenuLink() {
  const menu = findMenu();
  if (!menu) return null;
  const existing = document.getElementById(MENU_LINK_ID);
  if (existing) return existing;

  const link = document.createElement("a");
  link.id = MENU_LINK_ID;
  link.href = "/member-offers.html";
  link.hidden = true;
  link.innerHTML = '<span class="member-offers-menu-label">會員專屬優惠</span><span class="member-offers-new-badge" hidden>NEW</span>';

  const dashboardLink = [...menu.querySelectorAll("a")].find((item) => item.getAttribute("href") === "/member-dashboard.html");
  const wellnessLink = menu.querySelector("[data-wellness-video-link]");
  if (dashboardLink) dashboardLink.insertAdjacentElement("afterend", link);
  else if (wellnessLink) menu.insertBefore(link, wellnessLink);
  else menu.insertBefore(link, menu.querySelector("[data-member-sign-out]") || null);
  return link;
}

function waitForMenuLink() {
  const immediate = installMenuLink();
  if (immediate) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const link = installMenuLink();
      if (!link) return;
      observer.disconnect();
      resolve(link);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(installMenuLink());
    }, 5000);
  });
}

async function loadPublishedOffers() {
  const snapshot = await getDocs(query(collection(db, "articles"), where("status", "==", "published")));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((offer) => offer.systemRecord === true && offer.systemType === "memberOffer");
}

async function refreshMenuForUser(user) {
  const token = ++refreshToken;
  const link = await waitForMenuLink();
  if (!link || token !== refreshToken) return;
  const badge = link.querySelector(".member-offers-new-badge");

  link.hidden = true;
  if (badge) badge.hidden = true;
  if (!user || isAdminEmail(user.email)) return;

  try {
    const profile = await loadOfferMemberProfile(db, user);
    if (token !== refreshToken || auth.currentUser?.uid !== user.uid) return;
    if (!profile.active) return;

    link.hidden = false;
    const offers = await loadPublishedOffers();
    if (token !== refreshToken || auth.currentUser?.uid !== user.uid) return;

    const now = new Date();
    const hasVisibleCurrentOffer = offers.some((offer) => {
      const state = evaluateOfferForRoles(offer, profile.roles, now);
      return !state.ended && !state.hidden;
    });
    if (badge) badge.hidden = !hasVisibleCurrentOffer;
  } catch (error) {
    console.warn("會員專屬優惠選單狀態暫時無法確認：", error);
    if (auth.currentUser?.uid === user.uid) link.hidden = false;
  }
}

installStyles();
waitForMenuLink();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  refreshMenuForUser(user);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) refreshMenuForUser(currentUser);
});
