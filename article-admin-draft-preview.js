import { auth, db, isAdminEmail } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js?v=20260828-yuanqin-clean-text-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = "lyyuan03@gmail.com";
const PAID_MARKER = "<!-- paid-only -->";
const root = document.getElementById("article-root");
const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
let currentUser = auth.currentUser;
let runSerial = 0;
let applying = false;
let scheduled = false;

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isPreviewAdmin(user = auth.currentUser || currentUser) {
  const email = normalizeEmail(user?.email);
  return email === ADMIN_EMAIL && isAdminEmail(email);
}

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
    .replaceAll(PAID_MARKER, "")
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

function articleTime(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortDrafts(a, b) {
  const diff = (articleTime(b.updatedAt) || articleTime(b.createdAt)) - (articleTime(a.updatedAt) || articleTime(a.createdAt));
  if (diff) return diff;
  return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant");
}

function firstInlineImage(content = "") {
  return String(content).match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] || "";
}

function draftImage(article = {}) {
  return article.thumbnailImage || article.coverImage || firstInlineImage(article.content) || "";
}

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

function accessLabel(article = {}) {
  if (article.accessType === "event" || article.eventId) return "活動限定";
  if (article.accessType === "paid" || String(article.content || "").includes(PAID_MARKER)) return "贊助專屬";
  return "免費閱讀";
}

function accessClass(article = {}) {
  if (article.accessType === "event" || article.eventId) return "event";
  if (article.accessType === "paid" || String(article.content || "").includes(PAID_MARKER)) return "paid";
  return "free";
}

