import { auth, provider, db, isAdminEmail } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const AUTH_VERSION = "20260803-sponsor-offer-2";
const SPONSOR_OFFER_STATUS_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/sponsorOfferStatus";

function installStyles() {
  if (document.getElementById("site-auth-nav-styles")) return;
  const style = document.createElement("style");
  style.id = "site-auth-nav-styles";
  style.textContent = `
    :root{--site-auth-height:48px}
    body.site-auth-enabled{padding-top:var(--site-auth-height)!important}
    #site-auth-bar{position:fixed;top:56px;left:0;right:0;z-index:98;height:var(--site-auth-height);display:flex;align-items:center;justify-content:flex-end;padding:0 24px;background:rgba(7,11,6,.97);border-bottom:1px solid rgba(165,130,84,.22);font-family:'Noto Sans TC','Arial',sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.08)}
    .site-auth-actions{position:relative;display:flex;align-items:center;gap:9px}
    .site-auth-button{height:34px;padding:6px 14px;border:1px solid rgba(165,130,84,.48);background:rgba(165,130,84,.07);color:#C5A26F;font:inherit;font-size:12px;letter-spacing:.1em;cursor:pointer;white-space:nowrap;transition:background .2s,color .2s,border-color .2s,transform .2s}
    .site-auth-button:hover{background:rgba(165,130,84,.17);border-color:rgba(197,162,111,.72);transform:translateY(-1px)}
    .site-auth-button:disabled{opacity:.55;cursor:wait;transform:none}
    .site-account-menu{position:absolute;top:calc(100% + 9px);right:0;z-index:1300;width:220px;padding:7px;background:rgba(12,18,10,.99);border:1px solid rgba(165,130,84,.34);box-shadow:0 16px 42px rgba(0,0,0,.46)}
    .site-account-menu[hidden]{display:none!important}
    .site-account-menu [hidden]{display:none!important}
    .site-account-menu:before{content:'';position:absolute;left:0;right:0;top:-10px;height:10px}
    .site-account-menu a,.site-account-menu button{display:block;width:100%;padding:11px 14px;border:0;background:transparent;color:rgba(245,240,232,.78);font-family:'Noto Sans TC','Arial',sans-serif;font-size:13px;line-height:1.5;letter-spacing:.08em;text-align:left;text-decoration:none;cursor:pointer}
    .site-account-menu a:hover,.site-account-menu button:hover{background:rgba(165,130,84,.12);color:#C5A26F}
    .site-account-menu button{margin-top:5px;padding-top:12px;border-top:1px solid rgba(165,130,84,.2);color:rgba(245,240,232,.58)}
    #member-login-modal{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(3,7,4,.72);backdrop-filter:blur(8px)}
    #member-login-modal.is-open{display:flex}
    .member-login-card{position:relative;width:min(430px,100%);padding:40px 38px 34px;text-align:center;background:linear-gradient(155deg,rgba(20,28,18,.98),rgba(8,13,7,.98));border:1px solid rgba(165,130,84,.42);box-shadow:0 24px 80px rgba(0,0,0,.62);color:#F5F0E8}
    .member-login-close{position:absolute;top:12px;right:14px;border:0;background:transparent;color:rgba(245,240,232,.55);font-size:25px;cursor:pointer;line-height:1}
    .member-login-mark{font-family:'Cormorant Garamond',serif;color:#A58254;font-size:12px;letter-spacing:.42em;margin-bottom:12px}
    .member-login-card h2{font-family:'Noto Serif TC','Georgia',serif;font-size:23px;font-weight:400;letter-spacing:.16em;margin:0 0 15px;color:#F5F0E8}
    .member-login-card p{font-size:14px;line-height:1.9;color:rgba(245,240,232,.7);margin:0 0 26px}
    .member-google-button{width:100%;border:1px solid rgba(165,130,84,.58);background:rgba(165,130,84,.12);color:#C5A26F;padding:13px 18px;font-family:'Noto Sans TC','Arial',sans-serif;font-size:14px;letter-spacing:.1em;cursor:pointer}
    .member-google-button:hover{background:rgba(165,130,84,.2)}
    .member-login-note{margin-top:17px!important;margin-bottom:0!important;font-size:12px!important;color:rgba(245,240,232,.42)!important}
    .member-login-browser-note{display:none;margin:14px 0 0!important;padding:11px 12px;border:1px solid rgba(197,162,111,.28);background:rgba(165,130,84,.08);color:#d8bd91!important;font-size:12px!important;line-height:1.75!important}
    .member-login-offer{margin:-10px 0 20px;padding:13px 14px;border:1px solid rgba(165,130,84,.36);background:rgba(165,130,84,.08);font-family:'Noto Sans TC','Arial',sans-serif;text-align:left}
    .member-login-offer strong{display:block;margin-bottom:5px;color:#D8BD91;font-size:13px;letter-spacing:.08em}
    .member-login-offer span{display:block;color:rgba(245,240,232,.72);font-size:12px;line-height:1.7}
    .sponsor-offer-panel{margin:12px auto 13px;padding:12px 13px;border:1px solid rgba(125,94,55,.32);background:rgba(255,255,255,.18);color:#2E251C;font-family:'Noto Sans TC','Arial',sans-serif;text-align:left}
    .sponsor-offer-panel strong{display:block;margin-bottom:7px;color:#654825;font-size:13px;letter-spacing:.06em;text-align:center}
    .sponsor-offer-prices{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .sponsor-offer-price{padding:8px;border:1px solid rgba(89,79,71,.18);background:rgba(255,255,255,.24);text-align:center}
    .sponsor-offer-price span{display:block;font-size:10px;color:rgba(46,37,28,.66)}
    .sponsor-offer-price b{display:block;margin:2px 0;color:#4F361D;font-size:17px;font-weight:700}
    .sponsor-offer-price del{font-size:10px;color:rgba(46,37,28,.48)}
    .sponsor-offer-status{margin-top:8px;font-size:10px;line-height:1.6;color:rgba(46,37,28,.68);text-align:center}
    .sponsor-offer-progress{height:5px;margin-top:7px;border:1px solid rgba(89,79,71,.2);background:rgba(89,79,71,.08)}
    .sponsor-offer-progress span{display:block;height:100%;background:#A58254}
    .article-card[data-article-id="reading-you-can-not-fear-death"] .article-card-media{display:block;overflow:hidden;background:#EEE9DF!important}
    .article-card[data-article-id="reading-you-can-not-fear-death"] .article-card-media img{position:absolute!important;inset:0!important;width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;padding:0!important;margin:0!important;object-fit:cover!important;object-position:50% 47%!important;filter:none!important;transform:scale(2.18)!important;transform-origin:center!important}
    .article-card[data-article-id="reading-you-can-not-fear-death"]:hover .article-card-media img{transform:scale(2.23)!important}
    .article-card[data-article-id="reading-you-can-not-fear-death"] .article-list-title{text-align:center}
    @media(max-width:768px){
      :root{--site-auth-height:52px}
      #site-auth-bar{padding:0 12px;justify-content:center}
      .site-auth-actions{width:100%;max-width:220px;gap:8px}
      .site-auth-button{flex:1;min-width:0;padding:6px 8px;font-size:11.5px}
      .site-account-menu{left:0;right:0;width:100%}
      .member-login-card{padding:38px 24px 30px}
      .article-card[data-article-id="reading-you-can-not-fear-death"] .article-card-media img{object-position:center!important;transform:scale(1.04)!important}
      .article-card[data-article-id="reading-you-can-not-fear-death"]:hover .article-card-media img{transform:scale(1.04)!important}
    }
  `;
  document.head.appendChild(style);
}

