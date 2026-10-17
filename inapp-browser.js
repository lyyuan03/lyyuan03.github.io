// 社群 App 內建瀏覽器（LINE／Facebook／Instagram／Threads／WeChat／TikTok／Android WebView）
// Google 會以 403 disallowed_useragent 拒絕在內建瀏覽器中登入，因此必須先改用外部瀏覽器開啟。
export const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Barcelona|MicroMessenger|musical_ly|Bytedance|; wv\)/i;

export function isInAppBrowser(ua = navigator.userAgent) {
  return IN_APP_BROWSER_PATTERN.test(ua || "");
}

function isLineApp(ua = navigator.userAgent) {
  return /Line\//i.test(ua || "");
}

function isAndroid(ua = navigator.userAgent) {
  return /Android/i.test(ua || "");
}

function currentUrlWithout(param) {
  const url = new URL(location.href);
  url.searchParams.delete(param);
  return url;
}

function installStyles() {
  if (document.getElementById("inapp-browser-styles")) return;
  const style = document.createElement("style");
  style.id = "inapp-browser-styles";
  style.textContent = `
    #inapp-browser-guide{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(3,7,4,.78)}
    #inapp-browser-guide .inapp-card{width:min(420px,100%);padding:30px 24px 24px;background:#10170d;border:1px solid rgba(165,130,84,.5);color:#F5F0E8;font-family:'Noto Sans TC','Arial',sans-serif;text-align:left;line-height:1.85}
    #inapp-browser-guide h2{margin:0 0 12px;font-size:19px;font-weight:500;letter-spacing:.1em;color:#D8BD91;text-align:center}
    #inapp-browser-guide ol{margin:0 0 16px;padding-left:22px;font-size:14px}
    #inapp-browser-guide p{margin:0 0 12px;font-size:13px;color:rgba(245,240,232,.75)}
    #inapp-browser-guide button{display:block;width:100%;margin-top:9px;padding:12px;border:1px solid rgba(165,130,84,.6);background:rgba(165,130,84,.14);color:#D8BD91;font:inherit;font-size:14px;letter-spacing:.08em;cursor:pointer}
    #inapp-browser-guide .inapp-close{background:transparent;color:rgba(245,240,232,.6)}
  `;
  document.head.appendChild(style);
}

export function showOpenExternalGuide(message = "") {
  installStyles();
  document.getElementById("inapp-browser-guide")?.remove();
  const url = currentUrlWithout("openExternalBrowser").href;
  const guide = document.createElement("div");
  guide.id = "inapp-browser-guide";
  guide.setAttribute("role", "dialog");
  guide.setAttribute("aria-modal", "true");
  guide.innerHTML = `
    <div class="inapp-card">
      <h2>請改用瀏覽器開啟</h2>
      <p>Google 不允許在 LINE、Facebook、Instagram 等 App 的內建瀏覽器中登入。請依下列步驟改用 Safari 或 Chrome 開啟本頁後再登入：</p>
      <ol>
        <li>點選畫面右上角（或右下角）的「⋯」或分享按鈕</li>
        <li>選擇「在瀏覽器中開啟」／「以 Safari 開啟」／「在 Chrome 中開啟」</li>
        <li>開啟後再按「會員登入」</li>
      </ol>
      <p>若找不到選項，請按下方按鈕複製網址，貼到 Safari 或 Chrome 網址列。</p>
      <p class="inapp-status" aria-live="polite"></p>
      <button type="button" class="inapp-copy">複製本頁網址</button>
      <button type="button" class="inapp-close">關閉</button>
    </div>`;
  document.body.appendChild(guide);
  const status = guide.querySelector(".inapp-status");
  if (message) status.textContent = message;
  guide.querySelector(".inapp-close").addEventListener("click", () => guide.remove());
  guide.querySelector(".inapp-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = "已複製網址，請貼到 Safari 或 Chrome 開啟。";
    } catch {
      window.prompt("請長按複製以下網址，貼到 Safari 或 Chrome 開啟：", url);
    }
  });
}

// 回傳 true 表示已改為外部瀏覽器流程，呼叫端不可再呼叫 signInWithPopup／signInWithRedirect。
export function openInExternalBrowser() {
  if (!isInAppBrowser()) return false;
  const ua = navigator.userAgent || "";
  const url = currentUrlWithout("openExternalBrowser");

  if (isLineApp(ua)) {
    const alreadyTried = new URL(location.href).searchParams.get("openExternalBrowser") === "1";
    if (!alreadyTried) {
      url.searchParams.set("openExternalBrowser", "1");
      location.assign(url.href);
      window.setTimeout(() => showOpenExternalGuide(), 1500);
      return true;
    }
    showOpenExternalGuide();
    return true;
  }

  if (isAndroid(ua)) {
    const intentUrl = `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
    location.href = intentUrl;
    window.setTimeout(() => showOpenExternalGuide(), 1500);
    return true;
  }

  showOpenExternalGuide();
  return true;
}
