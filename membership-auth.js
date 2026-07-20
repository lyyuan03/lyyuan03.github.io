import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgHy-nPOErzs7NDJossVGPITbenXOfjQY",
  authDomain: "lyyuan03-membership.firebaseapp.com",
  projectId: "lyyuan03-membership",
  storageBucket: "lyyuan03-membership.firebasestorage.app",
  messagingSenderId: "77417213320",
  appId: "1:77417213320:web:221afecf62eedb66f41e3d"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function installStyles() {
  if (document.getElementById("member-auth-styles")) return;
  const style = document.createElement("style");
  style.id = "member-auth-styles";
  style.textContent = `
    #member-login-button{border:1px solid rgba(165,130,84,.55);background:rgba(165,130,84,.08);color:#A58254;padding:7px 14px;font-family:'Noto Sans TC','Arial',sans-serif;font-size:12px;letter-spacing:.12em;cursor:pointer;white-space:nowrap}
    #member-login-button:disabled{opacity:.55;cursor:wait}
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
    /* unified-black-navigation */
    nav,.nav-inner,.nav-content{background:rgba(7,11,6,.97)!important}
    /* dropdown-layer-fix */
    nav{height:104px!important;overflow:visible!important}
    .nav-links>li:not(:last-child){position:relative!important;z-index:220!important}
    .nav-links>li:not(:last-child)>.dropdown{z-index:1200!important}
    .nav-links>li:not(:last-child)>.dropdown:before{content:''!important;position:absolute!important;top:-18px!important;left:0!important;right:0!important;height:18px!important}
    .nav-inner{height:56px!important;position:relative}
    .nav-links>li:last-child{position:fixed!important;top:56px!important;left:0!important;right:0!important;height:48px!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;padding:0 24px!important;background:rgba(7,11,6,.97)!important;border-top:1px solid rgba(165,130,84,.12)!important;border-bottom:1px solid rgba(165,130,84,.22)!important;z-index:99!important;box-shadow:none!important}
    #member-login-button{height:34px!important;padding:6px 14px!important;font-size:12px!important;letter-spacing:.1em!important;background:rgba(165,130,84,.07)!important}
    @media(max-width:768px){
      .nav-inner{padding:0 12px!important;display:block!important;overflow:hidden!important}
      .nav-links{height:56px!important;width:100%!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:16px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 8px!important;scrollbar-width:none;-webkit-overflow-scrolling:touch}
      .nav-links::-webkit-scrollbar{display:none}.nav-links>li{flex:0 0 auto}.nav-links>li:last-child{padding:0 14px!important}.dropdown{max-height:70vh;overflow:auto}
    }
  `;
  document.head.appendChild(style);
}

function installModal() {
  if (document.getElementById("member-login-modal")) return document.getElementById("member-login-modal");
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
      <p>請使用 Google 帳號登入。接下來將由 Google 官方安全視窗，讓您選擇要使用的 Gmail 帳號。</p>
      <button class="member-google-button" type="button">選擇 Google 帳號</button>
      <p class="member-login-note">登入完成後，將自動回到目前頁面。</p>
      <p class="member-login-browser-note">目前正在 Facebook 內建瀏覽器中開啟。Google 登入可能較慢；若畫面長時間沒有反應，請點右上角分享按鈕，選擇「以 Safari 開啟」。</p>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove("is-open");
  modal.querySelector(".member-login-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  return modal;
}

const loginButton = document.getElementById("member-login-button");
if (loginButton) {
  installStyles();
  const modal = installModal();
  const googleButton = modal.querySelector(".member-google-button");
  const browserNote = modal.querySelector(".member-login-browser-note");
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
  const isMobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
  if (isInAppBrowser && browserNote) browserNote.style.display = "block";
  setPersistence(auth, browserLocalPersistence).catch(console.error);
  getRedirectResult(auth).catch((error) => {
    console.error("Google 重新導向登入失敗：", error);
  });

  loginButton.addEventListener("click", async () => {
    if (auth.currentUser) {
      loginButton.disabled = true;
      try { await signOut(auth); } finally { loginButton.disabled = false; }
    } else {
      modal.classList.add("is-open");
    }
  });

  googleButton.addEventListener("click", async () => {
    googleButton.disabled = true;
    googleButton.textContent = isMobile ? "正在前往 Google 登入…" : "正在開啟 Google 登入…";
    loginButton.disabled = true;
    loginButton.textContent = "登入中…";
    try {
      if (isMobile) {
        sessionStorage.setItem("member-login-return", location.href);
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      modal.classList.remove("is-open");
    } catch (error) {
      if (error?.code !== "auth/popup-closed-by-user" && error?.code !== "auth/cancelled-popup-request") {
        console.error("Google 登入失敗：", error);
        alert(isInAppBrowser ? "Facebook 內建瀏覽器限制了 Google 登入。請點右上角分享按鈕，選擇「以 Safari 開啟」後再登入。" : "目前無法完成 Google 登入，請稍後再試。");
      }
    } finally {
      googleButton.disabled = false;
      googleButton.textContent = "選擇 Google 帳號";
      loginButton.disabled = false;
      if (!auth.currentUser) loginButton.textContent = "會員登入";
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      const displayName = (user.displayName || "會員").trim().split(/\s+/)[0];
      loginButton.textContent = `${displayName}｜登出`;
      loginButton.title = user.email || "已登入";
    } else {
      loginButton.textContent = "會員登入";
      loginButton.title = "使用 Google 帳號登入";
    }
  });
}