function installBar() {
  const existing = document.getElementById("site-auth-bar");
  if (existing) return existing;
  const bar = document.createElement("div");
  bar.id = "site-auth-bar";
  bar.setAttribute("data-auth-version", AUTH_VERSION);
  bar.innerHTML = `
    <div class="site-auth-actions" aria-label="網站登入">
      <button id="member-login-button" class="site-auth-button" type="button" aria-haspopup="false" aria-expanded="false">會員登入</button>
      <div id="site-account-menu" class="site-account-menu" hidden>
        <a href="/member-dashboard.html">我的會員中心</a>
        <a href="/member-videos.html" data-wellness-video-link>養生會員影片</a>
        <button type="button" data-member-sign-out>登出</button>
      </div>
    </div>`;
  document.body.appendChild(bar);
  document.body.classList.add("site-auth-enabled");
  return bar;
}

function installMemberModal() {
  const existing = document.getElementById("member-login-modal");
  if (existing) return existing;
  const modal = document.createElement("div");
  modal.id = "member-login-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "member-login-title");
  modal.innerHTML = `
    <div class="member-login-card">
      <button class="member-login-close" type="button" aria-label="關閉">×</button>
      <div class="member-login-mark">LING · YUAN · YUAN</div>
      <h2 id="member-login-title">靈元院會員登入</h2>
      <p>請使用登記會員資格的 Google 帳號登入。登入後將回到目前頁面，並依帳號取得相應閱讀權限。</p>
      <div id="member-login-offer" class="member-login-offer" hidden></div>
      <button class="member-google-button" type="button">選擇會員 Google 帳號</button>
      <p class="member-login-browser-note">目前正在社群軟體的內建瀏覽器中開啟。若 Google 登入長時間沒有反應，請改用 Safari 或 Chrome 開啟本頁。</p>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove("is-open");
  modal.querySelector(".member-login-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  return modal;
}

installStyles();
const bar = installBar();
const modal = installMemberModal();
const memberButton = bar.querySelector("#member-login-button");
const accountMenu = bar.querySelector("#site-account-menu");
const signOutButton = accountMenu.querySelector("[data-member-sign-out]");
const wellnessVideoLink = accountMenu.querySelector("[data-wellness-video-link]");
const googleButton = modal.querySelector(".member-google-button");
const browserNote = modal.querySelector(".member-login-browser-note");
const loginOffer = modal.querySelector("#member-login-offer");
const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
const isMobile = window.matchMedia("(max-width:768px), (pointer:coarse)").matches;
let hasWellnessAccess = false;
let hasMemberAccess = false;
let sponsorOffer = null;
if (isInAppBrowser) browserNote.style.display = "block";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActiveWellnessMember(member = {}) {
  if (member.memberType === "sponsor-member") return false;
  const isWellness = member.wellnessAccess === true || member.memberType === "wellness-channel" || ["wellness", "lingji"].includes(member.memberLevel);
  const expiry = toDate(member.expiresAt);
  return isWellness && member.status === "active" && Boolean(expiry && expiry > new Date());
}

function isActiveMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!expiry || expiry > new Date());
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(activeQualification || Number(member.cashbackBalance) > 0 || hasCourses);
}

function closeAccountMenu() {
  accountMenu.hidden = true;
  memberButton.setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  const willOpen = accountMenu.hidden;
  accountMenu.hidden = !willOpen;
  memberButton.setAttribute("aria-expanded", String(willOpen));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function sponsorOfferSignature() {
  if (!sponsorOffer) return "";
  return [
    sponsorOffer.promotionAvailable,
    sponsorOffer.promoLimit,
    sponsorOffer.promoPrice1,
    sponsorOffer.promoPrice3,
    sponsorOffer.regularPrice1,
    sponsorOffer.regularPrice3,
    sponsorOffer.occupiedCount,
    sponsorOffer.remaining
  ].join(":");
}

function sponsorOfferMarkup() {
  if (!sponsorOffer) return "";
  const promo = sponsorOffer.promotionAvailable === true;
  const used = Number(sponsorOffer.occupiedCount || 0);
  const limit = Number(sponsorOffer.promoLimit || 200);
  const progress = Math.min(100, Math.max(0, used / Math.max(1, limit) * 100));
  const price1 = promo ? sponsorOffer.promoPrice1 : sponsorOffer.regularPrice1;
  const price3 = promo ? sponsorOffer.promoPrice3 : sponsorOffer.regularPrice3;
  return `
    <strong>${promo ? `前${limit}名贊助閱讀優惠` : "贊助閱讀一般方案"}</strong>
    <div class="sponsor-offer-prices">
      <div class="sponsor-offer-price"><span>一個月觀看權限</span><b>NT$${formatMoney(price1)}</b>${promo ? `<del>原價 NT$${formatMoney(sponsorOffer.regularPrice1)}</del>` : ""}</div>
      <div class="sponsor-offer-price"><span>三個月觀看權限</span><b>NT$${formatMoney(price3)}</b>${promo ? `<del>原價 NT$${formatMoney(sponsorOffer.regularPrice3)}</del>` : ""}</div>
    </div>
    <div class="sponsor-offer-status">${promo ? `尚餘 ${Number(sponsorOffer.remaining || 0)} 個優惠名額；一個月與三個月合併計算。` : "前200名優惠已額滿，現採一般方案價格。"}</div>
    <div class="sponsor-offer-progress" aria-hidden="true"><span style="width:${progress}%"></span></div>
  `;
}

function applySponsorOfferToPage() {
  if (!sponsorOffer) return;
  const signature = sponsorOfferSignature();
  const gate = document.querySelector('.paid-lock-zone[aria-label="贊助會員專屬"] .paid-lock-card');
  if (gate) {
    let panel = gate.querySelector(".sponsor-offer-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "sponsor-offer-panel";
      const actions = gate.querySelector(".paid-inquiry-actions");
      gate.insertBefore(panel, actions || null);
    }
    if (panel.dataset.offerSignature !== signature) {
      panel.innerHTML = sponsorOfferMarkup();
      panel.dataset.offerSignature = signature;
    }
  }

  const loginMarkup = sponsorOffer.promotionAvailable
    ? `<strong>目前仍有前${Number(sponsorOffer.promoLimit || 200)}名優惠</strong><span>一個月 NT$${formatMoney(sponsorOffer.promoPrice1)}｜三個月 NT$${formatMoney(sponsorOffer.promoPrice3)}｜尚餘 ${Number(sponsorOffer.remaining || 0)} 名</span>`
    : `<strong>贊助閱讀方案</strong><span>一個月 NT$${formatMoney(sponsorOffer.regularPrice1)}｜三個月 NT$${formatMoney(sponsorOffer.regularPrice3)}</span>`;
  loginOffer.hidden = false;
  if (loginOffer.dataset.offerSignature !== signature) {
    loginOffer.innerHTML = loginMarkup;
    loginOffer.dataset.offerSignature = signature;
  }
}

async function loadSponsorOffer() {
  try {
    const response = await fetch(`${SPONSOR_OFFER_STATUS_URL}?t=${Date.now()}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.ready !== true) throw new Error("offer-not-ready");
    sponsorOffer = result;
    applySponsorOfferToPage();
  } catch (error) {
    console.warn("贊助閱讀優惠狀態暫時無法取得。", error);
  }
}

