import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const articleId = new URLSearchParams(location.search).get("id") || "";
const root = document.getElementById("article-root");
let currentUser = auth.currentUser;
let requestSerial = 0;
let metadataCache = null;
let hydrateScheduled = false;
let hydrateInFlight = false;
let hydratePending = false;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
}

function renderContent(value = "") {
  return String(value || "")
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
    const snapshot = await getDoc(doc(db, "articles", articleId));
    metadataCache = snapshot.exists() ? snapshot.data() || {} : {};
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

function insertPrivateBody(view, content, version) {
  if (view.querySelector("[data-paid-private-body]")) {
    view.dataset.paidBodyState = "unlocked";
    return true;
  }
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) return false;
  const privateBody = document.createElement("div");
  privateBody.className = "article-body paid-private-body";
  privateBody.dataset.paidPrivateBody = "true";
  privateBody.dataset.paidContentVersion = String(version || 1);
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

async function hydratePaidBody() {
  if (!articleId || !currentUser?.email) return;
  const view = paidView();
  if (!view) return;
  if (view.querySelector("[data-paid-private-body]")) {
    view.dataset.paidBodyState = "unlocked";
    return;
  }

  const metadata = await paidMetadata() || {};
  const viewLooksPaid = view.dataset.articleAccess === "paid"
    || Boolean(view.querySelector(".article-paid-gate, [data-paid-gate-restored], .paid-lock-zone"));
  if (metadata.accessType !== "paid" && metadata.privatePaidContent !== true && !viewLooksPaid) return;

  const serial = ++requestSerial;
  view.dataset.paidBodyState = "loading";
  setSecureStatus(view, "正在確認閱讀資格…");
  try {
    const snapshot = await getDoc(doc(db, "paidArticleBodies", articleId));
    if (serial !== requestSerial || !view.isConnected) return;
    if (!snapshot.exists()) throw new Error("PAID_BODY_NOT_FOUND");
    const body = snapshot.data() || {};
    const content = String(body.content || "").trim();
    if (!content) throw new Error("EMPTY_PAID_BODY");
    insertPrivateBody(view, content, body.contentVersion || metadata.paidContentVersion || 1);
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
      setSecureStatus(view, "已登入，但此帳號尚未開通贊助／會員文章閱讀資格。請確認使用付款或開通時的 Gmail，或重新整理後再試。");
      return;
    }
    console.error("付費文章安全正文載入失敗。", error);
    view.dataset.paidBodyState = "error";
    setSecureStatus(view, "閱讀資格暫時無法確認，請重新整理頁面；若付款已完成仍無法閱讀，再聯繫行政團隊。");
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
  currentUser = user;
  requestSerial += 1;
  scheduleHydrate();
});

window.addEventListener("pageshow", scheduleHydrate);
document.addEventListener("lyyuan:article-rendered", scheduleHydrate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleHydrate();
});
scheduleHydrate();
