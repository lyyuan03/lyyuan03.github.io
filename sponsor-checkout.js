// 文選只由此入口啟動一次贊助方案判定，避免重複模組互相覆寫「確認中」狀態。
// 2026-09-02：文章付款按鈕直接依登入 Email 判斷首次優惠／原價，並讀取後台綠界固定連結。
import "./sponsor-checkout-v3.js?v=20260902-fixed-ecpay-email-tier-1";
