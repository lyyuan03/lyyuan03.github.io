// 2027 丁未年生肖頁：點燈層專屬內容讀取。
// 權限完全交給 Firestore Rules（eventArticleBodies + memberEntitlements.permissions）判斷；
// 本檔不下載未授權內容，也不以 CSS 隱藏全文。只在本頁區塊 data-lamp-enabled="true" 時啟用。
// 文案來源：docs/dingwei-2027-exclusive-reading-copy.md（PR #443）。
//
// 正文格式（純文字，管理頁不接受 HTML）：空行分段；「## 」章節標題；「### 」小節標題；
// 「> 」作者或審稿者標記的引言；成對的「**文字**」轉為粗體（與 articles-core 公開文章的
// 粗體排版一致），沒有成對出現的「*」一律保留原樣顯示，不猜測意思。章節標題含「流月／節氣」
// 時，其下的小節以節氣時間軸呈現；含「年度總結／結語／修行建議」時以總結版面呈現。
// 只改變版面，不增刪任何文字；本檔不接受原稿中的任何 HTML，一律先跳脫再比對 ** 標記。
// 渲染完成後發出 document 事件「zodiac:content」，供 zodiac-motion.js 重建目錄與章節進場。
import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ZODIAC_KEYS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
const PERMISSION_PREFIX = "dingwei-2027-";
const NETWORK_CODES = new Set(["unavailable", "deadline-exceeded", "resource-exhausted", "cancelled"]);

const COPY = {
  signedOut: {
    title: "登入閱讀年度點燈專屬內容",
    lines: ["此區內容提供已完成核帳並取得閱讀資格的信眾閱讀。", "請使用登記時指定的 Gmail 帳號登入。"],
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
      "若您已完成登記及匯款，請待靈元院行政核帳完成。若已收到開通通知，請確認登入帳號是否正確。"
    ]
  },
  otherZodiac: {
    title: "此生肖內容尚未開放閱讀",
    lines: ["您的帳號目前尚未開通本生肖的閱讀。", "若您已完成登記並經核帳確認，請與靈元院行政團隊聯繫。"]
  },
  notReady: {
    title: "本生肖專屬全文尚未開放",
    lines: ["本生肖的專屬全文目前尚未開放閱讀，開放後即可在此頁登入閱讀。"]
  },
  granted: {
    title: "年度點燈專屬解讀",
    lines: ["您的閱讀資格已確認。", "以下為靈元院 2027 丁未年十二生肖年度專屬全文。"]
  },
  adminPreview: {
    title: "管理員預覽｜尚未公開的生肖全文",
    lines: ["以下內容只透過安全資料庫讀取。管理帳號可查看未發布、暫停開放或已發布的私人正文。"]
  },
  adminEmpty: {
    title: "尚未建立此生肖的限定正文",
    lines: ["目前查無私人文章。請到生肖內容管理頁建立，再返回此頁閱讀。"]
  },
  network: {
    title: "網路連線不穩定",
    lines: ["目前無法連線到閱讀資料庫，請確認網路後重新整理頁面。"],
    retry: "重新載入"
  },
  error: {
    title: "專屬內容暫時無法載入",
    lines: ["目前無法確認閱讀資格或取得文章內容，請稍後重新整理頁面。若持續發生，請與靈元院行政團隊聯繫。"],
    retry: "重新載入"
  }
};

const root = document.querySelector("[data-lamp-reader]");
const zodiac = root?.dataset.zodiac;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// 粗體：對已完整跳脫的文字，只把「成對的 **文字**」換成 <strong>，不產生任何其他標籤或屬性，
// 也不會讓原稿中的 < > 等字元變成可執行的 HTML。單獨出現、沒有成對的 * 原樣保留。
const applyBold = (escaped) => escaped.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
const inlineText = (text) => applyBold(escapeHtml(text));
const inline = (text) => inlineText(text).replace(/\n/g, "<br>");

