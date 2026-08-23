import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const currentPath = location.pathname;
const isAdminPage = /(^|\/)admin\.html$/i.test(currentPath);

if (/(^|\/)articles\.html$/i.test(currentPath)) {
  import("./articles-chrome-fix.js?v=20260822-1").catch((error) => {
    console.error("文選頁首頁尾版型載入失敗：", error);
  });
  import("./article-protection.js?v=20260723-member-watermark-1");
  import("./article-paid-badge.js?v=20260722-3");
  import("./article-taxonomy-v2.js?v=20260801-taxonomy-3");
  import("./article-inline-image-display.js?v=20260807-inline-image-manager-1");
  import("./construction-record-page.js?v=20260822-1").catch((error) => {
    console.error("建院專屬紀錄版型載入失敗：", error);
  });
}

if (isAdminPage) {
  import("./article-admin-event-static-fix.js?v=20260802-event-admin-fix-1");
  import("./seed-guanyin-vow-lamp-v2.js?v=20260802-seed-1");
  import("./article-guanyin-v2-images.js?v=20260802-images-2");
  import("./activity-admin-bulk.js?v=20260802-bulk-selection-1");
  import("./member-admin-bulk.js?v=20260802-all-member-bulk-1");
  import("./article-inline-image-admin.js?v=20260813-manual-image-markdown-3");
  import("./article-admin-paid-security.js?v=20260823-private-paid-save-1").catch((error) => {
    console.error("付費文章私有正文保護模組載入失敗：", error);
  });
  import("./construction-record-admin.js?v=20260822-1").catch((error) => {
    console.error("建院專屬紀錄後台初始化失敗：", error);
  });
}

export const firebaseConfig = {
  apiKey: "AIzaSyAgHy-nPOErzs7NDJossVGPITbenXOfjQY",
  authDomain: "lyyuan03-membership.firebaseapp.com",
  projectId: "lyyuan03-membership",
  storageBucket: "lyyuan03-membership.firebasestorage.app",
  messagingSenderId: "77417213320",
  appId: "1:77417213320:web:221afecf62eedb66f41e3d"
};

export const ADMIN_EMAILS = ["lyyuan03@gmail.com"];

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

// 後台登入狀態由 article-admin.js 統一管理。
// 不在 Firebase 初始化階段以「暫時尚未取得 user」判定為登出並跳頁，
// 避免 iPhone／iPad 經 Google 登入返回 admin.html 時被過早導回會員頁。

// 所有使用 Firebase 的頁面都載入同一套登入相容處理，
// 讓 iPhone、iPad、Android 與桌機使用一致的 Email 判讀與登入狀態。
import("./auth-mobile-compat.js?v=20260810-admin-login-race-fix-1").catch((error) => {
  console.error("跨裝置登入相容模組載入失敗：", error);
});

// 前台會員選單加入「會員專屬優惠」固定入口；有尚未結束且目前可見的活動時，顯示紅色 NEW。
if (!isAdminPage) {
  queueMicrotask(() => {
    import("./member-offers-nav.js?v=20260812-1").catch((error) => {
      console.error("會員優惠選單模組載入失敗：", error);
    });
  });
}

// 會員專屬優惠共用整合：公開會員頁只提示權益；會員中心顯示最新活動；
// 管理後台載入可設定多階段與三種會員資格的優惠管理模組。
if (/(^|\/)(membership|member-dashboard|admin)\.html$/i.test(currentPath)) {
  queueMicrotask(() => {
    import("./member-offers-integration.js?v=20260812-2").catch((error) => {
      console.error("會員專屬優惠整合模組載入失敗：", error);
    });
  });
}

// 會員優惠影片附加功能：後台可儲存影片網址，會員中心活動卡可直接觀看。
if (/(^|\/)(member-dashboard|admin)\.html$/i.test(currentPath)) {
  queueMicrotask(() => {
    import("./member-offer-video-addon.js?v=20260812-1").catch((error) => {
      console.error("會員優惠影片功能載入失敗：", error);
    });
  });
}
