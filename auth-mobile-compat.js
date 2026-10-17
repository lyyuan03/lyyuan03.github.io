import { auth, provider, isAdminEmail } from "./firebase-config.js";
import {
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { isInAppBrowser as detectInAppBrowser, openInExternalBrowser } from "./inapp-browser.js?v=20261017-inapp-login-1";

const RETURN_URL_KEY = "lyyuan-auth-return-url";
const AUTH_FLOW_KEY = "lyyuan-auth-flow-v2";
const isInAppBrowser = detectInAppBrowser();
const POPUP_SLOW_MS = 45000;

const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("登入狀態保存設定失敗：", error);
});

function safeReturnUrl() {
  try {
    const url = new URL(location.href);
    return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

function rememberLogin(flow) {
  try {
    localStorage.setItem(RETURN_URL_KEY, safeReturnUrl());
    localStorage.setItem(AUTH_FLOW_KEY, flow);
  } catch {}
}

function clearLoginMemory() {
  try {
    localStorage.removeItem(RETURN_URL_KEY);
    localStorage.removeItem(AUTH_FLOW_KEY);
  } catch {}
}

function loginMessage(error, flow) {
  if (isInAppBrowser || error?.code === "auth/operation-not-supported-in-this-environment") {
    return "目前的內建瀏覽器限制了 Google 登入。請點選右上角選單，改用 Safari 或 Chrome 開啟本頁。";
  }
  if (error?.code === "auth/unauthorized-domain") {
    return "目前網域尚未加入 Firebase 授權網域，請聯絡網站管理員處理。";
  }
  if (error?.code === "auth/network-request-failed") {
    return "網路連線中斷，請確認連線後再試一次。";
  }
  return flow === "admin"
    ? "管理員登入失敗，請稍後再試。"
    : "目前無法完成會員登入，請稍後再試。";
}

function shouldFallbackToRedirect(error) {
  return [
    "auth/popup-blocked",
    "auth/web-storage-unsupported",
    "auth/operation-not-supported-in-this-environment"
  ].includes(error?.code);
}

function setBusy(button, busy, flow) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = flow === "admin" ? "登入中…" : "正在開啟 Google 登入…";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }

  if (flow === "member") {
    const navButton = document.getElementById("member-login-button");
    if (navButton) {
      navButton.disabled = busy;
      navButton.textContent = busy ? "登入中…" : navButton.textContent === "登入中…" ? "會員登入" : navButton.textContent;
    }
  }
}

function showStatus(message, flow) {
  if (flow === "admin") {
    const status = document.getElementById("gate-status");
    if (status) status.textContent = message;
    return;
  }
  window.alert(message);
}

async function beginGoogleLogin(button, flow) {
  // 內建瀏覽器中 Google 會回應 403 disallowed_useragent，絕不在此呼叫 signInWithPopup。
  if (isInAppBrowser) {
    document.getElementById("member-login-modal")?.classList.remove("is-open");
    openInExternalBrowser();
    return;
  }
  rememberLogin(flow);
  setBusy(button, true, flow);
  await persistenceReady;

  try {
    const slowTimer = window.setTimeout(() => {
      showStatus("Google 登入視窗仍未完成。若沒有看到登入視窗，請確認瀏覽器未封鎖彈出視窗，或改用 Safari／Chrome 重新開啟本頁。", flow);
    }, POPUP_SLOW_MS);
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } finally {
      window.clearTimeout(slowTimer);
    }
    clearLoginMemory();

    if (flow === "admin" && result.user && !isAdminEmail(result.user.email)) {
      showStatus("此帳號沒有後台管理權限，請改用管理員帳號。", flow);
      return;
    }

    // 管理員從任何前台會員登入入口登入時，都應直接進入後台。
    // 原本行動裝置相容層會攔截前台登入按鈕，卻沒有補上這個導向，
    // 造成管理員登入後仍停留前台，甚至再次被要求登入。
    if (result.user && isAdminEmail(result.user.email)) {
      if (location.pathname !== "/admin.html") location.replace("/admin.html");
      return;
    }

    if (flow === "member") {
      document.getElementById("member-login-modal")?.classList.remove("is-open");
    }
  } catch (error) {
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code)) {
      clearLoginMemory();
      showStatus("Google 登入視窗已關閉，尚未完成登入。請再按一次登入；若視窗無法開啟，請改用 Safari 或 Chrome。", flow);
      return;
    }

    if (shouldFallbackToRedirect(error) && !isInAppBrowser) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        console.error("Google 重新導向登入失敗：", redirectError);
        clearLoginMemory();
        showStatus(loginMessage(redirectError, flow), flow);
        return;
      }
    }

    console.error("Google 登入失敗：", error);
    clearLoginMemory();
    showStatus(loginMessage(error, flow), flow);
  } finally {
    setBusy(button, false, flow);
  }
}

// 使用擷取階段攔截原本的登入按鈕，避免 iPhone／iPad 固定走容易失敗的 redirect 流程。
document.addEventListener("click", (event) => {
  const memberButton = event.target.closest?.(".member-google-button");
  const adminButton = event.target.closest?.("#admin-login");
  const button = memberButton || adminButton;
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  beginGoogleLogin(button, adminButton ? "admin" : "member");
}, true);

(async () => {
  await persistenceReady;
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return;

    let flow = "member";
    let returnUrl = "";
    try {
      flow = localStorage.getItem(AUTH_FLOW_KEY) || "member";
      returnUrl = localStorage.getItem(RETURN_URL_KEY) || "";
    } catch {}
    clearLoginMemory();

    if (flow === "admin" || isAdminEmail(result.user.email)) {
      if (location.pathname !== "/admin.html") location.replace("/admin.html");
      return;
    }

    if (returnUrl && returnUrl !== `${location.pathname}${location.search}${location.hash}`) {
      location.assign(returnUrl);
    }
  } catch (error) {
    console.error("Google 重新導向登入結果讀取失敗：", error);
    clearLoginMemory();
  }
})();
