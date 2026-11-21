// 丙午年．無極老母至尊聖誕福壽康寧祝壽懺儀｜懺儀完整內容讀取。
// 比照 2027 生肖頁（zodiac-lamp-reader.js）：權限完全交給 Firestore Rules
// （eventArticleBodies + memberEntitlements.permissions）判斷。公開頁面只含開頭到「緣起」；
// 「緣起」之後的全文只存在 eventArticleBodies/wuji-2026-chanyi，未開通者讀取會被規則拒絕，
// 本檔不下載未授權內容，也不以 CSS 隱藏全文。
// 開通方式：靈元院點燈管理後台「無極懺儀・收款確認」勾選收款確認後，
// 寫入 memberEntitlements/{gmail}.permissions 的 wuji-2026-chanyi，並寄送收款完成通知信。
import { auth, db, isAdminEmail } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_ID = "wuji-2026-chanyi";
const PERMISSION = "wuji-2026-chanyi";
const NETWORK_CODES = new Set(["unavailable", "deadline-exceeded", "resource-exhausted", "cancelled"]);

const COPY = {
  signedOut: {
    title: "登入閱讀懺儀完整內容",
    lines: ["此區內容提供已完成登記並經靈元院核帳確認的信眾閱讀。", "請使用登記時填寫的 Gmail 帳號登入。"],
    button: "使用 Gmail 登入"
  },
  authExpired: {
    title: "登入狀態已失效",
    lines: ["系統無法確認目前的登入狀態，請重新登入後再閱讀。"],
    button: "重新登入"
  },
  noAccess: {
    title: "目前尚未開通閱讀資格",
    lines: [
      "系統尚未查得此帳號的閱讀資格。",
      "若您已完成登記及匯款，請待靈元院行政核帳完成。若已收到收款完成通知信，請確認登入帳號是否為登記時填寫的 Gmail。"
    ]
  },
  notReady: {
    title: "懺儀完整內容尚未開放",
    lines: ["懺儀完整內容目前尚未開放閱讀，開放後即可在此頁登入閱讀。"]
  },
  granted: {
    title: "懺儀完整內容",
    lines: ["您的閱讀資格已確認。", "以下為丙午年．無極老母至尊聖誕福壽康寧祝壽懺儀完整內容。"]
  },
  adminPreview: {
    title: "管理員預覽｜懺儀完整內容",
    lines: ["以下內容只透過安全資料庫讀取，信眾須經收款確認開通後才能閱讀。"]
  },
  adminEmpty: {
    title: "尚未建立懺儀完整內容",
    lines: ["安全資料庫中查無本頁全文。"]
  },
  network: {
    title: "網路連線不穩定",
    lines: ["目前無法連線到閱讀資料庫，請確認網路後重新整理頁面。"],
    retry: "重新載入"
  },
  error: {
    title: "懺儀完整內容暫時無法載入",
    lines: ["目前無法確認閱讀資格或取得文章內容，請稍後重新整理頁面。若持續發生，請與靈元院行政團隊聯繫。"],
    retry: "重新載入"
  }
};

const root = document.querySelector("[data-chanyi-reader]");
const full = document.querySelector("[data-chanyi-full]");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// 全文為靈元院後台寫入的固定版面 HTML。為防萬一，只保留版面需要的標籤與屬性，
// 不允許任何腳本、事件屬性、樣式或外部資源。
const TAGS = new Set(["section", "div", "header", "article", "p", "h2", "h3", "h4", "span", "strong", "em", "b", "small", "br",
  "ul", "ol", "li", "dl", "dt", "dd", "figure", "figcaption", "blockquote", "a", "img", "svg", "path"]);
const ATTRS = new Set(["class", "id", "role", "alt", "loading", "width", "height", "viewbox", "d", "preserveaspectratio", "focusable", "data-register-link"]);
export function sanitize(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const walk = (node) => {
    for (const el of [...node.children]) {
      const tag = el.localName;
      if (!TAGS.has(tag)) { el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        const ok = ATTRS.has(name) || name.startsWith("aria-")
          || (name === "href" && tag === "a" && /^(\/(?!\/)|#|https:\/\/)/.test(value))
          || (name === "src" && tag === "img" && value.startsWith("/wuji-chanyi-2026/images/"));
        if (!ok) el.removeAttribute(attr.name);
      }
      walk(el);
    }
  };
  walk(tpl.content);
  return tpl.content;
}

function render(state, { content = "", email = "", meta = "" } = {}) {
  const copy = COPY[state];
  const reading = (state === "granted" || state === "adminPreview") && content.trim();
  root.hidden = false;
  root.dataset.chanyiState = state;
  root.innerHTML = `
    <p class="chanyi-gate__title">${escapeHtml(copy.title)}</p>
    ${copy.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    ${meta ? `<p class="chanyi-gate__account">${escapeHtml(meta)}</p>` : ""}
    ${email && state === "noAccess" ? `<p class="chanyi-gate__account">目前登入：${escapeHtml(email)}</p>` : ""}
    ${copy.button ? `<button class="btn btn--gold chanyi-login" type="button">${escapeHtml(copy.button)}</button>` : ""}
    ${copy.retry ? `<button class="btn btn--ghost chanyi-retry" type="button">${escapeHtml(copy.retry)}</button>` : ""}`;
  root.querySelector(".chanyi-login")?.addEventListener("click", () => document.querySelector("#member-login-button")?.click());
  root.querySelector(".chanyi-retry")?.addEventListener("click", () => load(auth.currentUser));
  document.body.classList.toggle("chanyi-granted", Boolean(reading));
  if (full) {
    full.replaceChildren();
    if (reading) full.appendChild(sanitize(content));
  }
  document.dispatchEvent(new CustomEvent("chanyi:content", { detail: { state } }));
}

let serial = 0;
async function load(user) {
  const run = ++serial;
  if (!user) return render("signedOut");
  const email = user.email || "";
  const admin = isAdminEmail(email);
  try {
    const snapshot = await getDoc(doc(db, "eventArticleBodies", ARTICLE_ID));
    if (run !== serial) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    if (admin) {
      if (!data) return render("adminEmpty");
      const meta = `資料狀態：${data.status || "未標註"}｜${data.active === false ? "已暫停對信眾開放" : "可供已開通者閱讀"}｜全文 ${String(data.content || "").length} 字元`;
      return render("adminPreview", { content: String(data.content || ""), meta });
    }
    if (data && data.requiredPermission === PERMISSION && data.status === "published" && data.active === true) {
      return render("granted", { content: String(data.content || "") });
    }
    return render("notReady");
  } catch (error) {
    if (run !== serial) return;
    const code = error?.code || "";
    if (code === "unauthenticated") return render("authExpired");
    if (NETWORK_CODES.has(code) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      console.warn("懺儀完整內容：網路連線失敗。", error);
      return render("network");
    }
    if (code !== "permission-denied") {
      console.warn("懺儀完整內容暫時無法載入。", error);
      return render("error");
    }
    // 文件不存在與沒有權限，在規則層同樣回傳 permission-denied，刻意不區分。
    return render("noAccess", { email });
  }
}

if (root && root.dataset.chanyiEnabled === "true") {
  onAuthStateChanged(auth, load);
}
