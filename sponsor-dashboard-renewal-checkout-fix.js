import { app, auth } from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const functions = getFunctions(app, "asia-east1");
const createRenewalCheckout = httpsCallable(functions, "createSponsorRenewalCheckout");

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

  const originalDisabled = button.disabled;
  button.disabled = true;

  try {
    const result = await createRenewalCheckout({
      planMonths: Number(months),
      name: auth.currentUser.displayName || ""
    });
    const data = result?.data || {};
    const paymentUrl = String(data.paymentUrl || "").trim();
    if (!paymentUrl.startsWith("https://")) {
      throw new Error("付款連結建立失敗。");
    }

    try {
      localStorage.setItem("lyyuan:sponsor:pending-plan", String(months));
      localStorage.setItem("lyyuan:sponsor:pending-tier", "regular");
    } catch {}

    popup.location.replace(paymentUrl);
  } catch (error) {
    closePopup(popup);
    console.error("會員中心續期付款建立失敗。", error);
    const message = String(error?.message || "")
      .replace(/^FirebaseError:\s*/i, "")
      .replace(/^functions\/[\w-]+:\s*/i, "")
      .trim();
    alert(message || "目前無法建立綠界付款連結，請稍後再試。");
  } finally {
    button.disabled = originalDisabled && false;
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
