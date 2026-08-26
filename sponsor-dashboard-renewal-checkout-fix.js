import { app, auth, db } from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const functions = getFunctions(app, "asia-east1");
const createRenewalCheckout = httpsCallable(functions, "createSponsorRenewalCheckout");
const OFFER_CACHE_KEY = "lyyuan:sponsor:dashboard-renewal-offer-v2";

function prepareRenewalButtons(root = document) {
  root.querySelectorAll?.("[data-dashboard-renewal-months]").forEach((button) => {
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.title = "前往綠界安全付款";
  });

  root.querySelectorAll?.(".dashboard-renewal-note").forEach((note) => {
    note.textContent = "點選續期方案後，將另開綠界安全付款頁面。";
  });
}

function closePopup(popup) {
  try {
    if (popup && !popup.closed) popup.close();
  } catch {}
}

function validHttpsUrl(value = "") {
  const url = String(value || "").trim();
  return url.startsWith("https://") ? url : "";
}

function cachedRegularPaymentUrl() {
  try {
    const cached = JSON.parse(localStorage.getItem(OFFER_CACHE_KEY) || "null");
    return validHttpsUrl(cached?.regularPaymentUrl);
  } catch {
    return "";
  }
}

async function publishedRegularPaymentUrl() {
  try {
    const snapshot = await getDoc(doc(db, "articles", "sponsor-offer-status"));
    const data = snapshot.exists() ? snapshot.data() || {} : {};
    if (data.status !== "published" || data.systemRecord !== true) return cachedRegularPaymentUrl();
    const url = validHttpsUrl(data.regularPaymentUrl);
    if (url) return url;
  } catch (error) {
    console.warn("續期付款公開連結讀取失敗，改用最近一次設定。", error);
  }
  return cachedRegularPaymentUrl();
}

function rememberPlan(months) {
  try {
    localStorage.setItem("lyyuan:sponsor:pending-plan", String(months));
    localStorage.setItem("lyyuan:sponsor:pending-tier", "regular");
  } catch {}
}

async function openRenewalCheckout(button, months) {
  if (![1, 3].includes(Number(months))) return;
  if (!auth.currentUser?.email) {
    alert("請先登入會員帳號後再進行續期付款。");
    return;
  }

  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    alert("瀏覽器阻擋了付款分頁，請允許本網站開啟新分頁後再試一次。");
    return;
  }

  try {
    popup.opener = null;
    popup.document.title = "正在前往綠界安全付款…";
    popup.document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;font-family:sans-serif;color:#594F47">正在建立綠界安全付款連結…</div>';
  } catch {}

  button.disabled = true;
  rememberPlan(months);

  try {
    const result = await createRenewalCheckout({
      planMonths: Number(months),
      name: auth.currentUser.displayName || ""
    });
    const paymentUrl = validHttpsUrl(result?.data?.paymentUrl);
    if (!paymentUrl) throw new Error("付款連結建立失敗。");
    popup.location.replace(paymentUrl);
  } catch (error) {
    console.warn("專屬續期付款函式暫時不可用，改讀既有綠界付款連結。", error);
    const fallbackUrl = await publishedRegularPaymentUrl();
    if (fallbackUrl) {
      popup.location.replace(fallbackUrl);
      return;
    }

    closePopup(popup);
    console.error("會員中心續期付款建立失敗。", error);
    alert("目前綠界續期付款連結尚未完成同步，請稍後再試。");
  } finally {
    button.disabled = false;
  }
}

prepareRenewalButtons();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList" && mutation.addedNodes.length) {
      prepareRenewalButtons(document);
      break;
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-dashboard-renewal-months]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openRenewalCheckout(button, Number(button.dataset.dashboardRenewalMonths));
}, true);
