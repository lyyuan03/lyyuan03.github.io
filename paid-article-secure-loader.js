import { auth, db } from "./firebase-config.js";
import { resolveMemberAccess } from "./member-access-resolver.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const articleId = new URLSearchParams(location.search).get("id") || "";
const root = document.getElementById("article-root");
let currentUser = auth.currentUser;
let requestSerial = 0;
let metadataCache = null;
let hydrateScheduled = false;
let hydrateInFlight = false;
let hydratePending = false;
let paidBodyUnsubscribe = null;
let resolvedArticleDocId = articleId;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function sanitizeUnsafePaidContent(value = "") {
  return String(value || "")
    .replace(/!\[[^\]]*\]\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi, "")
    .replace(/\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi, "")
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+/gi, "")
    .replace(/(^|\n)\s*\[圖片待重新上傳\]\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*!\[\]\s*(?=\n|$)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
    return /^data:image/i.test(src) ? "" : '<img src="' + src + '" alt="' + alt + '">';
  });
}

function renderContent(value = "") {
  return sanitizeUnsafePaidContent(value)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${renderInline(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${renderInline(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${renderInline(trimmed.slice(2))}</h1>`;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) return `<figure>${renderInline(trimmed)}</figure>`;
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function paidView() {
  if (!articleId) return null;
  return document.querySelector(`.article-view[data-article-id="${CSS.escape(articleId)}"]`)
    || document.querySelector(".article-view");
}

async function paidMetadata() {
  if (metadataCache) return metadataCache;
  try {
    const direct = await getDoc(doc(db, "articles", articleId));
    if (direct.exists()) {
      resolvedArticleDocId = direct.id;
      metadataCache = direct.data() || {};
      return metadataCache;
    }

    // 前台網址通常使用 slug；Firestore 文件 ID 可能是自動產生的另一個值。
    // 找不到同名文件時，改以 slug 對應實際文件 ID，確保付費正文與後台同一筆資料。
    const slugSnapshot = await getDocs(query(collection(db, "articles"), where("slug", "==", articleId)));
    const match = slugSnapshot.docs[0];
    if (match) {
      resolvedArticleDocId = match.id;
      metadataCache = match.data() || {};
      return metadataCache;
    }

    metadataCache = {};
    return metadataCache;
  } catch (error) {
    console.warn("付費文章公開資訊暫時無法確認。", error);
    return null;
  }
}

function setSecureStatus(view, message = "") {
  let status = view.querySelector("[data-paid-secure-status]");
  if (!message) {
    status?.remove();
    return;
  }
  if (!status) {
    status = document.createElement("div");
    status.dataset.paidSecureStatus = "true";
    status.style.cssText = "margin:22px 0;padding:12px 16px;border:1px solid rgba(139,104,63,.2);color:#725D48;font-size:12px;text-align:center;background:rgba(255,255,255,.2)";
    const preview = view.querySelector(".article-body");
    preview?.after(status);
  }
  status.textContent = message;
}

function refreshToc(view) {
  const toc = view.querySelector(".article-toc");
  if (!toc) return;
  const headings = [...view.querySelectorAll(".article-body h2, .article-body h3")]
    .filter((heading) => heading.textContent.trim());
  headings.forEach((heading, index) => {
    heading.id = `article-section-${index + 1}`;
  });
  const list = toc.querySelector("ol");
  const count = toc.querySelector(".article-toc-toggle small");
  if (count) count.textContent = `共 ${headings.length} 節`;
  if (list) {
    list.innerHTML = headings.map((heading) =>
      `<li class="${heading.tagName === "H3" ? "is-sub" : ""}"><a href="#${heading.id}">${escapeHtml(heading.textContent.trim())}</a></li>`
    ).join("");
    list.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      toc.classList.remove("is-open");
      toc.querySelector(".article-toc-toggle")?.setAttribute("aria-expanded", "false");
    }));
  }
}

function insertPrivateBody(view, content, version, contentHash = "") {
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) return false;

  const existing = view.querySelector("[data-paid-private-body]");
  if (existing) {
    const nextVersion = String(version || 1);
    const nextHash = String(contentHash || "");
    const changed = existing.dataset.paidContentVersion !== nextVersion
      || (nextHash && existing.dataset.paidContentHash !== nextHash);

    if (changed) {
      existing.innerHTML = renderContent(normalizedContent);
      existing.dataset.paidContentVersion = nextVersion;
      existing.dataset.paidContentHash = nextHash;
      refreshToc(view);
      document.dispatchEvent(new CustomEvent("lyyuan:paid-article-loaded", {
        detail: { articleId, contentVersion: Number(version || 1) }
      }));
    }
    view.dataset.paidBodyState = "unlocked";
    return true;
  }

  const privateBody = document.createElement("div");
  privateBody.className = "article-body paid-private-body";
  privateBody.dataset.paidPrivateBody = "true";
  privateBody.dataset.paidContentVersion = String(version || 1);
  privateBody.dataset.paidContentHash = String(contentHash || "");
  privateBody.innerHTML = renderContent(normalizedContent);

  view.querySelectorAll(".article-paid-gate, [data-paid-gate-restored]").forEach((gate) => gate.remove());

  const anchor = view.querySelector(".next-reading, .recommended-book, .article-share");
  if (anchor) view.insertBefore(privateBody, anchor);
  else view.appendChild(privateBody);

  if (!view.querySelector("[data-paid-secure-unlocked]")) {
    const protectedMarker = document.createElement("span");
    protectedMarker.hidden = true;
    protectedMarker.className = "paid-lock-zone";
    protectedMarker.dataset.paidSecureUnlocked = "true";
    view.appendChild(protectedMarker);
  }
  view.dataset.paidSecureAccess = "granted";
  view.dataset.paidBodyState = "unlocked";
  setSecureStatus(view, "");
  refreshToc(view);
  document.dispatchEvent(new CustomEvent("lyyuan:paid-article-loaded", {
    detail: { articleId, contentVersion: Number(version || 1) }
  }));
  return true;
}

function ensurePaidBodyRealtimeSync() {
  if (paidBodyUnsubscribe || !articleId || !currentUser?.email) return;

  paidBodyUnsubscribe = onSnapshot(doc(db, "paidArticleBodies", resolvedArticleDocId || articleId), (snapshot) => {
    if (!snapshot.exists()) return;
    const view = paidView();
    if (!view || !view.isConnected) return;
    const body = snapshot.data() || {};
    const content = String(body.content || "").trim();
    if (!content) return;
    insertPrivateBody(
      view,
      content,
      body.contentVersion || 1,
      body.contentHash || ""
    );
  }, (error) => {
    console.warn("付費文章即時正文同步暫時無法使用。", error);
  });
}

async function hydratePaidBody() {
  if (!articleId || !currentUser?.email) return;
  const view = paidView();
  if (!view) return;

  const metadata = await paidMetadata() || {};
  const viewLooksEvent = metadata.accessType === "event"
    || view.dataset.articleAccess === "event"
    || Boolean(view.querySelector("[data-event-gate]"));
  const viewLooksPaid = !viewLooksEvent && (
    view.dataset.articleAccess === "paid"
    || Boolean(view.querySelector("[data-paid-gate-restored], .paid-lock-zone"))
  );
  const stillPaid = !viewLooksEvent
    && (metadata.accessType === "paid" || metadata.privatePaidContent === true || viewLooksPaid);

  if (!stillPaid) {
    if (paidBodyUnsubscribe) {
      paidBodyUnsubscribe();
      paidBodyUnsubscribe = null;
    }
    view.querySelector("[data-paid-private-body]")?.remove();
    view.dataset.paidBodyState = "";
    view.dataset.paidSecureAccess = "";
    return;
  }

  if (view.querySelector("[data-paid-private-body]")) {
    view.dataset.paidBodyState = "unlocked";
    ensurePaidBodyRealtimeSync();
    return;
  }

  const serial = ++requestSerial;
  view.dataset.paidBodyState = "loading";
  setSecureStatus(view, "正在確認閱讀資格…");

  const access = await resolveMemberAccess(currentUser);
  if (serial !== requestSerial || !view.isConnected) return;
  view.dataset.memberAccessSource = access.source || "none";
  if (!access.allowed) {
    view.dataset.paidSecureAccess = "denied";
    view.dataset.paidBodyState = "locked";
    setSecureStatus(view, "已登入，但此帳號目前沒有付費文章閱讀權限。靈極會員、已開通付費文章權限的養生一般會員，以及有效的贊助文章會員可閱讀全文。");
    return;
  }

  try {
    const snapshot = await getDoc(doc(db, "paidArticleBodies", resolvedArticleDocId || articleId));
    if (serial !== requestSerial || !view.isConnected) return;
    if (!snapshot.exists()) throw new Error("PAID_BODY_NOT_FOUND");
    const body = snapshot.data() || {};
    const content = String(body.content || "").trim();
    if (!content) throw new Error("EMPTY_PAID_BODY");
    insertPrivateBody(
      view,
      content,
      body.contentVersion || metadata.paidContentVersion || 1,
      body.contentHash || metadata.paidContentHash || ""
    );
    ensurePaidBodyRealtimeSync();
  } catch (error) {
    if (serial !== requestSerial || !view.isConnected) return;
    const code = String(error?.code || "");
    if (code.includes("unauthenticated")) {
      view.dataset.paidBodyState = "locked";
      setSecureStatus(view, "");
      return;
    }
    if (code.includes("permission-denied")) {
      view.dataset.paidBodyState = "locked";
      setSecureStatus(view, "已登入，但伺服器尚未同步此帳號的閱讀資格。系統會自動重新核對會員權限，請重新整理頁面後再試。");
      return;
    }
    console.error("付費文章安全正文載入失敗。", error);
    view.dataset.paidBodyState = "error";
    setSecureStatus(view, "閱讀資格暫時無法確認，請重新整理頁面；若權限已開通仍無法閱讀，再聯繫行政團隊。");
  }
}

function scheduleHydrate() {
  if (hydrateInFlight) {
    hydratePending = true;
    return;
  }
  if (hydrateScheduled) return;
  hydrateScheduled = true;
  queueMicrotask(async () => {
    hydrateScheduled = false;
    hydrateInFlight = true;
    try {
      await hydratePaidBody();
    } finally {
      hydrateInFlight = false;
      if (hydratePending) {
        hydratePending = false;
        scheduleHydrate();
      }
    }
  });
}

if (root && articleId) {
  const observer = new MutationObserver(scheduleHydrate);
  observer.observe(root, { childList: true });
}

onAuthStateChanged(auth, (user) => {
  if (paidBodyUnsubscribe) {
    paidBodyUnsubscribe();
    paidBodyUnsubscribe = null;
  }
  currentUser = user;
  requestSerial += 1;
  scheduleHydrate();
});

window.addEventListener("pageshow", scheduleHydrate);
document.addEventListener("lyyuan:article-rendered", () => {
  // 文章本體更新後重新讀取 accessType / paidContentVersion，
  // 避免沿用舊 metadata 造成前台仍顯示上一版狀態。
  metadataCache = null;
  scheduleHydrate();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleHydrate();
});
scheduleHydrate();
