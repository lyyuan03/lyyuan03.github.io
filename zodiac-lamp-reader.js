// 2027 丁未年生肖頁：點燈層專屬內容讀取。
// 權限完全交給 Firestore Rules（eventArticleBodies + memberEntitlements.permissions）判斷；
// 本檔不下載未授權內容，也不以 CSS 隱藏全文。只在本頁區塊 data-lamp-enabled="true" 時啟用。
// 文案來源：docs/dingwei-2027-exclusive-reading-copy.md（PR #443）。
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ZODIAC_KEYS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
const PERMISSION_PREFIX = "dingwei-2027-";

const COPY = {
  signedOut: {
    title: "登入閱讀年度點燈專屬內容",
    lines: ["此區內容提供已完成核帳並取得閱讀資格的信眾閱讀。", "請使用登記時指定的 Gmail 帳號登入。"],
    button: "使用 Gmail 登入"
  },
  noAccess: {
    title: "目前尚未開通閱讀資格",
    lines: [
      "系統尚未查得此帳號對應生肖的閱讀權限。",
      "若您已完成登記及匯款，請待靈元院行政核帳完成。若已收到開通通知，請確認登入帳號是否正確。"
    ]
  },
  otherZodiac: {
    title: "此生肖內容尚未開放閱讀",
    lines: ["您的帳號目前尚未取得本生肖的專屬閱讀資格。", "請返回您已開通的生肖頁面閱讀。"]
  },
  granted: {
    title: "年度點燈專屬解讀",
    lines: ["您的閱讀資格已確認。", "以下為靈元院 2027 丁未年所屬生肖專屬內容。"]
  },
  error: {
    title: "專屬內容暫時無法載入",
    lines: ["目前無法確認閱讀資格或取得文章內容，請稍後重新整理頁面。若持續發生，請與靈元院行政團隊聯繫。"]
  }
};

const root = document.querySelector("[data-lamp-reader]");
const zodiac = root?.dataset.zodiac;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paragraphs = (text) => String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

function render(state, { content = "", email = "" } = {}) {
  const copy = COPY[state];
  root.hidden = false;
  root.dataset.lampState = state;
  root.innerHTML = `
    <p class="zp-lock">${escapeHtml(copy.title)}</p>
    ${copy.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    ${email && (state === "noAccess" || state === "otherZodiac") ? `<p class="zp-lamp-account">目前登入：${escapeHtml(email)}</p>` : ""}
    ${copy.button ? `<button class="zp-lamp-login" type="button">${escapeHtml(copy.button)}</button>` : ""}
    ${state === "granted" ? `<div class="zp-lamp-body">${paragraphs(content)}</div>` : ""}`;
  root.querySelector(".zp-lamp-login")?.addEventListener("click", () => {
    document.querySelector("#member-login-button")?.click();
  });
}

async function hasOtherZodiacPermission(email) {
  try {
    const snapshot = await getDoc(doc(db, "memberEntitlements", email.toLowerCase()));
    const permissions = snapshot.exists() && Array.isArray(snapshot.data().permissions) ? snapshot.data().permissions : [];
    return permissions.some((p) => typeof p === "string" && p.startsWith(PERMISSION_PREFIX) && p !== PERMISSION_PREFIX + zodiac);
  } catch {
    return false; // 無法查得時只顯示中性說明，不臆測原因
  }
}

let serial = 0;
async function load(user) {
  const run = ++serial;
  if (!user) return render("signedOut");
  const email = user.email || "";
  try {
    const snapshot = await getDoc(doc(db, "eventArticleBodies", PERMISSION_PREFIX + zodiac));
    if (run !== serial) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    if (data && data.requiredPermission === PERMISSION_PREFIX + zodiac && data.active !== false) {
      return render("granted", { content: data.content });
    }
    return render("error");
  } catch (error) {
    if (run !== serial) return;
    if (error?.code !== "permission-denied") {
      console.warn("點燈專屬內容暫時無法載入。", error);
      return render("error");
    }
    const other = await hasOtherZodiacPermission(email);
    if (run !== serial) return;
    return render(other ? "otherZodiac" : "noAccess", { email });
  }
}

if (root && root.dataset.lampEnabled === "true" && ZODIAC_KEYS.includes(zodiac)) {
  onAuthStateChanged(auth, load);
}
