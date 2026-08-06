import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const currentPath = location.pathname;
const isAdminPage = /(^|\/)admin\.html$/i.test(currentPath);
const isAdminSectionRoute = /^#(?:activity-management|sponsor-members|wellness-members|member-video-management)$/i.test(location.hash);

if (/(^|\/)articles\.html$/i.test(currentPath)) {
  import("./article-protection.js?v=20260723-member-watermark-1");
  import("./article-paid-badge.js?v=20260722-3");
  import("./article-taxonomy-v2.js?v=20260801-taxonomy-3");
}

if (isAdminPage) {
  import("./article-admin-event-static-fix.js?v=20260802-event-admin-fix-1");
  import("./seed-guanyin-vow-lamp-v2.js?v=20260802-seed-1");
  import("./article-guanyin-v2-images.js?v=20260802-images-2");
  import("./activity-admin-bulk.js?v=20260802-bulk-selection-1");
  import("./member-admin-bulk.js?v=20260802-all-member-bulk-1");
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

// 後台曾成功載入管理員帳號後，按下「登出」即離開後台，
// 並處理登出後仍停留在管理區段網址的舊分頁。
if (isAdminPage) {
  const adminSessionMarker = "lyyuan-admin-session-active";
  onAuthStateChanged(auth, (user) => {
    if (user && isAdminEmail(user.email)) {
      sessionStorage.setItem(adminSessionMarker, "1");
      return;
    }

    const hadAdminSession = sessionStorage.getItem(adminSessionMarker) === "1";
    if (!user && (hadAdminSession || isAdminSectionRoute)) {
      sessionStorage.removeItem(adminSessionMarker);
      window.location.replace("/member-dashboard.html");
    }
  });
}

// 所有使用 Firebase 的頁面都載入同一套登入相容處理，
// 讓 iPhone、iPad、Android 與桌機使用一致的 Email 判讀與登入狀態。
import("./auth-mobile-compat.js?v=20260803-mobile-login-1").catch((error) => {
  console.error("跨裝置登入相容模組載入失敗：", error);
});