// 純文字 → 區塊。所有文字先跳脫，只產生固定的標籤，不接受任何 HTML。
export function parseBody(text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: "p", text: para.join("\n") }); para = []; } };
  for (const raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "quote") last.closed = true;
      continue;
    }
    if ((m = line.match(/^###\s+(.+)$/))) { flush(); blocks.push({ type: "h3", text: m[1] }); continue; }
    if ((m = line.match(/^##\s+(.+)$/))) { flush(); blocks.push({ type: "h2", text: m[1] }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "quote" && !last.closed) last.text += "\n" + m[1];
      else blocks.push({ type: "quote", text: m[1] });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === "quote") last.closed = true;
    para.push(line);
  }
  flush();
  return blocks.filter((b) => b.type !== "quote" || b.text.trim());
}

const MONTHS = /流月|節氣|月令/;
const SUMMARY = /年度總結|結語|修行建議/;

export function renderBody(text) {
  const blocks = parseBody(text);
  const sections = [{ h2: null, kind: "plain", items: [] }];
  for (const b of blocks) {
    if (b.type === "h2") sections.push({ h2: b.text, kind: MONTHS.test(b.text) ? "months" : SUMMARY.test(b.text) ? "summary" : "plain", items: [] });
    else sections[sections.length - 1].items.push(b);
  }
  let s = 0, m = 0;
  const block = (b) => b.type === "p" ? `<p>${inline(b.text)}</p>`
    : b.type === "quote" ? `<blockquote class="zr-quote"><p>${inline(b.text)}</p></blockquote>`
    : `<h3 id="zr-h${++m}">${inlineText(b.text)}</h3>`;
  return sections.map((sec) => {
    const head = sec.h2 ? `<h2 id="zr-s${++s}">${inlineText(sec.h2)}</h2>` : "";
    if (sec.kind !== "months") {
      const body = sec.items.map(block).join("");
      return sec.kind === "summary" ? `<section class="zr-summary">${head}${body}</section>` : head + body;
    }
    // 節氣時間軸：每個小節標題與其後段落為一個月份，順序與文字完全依原稿。
    const groups = [];
    const lead = [];
    for (const b of sec.items) {
      if (b.type === "h3") groups.push({ title: b.text, id: `zr-m${++m}`, items: [] });
      else (groups.length ? groups[groups.length - 1].items : lead).push(b);
    }
    const chips = groups.length > 1
      ? `<nav class="zr-month-nav" aria-label="月份段落"><ol>${groups.map((g) => {
          const short = g.title.split(/[｜|]/)[0].trim() || g.title; // 導覽只顯示「寅月」等前半段，標題本身不變
          return `<li><a href="#${g.id}" title="${escapeHtml(g.title)}">${escapeHtml(short)}</a></li>`;
        }).join("")}</ol></nav>`
      : "";
    const months = groups.map((g) => `<article class="zr-month"><h3 id="${g.id}">${inlineText(g.title)}</h3>${g.items.map(block).join("")}</article>`).join("");
    return `<section class="zr-months">${head}${lead.map(block).join("")}${chips}<div class="zr-timeline">${months}</div></section>`;
  }).join("");
}

function render(state, { content = "", email = "", meta = "" } = {}) {
  const copy = COPY[state];
  const reading = (state === "granted" || state === "adminPreview") && content.trim();
  root.hidden = false;
  root.dataset.lampState = state;
  root.innerHTML = `
    <div class="zr-gate">
      <p class="zp-lock">${escapeHtml(copy.title)}</p>
      ${copy.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      ${meta ? `<p class="zp-lamp-account">${escapeHtml(meta)}</p>` : ""}
      ${(state === "adminPreview" || state === "adminEmpty") ? `<p><a class="zp-lamp-editor-link" href="/admin-zodiac-lamp.html">管理與編輯十二生肖限定全文</a></p>` : ""}
      ${email && (state === "noAccess" || state === "otherZodiac") ? `<p class="zp-lamp-account">目前登入：${escapeHtml(email)}</p>` : ""}
      ${copy.button ? `<button class="zp-lamp-login" type="button">${escapeHtml(copy.button)}</button>` : ""}
      ${copy.retry ? `<button class="zp-lamp-login zp-lamp-retry" type="button">${escapeHtml(copy.retry)}</button>` : ""}
    </div>
    ${reading ? `<div class="zr-exclusive zp-lamp-body">${renderBody(content)}</div>` : ""}`;
  root.querySelector(".zp-lamp-login:not(.zp-lamp-retry)")?.addEventListener("click", () => {
    document.querySelector("#member-login-button")?.click();
  });
  root.querySelector(".zp-lamp-retry")?.addEventListener("click", () => load(auth.currentUser));
  document.dispatchEvent(new CustomEvent("zodiac:content", { detail: { state } }));
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
  const admin = isAdminEmail(email);
  try {
    const snapshot = await getDoc(doc(db, "eventArticleBodies", PERMISSION_PREFIX + zodiac));
    if (run !== serial) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    if (admin) {
      if (!data) return render("adminEmpty");
      const meta = `資料狀態：${data.status || "未標註"}｜${data.active === false ? "已暫停對信眾開放" : "可供有權限者閱讀"}｜正文 ${String(data.content || "").length} 字`;
      return render("adminPreview", { content: String(data.content || ""), meta });
    }
    if (data && data.requiredPermission === PERMISSION_PREFIX + zodiac && data.status === "published" && data.active === true) {
      return render("granted", { content: String(data.content || "") });
    }
    // 規則已允許讀取，但文件未標示為本生肖、已發布且開放：視為尚未開放，不顯示任何正文。
    return render("notReady");
  } catch (error) {
    if (run !== serial) return;
    const code = error?.code || "";
    if (code === "unauthenticated") return render("authExpired");
    if (NETWORK_CODES.has(code) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      console.warn("點燈專屬內容：網路連線失敗。", error);
      return render("network");
    }
    if (code !== "permission-denied") {
      console.warn("點燈專屬內容暫時無法載入。", error);
      return render("error");
    }
    // 對非管理員而言，「文件不存在」與「沒有權限」在規則層同樣回傳 permission-denied，
    // 刻意不區分，避免透露哪些生肖已建立正文。
    const other = await hasOtherZodiacPermission(email);
    if (run !== serial) return;
    return render(other ? "otherZodiac" : "noAccess", { email });
  }
}

if (root && root.dataset.lampEnabled === "true" && ZODIAC_KEYS.includes(zodiac)) {
  onAuthStateChanged(auth, load);
}
