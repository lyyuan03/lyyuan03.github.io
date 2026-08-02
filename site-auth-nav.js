import { auth, provider, db, isAdminEmail } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const AUTH_VERSION = "20260802-reading-cover-title-crop-1";

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
    .member-login-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:rgba(245,240,232,.4);font-size:12px;letter-spacing:.12em}
    .member-login-divider:before,.member-login-divider:after{content:'';height:1px;flex:1;background:rgba(165,130,84,.25)}
    .member-email-form{display:grid;gap:10px;text-align:left}
    .member-email-form label{font-size:13px;color:rgba(245,240,232,.74);letter-spacing:.08em}
    .member-email-form input{width:100%;border:1px solid rgba(165,130,84,.38);background:rgba(255,255,255,.055);color:#F5F0E8;padding:12px 13px;font:14px 'Noto Sans TC','Arial',sans-serif;outline:none}
    .member-email-form input:focus{border-color:rgba(197,162,111,.78);box-shadow:0 0 0 2px rgba(165,130,84,.12)}
    .member-email-button{width:100%;border:1px solid rgba(165,130,84,.44);background:transparent;color:#D7BE96;padding:12px 16px;font:13px 'Noto Sans TC','Arial',sans-serif;letter-spacing:.1em;cursor:pointer}
    .member-email-button:hover{background:rgba(165,130,84,.12)}
    .member-email-button:disabled{opacity:.55;cursor:wait}
    .member-email-status{display:none;margin:13px 0 0!important;padding:10px 12px;border:1px solid rgba(197,162,111,.25);background:rgba(165,130,84,.08);font-size:12px!important;line-height:1.7!important;color:#D7BE96!important;text-align:left}
    .member-email-status.is-visible{display:block}
    .member-email-status.is-error{border-color:rgba(190,100,90,.5);color:#E5B5AE!important}
    .member-login-note{margin-top:17px!important;margin-bottom:0!important;font-size:12px!important;color:rgba(245,240,232,.42)!important}
    .member-login-browser-note{display:none;margin:14px 0 0!important;padding:11px 12px;border:1px solid rgba(197,162,111,.28);background:rgba(165,130,84,.08);color:#d8bd91!important;font-size:12px!important;line-height:1.75!important}
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
      <p>請使用登記會員資格或活動報名時使用的 Email 登入，系統將依照該 Email 確認閱讀權限。</p>
      <button class="member-google-button" type="button">選擇會員 Google 帳號</button>
      <div class="member-login-divider"><span>或</span></div>
      <form class="member-email-form">
        <label for="member-email-input">使用其他電子郵件登入</label>
        <input id="member-email-input" name="email" type="email" inputmode="email" autocomplete="email" placeholder="請輸入活動報名時登記的 Email" required>
        <button class="member-email-button" type="submit">寄送 Email 驗證連結</button>
      </form>
      <p class="member-email-status" role="status" aria-live="polite"></p>
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
const emailForm = modal.querySelector(".member-email-form");
const emailInput = modal.querySelector("#member-email-input");
const emailButton = modal.querySelector(".member-email-button");
const emailStatus = modal.querySelector(".member-email-status");
const browserNote = modal.querySelector(".member-login-browser-note");
const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
const isMobile = window.matchMedia("(max-width:768px), (pointer:coarse)").matches;
let hasWellnessAccess = false;
let hasMemberAccess = false;
const EMAIL_STORAGE_KEY = "lyyuan-email-link-address";
let completingEmailLink = isSignInWithEmailLink(auth, location.href);
if (isInAppBrowser) browserNote.style.display = "block";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function setEmailStatus(message, type = "info") {
  emailStatus.textContent = message;
  emailStatus.classList.toggle("is-visible", Boolean(message));
  emailStatus.classList.toggle("is-error", type === "error");
}

function emailActionUrl() {
  const url = new URL(location.href);
  ["apiKey", "oobCode", "mode", "lang", "continueUrl"].forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

async function completeEmailLink(email) {
  emailButton.disabled = true;
  emailInput.disabled = true;
  emailButton.textContent = "正在驗證…";
  setEmailStatus("正在確認您的 Email 與閱讀資格，請稍候。");
  try {
    await signInWithEmailLink(auth, email, location.href);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    completingEmailLink = false;
    setEmailStatus("Email 驗證完成，正在開啟您的閱讀權限。");
    const clean = new URL(location.href);
    ["apiKey", "oobCode", "mode", "lang", "continueUrl"].forEach((key) => clean.searchParams.delete(key));
    history.replaceState({}, document.title, clean.toString());
    modal.classList.remove("is-open");
  } catch (error) {
    console.error("Email 驗證登入失敗：", error);
    setEmailStatus("驗證連結可能已使用或逾期，請重新寄送一封驗證信。", "error");
  } finally {
    emailButton.disabled = false;
    emailInput.disabled = false;
    emailButton.textContent = completingEmailLink ? "完成 Email 驗證登入" : "寄送 Email 驗證連結";
  }
}

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

setPersistence(auth, browserLocalPersistence).catch(console.error);
getRedirectResult(auth).catch((error) => console.error("Google 重新導向登入失敗：", error));

if (completingEmailLink) {
  modal.classList.add("is-open");
  const savedEmail = normalizeEmail(localStorage.getItem(EMAIL_STORAGE_KEY));
  emailButton.textContent = "完成 Email 驗證登入";
  setEmailStatus(savedEmail
    ? "已收到驗證連結，正在完成登入。"
    : "請再次輸入收到這封驗證信的 Email，以完成身分確認。");
  if (savedEmail) {
    emailInput.value = savedEmail;
    completeEmailLink(savedEmail);
  }
}

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

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalizeEmail(emailInput.value);
  if (!email || !emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }
  if (completingEmailLink) {
    await completeEmailLink(email);
    return;
  }
  emailButton.disabled = true;
  emailInput.disabled = true;
  emailButton.textContent = "正在寄送…";
  setEmailStatus("正在寄送驗證信，請稍候。");
  try {
    await sendSignInLinkToEmail(auth, email, {
      url: emailActionUrl(),
      handleCodeInApp: true
    });
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
    setEmailStatus(`驗證信已寄至 ${email}。請開啟信件並點選驗證連結；若未收到，也請查看垃圾郵件匣。`);
  } catch (error) {
    console.error("Email 驗證信寄送失敗：", error);
    const message = error?.code === "auth/operation-not-allowed"
      ? "Email 驗證登入尚未在 Firebase 後台啟用，請聯絡網站管理人員。"
      : "目前無法寄出驗證信，請確認 Email 是否正確，稍後再試。";
    setEmailStatus(message, "error");
  } finally {
    emailButton.disabled = false;
    emailInput.disabled = false;
    emailButton.textContent = "寄送 Email 驗證連結";
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
    memberButton.title = "使用 Google 帳號或一般 Email 登入";
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