function cardHtml(article) {
  const id = article.id || article.slug || article.__firestoreId || "";
  const image = draftImage(article);
  const category = categoryLabels[article.category] || "文選";
  const access = accessClass(article);
  const label = accessLabel(article);
  const excerpt = article.excerpt || "";
  return `
    <a class="article-card" data-article-id="${escapeHtml(id)}" data-admin-draft-preview-added="true" href="articles.html?id=${encodeURIComponent(id)}">
      <div class="article-card-media">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(article.title || "草稿文章")}" loading="lazy" decoding="async">` : '<div class="article-card-placeholder" aria-hidden="true">靈元院文選</div>'}
        <div class="article-card-media-gradient" aria-hidden="true"></div>
      </div>
      <div class="article-card-content">
        <div class="article-card-heading">
          <div class="article-meta">${escapeHtml(category)}</div>
          <span class="article-card-badges">
            <span class="article-access-badge is-draft">草稿預覽</span>
            <span class="article-access-badge is-${access}">${escapeHtml(label)}</span>
          </span>
        </div>
        <h2 class="article-list-title">${escapeHtml(article.title || "未命名文章")}</h2>
        ${excerpt ? `<p class="article-hook">${escapeHtml(excerpt)}</p>` : ""}
      </div>
    </a>`;
}

function bytesToBase64Bytes(value = "") {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptEventDraft(article) {
  if (!(article.accessType === "event" || article.eventId) || !article.encryptedContent) return article;
  const id = article.__firestoreId || article.id || article.slug;
  const keysSnapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
  const rawKey = keysSnapshot.exists() ? keysSnapshot.data()?.keys?.[id] || "" : "";
  const iv = article.eventIv || article.contentIv || "";
  if (!rawKey || !iv) return article;
  try {
    const key = await crypto.subtle.importKey("raw", bytesToBase64Bytes(rawKey), { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesToBase64Bytes(iv) },
      key,
      bytesToBase64Bytes(article.encryptedContent)
    );
    return { ...article, content: new TextDecoder().decode(decrypted) };
  } catch (error) {
    console.warn("管理者草稿活動文章解密失敗。", error);
    return article;
  }
}

async function hydratePaidDraft(article) {
  if (article.privatePaidContent !== true && article.accessType !== "paid") return article;
  const firestoreId = article.__firestoreId || article.id || article.slug;
  if (!firestoreId) return article;
  try {
    const snapshot = await getDoc(doc(db, "paidArticleBodies", firestoreId));
    if (!snapshot.exists()) return article;
    const privateContent = String(snapshot.data()?.content || "").trim();
    if (!privateContent) return article;
    const publicContent = String(article.content || "").replace(PAID_MARKER, "").trim();
    return { ...article, content: [publicContent, privateContent].filter(Boolean).join("\n\n") };
  } catch (error) {
    console.warn("管理者草稿付費正文載入失敗。", error);
    return article;
  }
}

async function loadDrafts() {
  const snapshot = await getDocs(collection(db, "articles"));
  const firestoreArticles = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    __firestoreId: item.id,
    __source: "firestore"
  }));

  const byIdentity = new Map();
  firestoreArticles.forEach((article) => {
    byIdentity.set(article.id, article);
    if (article.slug) byIdentity.set(article.slug, article);
  });

  const drafts = [];
  firestoreArticles.forEach((article) => {
    if (article.status !== "draft") return;
    if (article.systemRecord === true || article.systemType === "article-thumbnail-settings" || article.id === "__article-thumbnail-settings") return;
    drafts.push(article);
  });

  staticArticles.forEach((article) => {
    if (article.status !== "draft") return;
    const firestoreMatch = byIdentity.get(article.id) || (article.slug ? byIdentity.get(article.slug) : null);
    if (firestoreMatch) return;
    drafts.push({ ...article, __source: "static" });
  });

  const unique = new Map();
  drafts.forEach((article) => {
    const key = article.slug || article.id || article.__firestoreId;
    if (!key) return;
    unique.set(key, article);
  });

  const hydrated = [];
  for (const article of [...unique.values()].sort(sortDrafts)) {
    let next = await decryptEventDraft(article);
    next = await hydratePaidDraft(next);
    hydrated.push(next);
  }
  return hydrated;
}

function ensureBanner(count) {
  const main = root?.closest("main") || root?.parentElement;
  if (!main) return;
  let banner = document.getElementById("article-admin-draft-preview-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "article-admin-draft-preview-banner";
    banner.className = "article-admin-preview-summary";
    root.before(banner);
  }
  banner.dataset.draftCount = String(count);
  banner.innerHTML = `<strong>管理者預覽模式</strong>｜目前可見草稿 ${count} 篇｜僅 ${ADMIN_EMAIL} 可見`;
}

function removePreviewArtifacts() {
  document.getElementById("article-admin-draft-preview-banner")?.remove();
  document.querySelectorAll('[data-admin-draft-preview-added="true"]').forEach((node) => node.remove());
}

function matchingCard(article) {
  const identities = [article.id, article.slug, article.__firestoreId].filter(Boolean);
  for (const id of identities) {
    const exact = document.querySelector(`.article-card[data-article-id="${CSS.escape(String(id))}"]`);
    if (exact) return exact;
    const links = [...document.querySelectorAll("a.article-card[href*='articles.html?id=']")];
    const byHref = links.find((link) => {
      try {
        return identities.includes(new URL(link.href, location.href).searchParams.get("id"));
      } catch {
        return false;
      }
    });
    if (byHref) return byHref;
  }
  return null;
}

async function waitForGrid(serial) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (serial !== runSerial || !isPreviewAdmin()) return null;
    const grid = root?.querySelector(".article-grid");
    if (grid) return grid;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return null;
}

async function renderDraftList(drafts, serial) {
  const grid = await waitForGrid(serial);
  if (!grid || serial !== runSerial || !isPreviewAdmin()) return;

  applying = true;
  try {
    document.querySelectorAll('[data-admin-draft-preview-added="true"]').forEach((node) => node.remove());
    const fragment = document.createDocumentFragment();
    drafts.forEach((article) => {
      const existing = matchingCard(article);
      if (existing && existing.dataset.adminDraftPreviewAdded !== "true") existing.remove();
      const template = document.createElement("template");
      template.innerHTML = cardHtml(article).trim();
      fragment.appendChild(template.content.firstElementChild);
    });
    grid.prepend(fragment);
    ensureBanner(drafts.length);
    document.body.dataset.adminDraftPreview = "true";
  } finally {
    applying = false;
  }
}

async function findActiveDraft(drafts) {
  return drafts.find((article) => {
    const ids = [article.id, article.slug, article.__firestoreId].filter(Boolean).map(String);
    return ids.includes(String(activeId));
  }) || null;
}

function renderDraftDetail(article) {
  if (!root) return;
  const category = categoryLabels[article.category] || "文選";
  const image = article.coverImage || article.thumbnailImage || "";
  root.innerHTML = `
    <article class="article-view" data-article-id="${escapeHtml(article.id || article.slug || activeId)}" data-admin-draft-preview-detail="true">
      <a class="article-back" href="articles.html">← 返回全部文選</a>
      <div class="article-draft-notice"><strong>草稿預覽</strong>｜僅 ${ADMIN_EMAIL} 可見，尚未公開。</div>
      <div class="article-meta">${escapeHtml(category)}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${image ? `<img class="article-cover" src="${escapeHtml(image)}" alt="">` : ""}
      <div class="article-body">${renderContent(article.content || article.excerpt || "")}</div>
    </article>`;
  document.title = `${article.title || "草稿預覽"}｜靈元院文選`;
  ensureBanner(1);
  document.body.classList.add("is-article-detail");
  document.documentElement.classList.add("is-article-detail");
}

async function applyPreview() {
  const serial = ++runSerial;
  if (!isPreviewAdmin()) {
    removePreviewArtifacts();
    document.body.dataset.adminDraftPreview = "false";
    return;
  }

  try {
    const drafts = await loadDrafts();
    if (serial !== runSerial || !isPreviewAdmin()) return;
    if (activeId) {
      const draft = await findActiveDraft(drafts);
      if (draft) renderDraftDetail(draft);
      return;
    }
    await renderDraftList(drafts, serial);
  } catch (error) {
    console.error("管理者草稿預覽載入失敗。", error);
    ensureBanner(0);
    const banner = document.getElementById("article-admin-draft-preview-banner");
    if (banner) banner.innerHTML = "<strong>管理者預覽模式</strong>｜草稿載入失敗，請重新整理頁面。";
  }
}

function schedulePreview() {
  if (scheduled || applying) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    void applyPreview();
  }, 80);
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  schedulePreview();
});

if (root) {
  new MutationObserver(() => {
    if (!isPreviewAdmin() || applying) return;
    if (activeId) {
      if (!root.querySelector('[data-admin-draft-preview-detail="true"]')) schedulePreview();
      return;
    }
    const banner = document.getElementById("article-admin-draft-preview-banner");
    const expectedDrafts = Number(banner?.dataset?.draftCount || 0);
    const hasDraftCard = Boolean(root.querySelector('[data-admin-draft-preview-added="true"]'));
    if (root.querySelector(".article-grid") && (!banner || (expectedDrafts > 0 && !hasDraftCard))) schedulePreview();
  }).observe(root, { childList: true, subtree: true });
}

window.addEventListener("pageshow", schedulePreview);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") schedulePreview();
});

schedulePreview();
