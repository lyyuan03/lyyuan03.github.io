import { auth, provider, isAdminEmail } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const AUTH_VERSION = "20260801-member-menu-fix-2";

function installStyles() {
  if (document.getElementById("site-auth-nav-styles")) return;
  const style = document.createElement("style");
  style.id = "site-auth-nav-styles";
  style.textContent = `
    :root{--site-auth-height:48px}
    body.site-auth-enabled{padding-top:var(--site-auth-height)!important}
    #site-auth-bar{position:fixed;top:56px;left:0;right:0;z-index:98;height:var(--site-auth-height);display:flex;align-items:center;justify-content:flex-end;padding:0 24px;background:rgba(7,11,6,.97);border-bottom:1px solid rgba(165,130,84,.22);font-family:'Noto Sans TC','Arial',sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.08)}
    .site-auth-actions{display:flex;align-items:center;gap:9px}
    .site-auth-button{height:34px;padding:6px 14px;border:1px solid rgba(165,130,84,.48);background:rgba(165,130,84,.07);color:#C5A26F;font:inherit;font-size:12px;letter-spacing:.1em;cursor:pointer;white-space:nowrap;transition:background .2s,color .2s,border-color .2s,transform .2s}
    .site-auth-button:hover{background:rgba(165,130,84,.17);border-color:rgba(197,162,111,.72);transform:translateY(-1px)}
    .site-auth-button:disabled{opacity:.55;cursor:wait;transform:none}
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
    nav .member-nav-trigger.active{color:#C5A26F!important}
    nav .nav-links>li:focus-within>.dropdown{display:block}
    nav .nav-links>li.open>.dropdown,
    nav .nav-links>li.dropdown-open>.dropdown{display:block!important}
    @media(max-width:768px){
      :root{--site-auth-height:52px}
      #site-auth-bar{padding:0 12px;justify-content:center}
      .site-auth-actions{width:100%;max-width:220px;gap:8px}
      .site-auth-button{flex:1;min-width:0;padding:6px 8px;font-size:11.5px}
      .member-login-card{padding:38px 24px 30px}
    }
  `;
  document.head.appendChild(style);
}

function installMemberMenu() {
  const membershipLink = [...document.querySelectorAll("nav .nav-links > li > a[href]")].find((link) => {
    try {
      const href = link.getAttribute("href");
      return href && new URL(href, location.href).pathname.endsWith("/membership.html");
    } catch (_error) {
      return false;
    }
  });
  const item = membershipLink?.closest("li");
  if (!item || item.querySelector(".member-nav-trigger")) return;
  const currentPath = location.pathname.replace(/\/+$/, "") || "/";
  const isMemberPage = currentPath.endsWith("/membership.html") || currentPath.endsWith("/member-dashboard.html") || currentPath.endsWith("/member-videos.html");
  item.innerHTML = `
    <span class="has-dropdown member-nav-trigger${isMemberPage ? " active" : ""}" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">會員</span>
    <ul class="dropdown member-nav-dropdown">
      <li><a href="/membership.html">會員制度說明</a></li>
      <li><a href="/member-dashboard.html">我的會員中心</a></li>
      <li><a href="/member-videos.html">養生會員影片</a></li>
    </ul>`;
  const trigger = item.querySelector(".member-nav-trigger");
  const closeMenu = () => {
    item.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !item.classList.contains("open");
    document.querySelectorAll("nav .nav-links>li.open").forEach((openItem) => {
      if (openItem !== item) openItem.classList.remove("open");
    });
    item.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
  };
  trigger.addEventListener("click", toggle);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") toggle(event);
    if (event.key === "Escape") closeMenu();
  });
  item.querySelector(".member-nav-dropdown").addEventListener("click", (event) => {
    event.stopPropagation();
  });
  document.addEventListener("click", (event) => {
    if (!item.contains(event.target)) closeMenu();
  });
}

function installBar() {
  const existing = document.getElementById("site-auth-bar");
  if (existing) return existing;
  const bar = document.createElement("div");
  bar.id = "site-auth-bar";
  bar.setAttribute("data-auth-version", AUTH_VERSION);
  bar.innerHTML = `
    <div class="site-auth-actions" aria-label="網站登入">
      <button id="member-login-button" class="site-auth-button" type="button">會員登入</button>
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
installMemberMenu();
const bar = installBar();
const modal = installMemberModal();
const memberButton = bar.querySelector("#member-login-button");
const googleButton = modal.querySelector(".member-google-button");
const browserNote = modal.querySelector(".member-login-browser-note");
const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
const isMobile = window.matchMedia("(max-width:768px), (pointer:coarse)").matches;
if (isInAppBrowser) browserNote.style.display = "block";

setPersistence(auth, browserLocalPersistence).catch(console.error);
getRedirectResult(auth).catch((error) => console.error("Google 重新導向登入失敗：", error));

memberButton.addEventListener("click", async () => {
  if (auth.currentUser && !isAdminEmail(auth.currentUser.email)) {
    memberButton.disabled = true;
    try { await signOut(auth); } finally { memberButton.disabled = false; }
    return;
  }
  if (auth.currentUser && isAdminEmail(auth.currentUser.email)) {
    location.href = "/admin.html";
    return;
  }
  modal.classList.add("is-open");
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
  memberButton.textContent = `${displayName}｜登出`;
  memberButton.title = user.email || "會員已登入";
});