const sponsorOfferObserver = new MutationObserver(() => applySponsorOfferToPage());
sponsorOfferObserver.observe(document.body, { childList: true, subtree: true });
loadSponsorOffer();

setPersistence(auth, browserLocalPersistence).catch(console.error);
getRedirectResult(auth).catch((error) => console.error("Google 重新導向登入失敗：", error));

memberButton.addEventListener("click", async (event) => {
  event.stopPropagation();
  if (auth.currentUser && isAdminEmail(auth.currentUser.email)) {
    location.href = "/admin.html";
    return;
  }
  if (auth.currentUser && hasMemberAccess) {
    toggleAccountMenu();
    return;
  }
  if (auth.currentUser) {
    memberButton.disabled = true;
    try { await signOut(auth); } finally { memberButton.disabled = false; }
    return;
  }
  modal.classList.add("is-open");
});

signOutButton.addEventListener("click", async () => {
  closeAccountMenu();
  memberButton.disabled = true;
  try { await signOut(auth); } finally { memberButton.disabled = false; }
});

accountMenu.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", (event) => {
  if (!bar.contains(event.target)) closeAccountMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAccountMenu();
});

googleButton.addEventListener("click", async () => {
  sessionStorage.setItem("site-auth-flow", "member");
  googleButton.disabled = true;
  memberButton.disabled = true;
  googleButton.textContent = isMobile ? "正在前往 Google 登入…" : "正在開啟 Google 登入…";
  memberButton.textContent = "登入中…";
  try {
    if (isMobile) {
      await signInWithRedirect(auth, provider);
      return;
    }
    const result = await signInWithPopup(auth, provider);
    if (isAdminEmail(result.user?.email)) {
      location.href = "/admin.html";
      return;
    }
    modal.classList.remove("is-open");
  } catch (error) {
    if (error?.code !== "auth/popup-closed-by-user" && error?.code !== "auth/cancelled-popup-request") {
      console.error("會員 Google 登入失敗：", error);
      alert(isInAppBrowser ? "目前的內建瀏覽器限制了 Google 登入，請改用 Safari 或 Chrome 開啟本頁。" : "目前無法完成會員登入，請稍後再試。");
    }
  } finally {
    googleButton.disabled = false;
    googleButton.textContent = "選擇會員 Google 帳號";
    memberButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  closeAccountMenu();
  hasWellnessAccess = false;
  hasMemberAccess = false;
  wellnessVideoLink.hidden = true;
  memberButton.disabled = false;
  memberButton.setAttribute("aria-haspopup", "false");
  if (user && sessionStorage.getItem("site-auth-flow") === "member" && isAdminEmail(user.email)) {
    sessionStorage.removeItem("site-auth-flow");
    location.href = "/admin.html";
    return;
  }
  sessionStorage.removeItem("site-auth-flow");
  if (!user) {
    memberButton.textContent = "會員登入";
    memberButton.title = "使用會員 Google 帳號登入";
    return;
  }
  if (isAdminEmail(user.email)) {
    memberButton.textContent = "進入管理後台";
    memberButton.title = "前往靈元院管理後台";
    return;
  }
  const displayName = (user.displayName || "會員").trim().split(/\s+/)[0];
  memberButton.textContent = `${displayName}｜確認資格中…`;
  memberButton.title = user.email || "會員已登入";
  memberButton.disabled = true;
  try {
    const email = (user.email || "").trim().toLowerCase();
    const snapshot = await getDoc(doc(db, "memberAccess", email));
    const member = snapshot.exists() ? snapshot.data() : null;
    if (auth.currentUser?.uid !== user.uid) return;
    hasWellnessAccess = Boolean(member && isActiveWellnessMember(member));
    hasMemberAccess = Boolean(member && isActiveMember(member));
    wellnessVideoLink.hidden = !hasWellnessAccess;
    if (hasMemberAccess) {
      memberButton.textContent = `${displayName} ▾`;
      memberButton.title = "開啟個人會員選單";
      memberButton.setAttribute("aria-haspopup", "menu");
    } else {
      memberButton.textContent = `${displayName}｜登出`;
      memberButton.title = "目前帳號沒有有效會員資格；按此登出";
    }
  } catch (error) {
    console.error("會員導覽資格確認失敗：", error);
    if (auth.currentUser?.uid === user.uid) {
      memberButton.textContent = `${displayName}｜登出`;
      memberButton.title = "暫時無法確認會員資格；按此登出";
    }
  } finally {
    if (auth.currentUser?.uid === user.uid) memberButton.disabled = false;
  }
});
