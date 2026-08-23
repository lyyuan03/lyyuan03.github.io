const DASHBOARD_PAYMENT_SELECTOR = '[data-sponsor-smart-slot][data-sponsor-context="dashboard"] [data-sponsor-smart-pay]';

function closePopup(popup) {
  try {
    if (popup && !popup.closed) popup.close();
  } catch {}
}

async function openDashboardPaymentInNewTab(button) {
  const checkout = window.LingYuanSponsorCheckout;
  if (!checkout?.refresh || !checkout?.getState) {
    alert("付款系統尚未完成載入，請稍後再試。");
    return;
  }

  // 必須在使用者按下按鍵的當下先開啟新分頁，避免瀏覽器將非同步開頁視為彈出式視窗而阻擋。
  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    alert("瀏覽器阻擋了新的付款分頁，請允許此網站開啟新分頁後再試一次。");
    return;
  }

  try {
    popup.opener = null;
    popup.document.title = "正在前往付款頁面…";
  } catch {}

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "正在確認您的適用價格…";

  try {
    await checkout.refresh();
    const state = checkout.getState();
    const tier = state?.tier;
    const paymentUrl = tier === "promo"
      ? String(state?.offer?.promoPaymentUrl || "").trim()
      : tier === "regular"
        ? String(state?.offer?.regularPaymentUrl || "").trim()
        : "";

    if (!paymentUrl.startsWith("https://")) {
      closePopup(popup);
      alert(tier === "promo"
        ? "首次優惠付款連結尚未完成設定，請稍後再試或聯繫行政團隊。"
        : "續期／原價付款連結尚未完成設定，請稍後再試或聯繫行政團隊。");
      return;
    }

    // 會員中心保留在原分頁，付款連結固定於新分頁開啟。
    popup.location.replace(paymentUrl);
  } catch (error) {
    closePopup(popup);
    console.warn("會員中心付款新分頁開啟失敗。", error);
    alert("目前無法確認付款資格，請稍後重新整理頁面再試。");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 此監聽器會在 sponsor-checkout-v3.js 之前註冊，只攔截會員中心的付款按鍵；
// 文章頁與其他位置仍沿用原本的付款導向方式。
document.addEventListener("click", (event) => {
  const button = event.target.closest?.(DASHBOARD_PAYMENT_SELECTOR);
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openDashboardPaymentInNewTab(button);
}, true);
