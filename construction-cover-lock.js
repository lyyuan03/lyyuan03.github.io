import { auth, db, isAdminEmail, normalizeEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PRIVATE_CONSTRUCTION_ARTICLE_IDS = new Set([
  "2026-building-patron-record",
  "2026-lineage-lamp-building-record"
]);

const ARTICLE_TITLES = new Map([
  ["2026-building-patron-record", "靈元院建院願心見證專頁－丙午建院功德主專屬"],
  ["2026-lineage-lamp-building-record", "靈元院建院願心見證專頁"]
]);

const PUBLIC_RECORD_ID = "2026-lineage-lamp-building-record";
const HERO_SRC = "images/dizhi-hero.jpg?v=20260822-cover-lock-1";
const HERO_ALT = "元神的呼喚｜一間靈修人專屬的靈修道院";
const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
const isPrivateConstructionArticle = PRIVATE_CONSTRUCTION_ARTICLE_IDS.has(activeId);
const root = document.getElementById("article-root");
let unlockInFlight = false;
let authorizedRenderSignature = "";

function bytesFromBase64(value = "") {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptEventContent(encryptedContent, iv, rawKey) {
  if (!encryptedContent || !iv || !rawKey) throw new Error("活動限定文章缺少解密資料");
  const key = await crypto.subtle.importKey(
    "raw",
    bytesFromBase64(rawKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromBase64(iv) },
    key,
    bytesFromBase64(encryptedContent)
  );
  return new TextDecoder().decode(decrypted);
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
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" decoding="async">');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

function renderContent(value = "") {
  return String(value || "")
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("### ")) return `<h3>${renderInline(text.slice(4))}</h3>`;
      if (text.startsWith("## ")) return `<h2>${renderInline(text.slice(3))}</h2>`;
      if (text.startsWith("# ")) return `<h1>${renderInline(text.slice(2))}</h1>`;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(text)) return `<figure>${renderInline(text)}</figure>`;
      return `<p>${renderInline(text).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function ensurePrivateRobotsMeta() {
  if (!isPrivateConstructionArticle) return;
  let meta = document.querySelector('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "robots";
    document.head.appendChild(meta);
  }
  meta.content = "noindex,nofollow,noarchive,nosnippet,noimageindex";
}

function removePrivateConstructionDiscovery() {
  PRIVATE_CONSTRUCTION_ARTICLE_IDS.forEach((id) => {
    document.querySelectorAll(`.article-card[data-article-id="${CSS.escape(id)}"]`).forEach((card) => card.remove());
    document.querySelectorAll(`a[href*="articles.html?id=${CSS.escape(id)}"], a[href*="id=${CSS.escape(id)}"]`).forEach((link) => {
      if (link.closest(`.article-view[data-article-id="${CSS.escape(id)}"]`)) return;
      link.closest(".next-reading")?.remove();
      link.closest(".article-card")?.remove();
    });
  });
}

function privateGateCopy(id) {
  if (id === "2026-building-patron-record") {
    return {
      title: "丙午建院功德主專屬",
      text: "本頁僅提供已登記並完成授權的建院功德主閱讀。請使用登記護持時所留的 Gmail 登入。"
    };
  }
  return {
    title: "法會點燈參與者限定",
    text: "本頁僅提供本次法會已登記並完成授權的點燈參與者閱讀。請使用登記點燈時所留的 Gmail 登入。"
  };
}

function renderEmailOnlyGate() {
  if (!isPrivateConstructionArticle || !root) return;
  if (root.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"][data-construction-authorized="true"]`)) return;
  const copy = privateGateCopy(activeId);
  const title = ARTICLE_TITLES.get(activeId) || copy.title;
  root.innerHTML = `<article class="article-view construction-record-view construction-private-locked" data-article-id="${escapeHtml(activeId)}">
    <a class="article-back" href="index.html">← 返回靈元院</a>
    <div class="article-meta">靈元院建院願心見證｜限定閱讀</div>
    <h2>${escapeHtml(title)}</h2>
    <section class="article-paid-gate construction-email-only-gate" aria-label="Email 授權限定閱讀">
      <strong>${copy.title}</strong>
      <p>${copy.text}</p>
      <button class="article-paid-login construction-private-login" type="button">使用授權 Gmail 登入</button>
    </section>
  </article>`;
  root.querySelector(".construction-private-login")?.addEventListener("click", () => {
    document.getElementById("member-login-button")?.click();
  });
}

async function resolveAuthorizedEventKey(article, user) {
  if (!user?.email || !article?.eventId) return "";
  if (isAdminEmail(user.email)) {
    const snapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
    return snapshot.exists() ? String(snapshot.data()?.keys?.[activeId] || "") : "";
  }

  const email = normalizeEmail(user.email);
  const snapshot = await getDoc(doc(db, "memberAccess", email));
  if (!snapshot.exists()) return "";
  const record = snapshot.data() || {};
  if (record.eventAccess?.[article.eventId]?.status !== "active") return "";
  return String(record.eventArticleKeys?.[activeId] || "");
}

function renderAuthorizedArticle(article, content) {
  if (!root) return;
  const title = ARTICLE_TITLES.get(activeId) || article.title || "靈元院建院願心見證專頁";
  const coverImage = activeId === PUBLIC_RECORD_ID ? HERO_SRC : (article.coverImage || "");
  const meta = activeId === "2026-building-patron-record"
    ? "靈元院建院紀錄｜總功德主限定"
    : "靈元院建院願心見證｜法會點燈參與者";
  const signature = `${activeId}:${String(article.updatedAt?.seconds || article.updatedAt || "")}:${content.length}`;
  if (authorizedRenderSignature === signature && root.querySelector('[data-construction-authorized="true"]')) return;
  authorizedRenderSignature = signature;

  root.innerHTML = `<article class="article-view construction-record-view" data-article-id="${escapeHtml(activeId)}" data-construction-authorized="true">
    <a class="article-back" href="index.html">← 返回靈元院</a>
    <div class="article-meta">${escapeHtml(meta)}</div>
    <h2>${escapeHtml(title)}</h2>
    ${coverImage ? `<img class="article-cover" src="${escapeHtml(coverImage)}" alt="${activeId === PUBLIC_RECORD_ID ? HERO_ALT : ""}">` : ""}
    <div class="article-body">${renderContent(content)}</div>
  </article>`;
  document.title = `${title} | 靈元院`;
  window.dispatchEvent(new CustomEvent("construction-private-article-unlocked", { detail: { articleId: activeId } }));
}

async function attemptAuthorizedUnlock(user = auth.currentUser) {
  if (!isPrivateConstructionArticle || !root || unlockInFlight) return false;
  if (!user?.email) {
    renderEmailOnlyGate();
    return false;
  }

  unlockInFlight = true;
  try {
    const snapshot = await getDoc(doc(db, "articles", activeId));
    if (!snapshot.exists()) {
      renderEmailOnlyGate();
      return false;
    }
    const article = { id: snapshot.id, ...snapshot.data() };
    if (!isAdminEmail(user.email) && article.status !== "published") {
      renderEmailOnlyGate();
      return false;
    }

    // 尚未加密的管理員草稿，也允許管理員直接預覽。
    if (isAdminEmail(user.email) && article.content && !article.encryptedContent) {
      renderAuthorizedArticle(article, String(article.content));
      return true;
    }

    const key = await resolveAuthorizedEventKey(article, user);
    if (!key) {
      renderEmailOnlyGate();
      return false;
    }

    // 舊版與新版活動文章曾分別使用 contentIv / eventIv；兩者都相容。
    const iv = article.contentIv || article.eventIv || "";
    const content = await decryptEventContent(article.encryptedContent, iv, key);
    renderAuthorizedArticle(article, content);
    return true;
  } catch (error) {
    console.warn("建院限定文章授權解密失敗：", error);
    renderEmailOnlyGate();
    return false;
  } finally {
    unlockInFlight = false;
  }
}

function installPrivateConstructionStyles() {
  if (document.getElementById("construction-private-article-style")) return;
  const style = document.createElement("style");
  style.id = "construction-private-article-style";
  style.textContent = `
    .construction-private-locked .article-cover,
    .construction-private-locked .article-body,
    .construction-private-locked .article-toc,
    .construction-private-locked .article-guide,
    .construction-private-locked .recommended-book,
    .construction-private-locked .next-reading,
    .construction-private-locked .article-share,
    .construction-private-locked .construction-record-confidential,
    .construction-private-locked .construction-latest-progress,
    .construction-private-locked .construction-extra-render{display:none!important}
    .construction-private-locked .construction-email-only-gate{display:block!important;margin:34px 0 8px!important;padding:38px 30px!important;text-align:center!important;border:1px solid rgba(139,104,63,.34)!important;background:rgba(165,130,84,.07)!important}
    .construction-private-locked .construction-email-only-gate strong{display:block;color:#604831;font-size:21px;margin-bottom:10px}
    .construction-private-locked .construction-email-only-gate p{max-width:590px;margin:0 auto 20px;color:#725D48;font-size:14px;line-height:1.9}
    .construction-private-locked .construction-private-login{border:0;background:#80623D;color:white;padding:11px 20px;cursor:pointer;font:inherit}
  `;
  document.head.appendChild(style);
}

function enforcePublicRecordCover() {
  if (activeId !== PUBLIC_RECORD_ID) return;
  const article = root?.querySelector(`.article-view[data-article-id="${CSS.escape(PUBLIC_RECORD_ID)}"][data-construction-authorized="true"]`);
  const cover = article?.querySelector(":scope > .article-cover");
  if (!cover) return;
  if (!/dizhi-hero\.jpg/i.test(cover.getAttribute("src") || "")) cover.setAttribute("src", HERO_SRC);
  cover.setAttribute("alt", HERO_ALT);
  cover.removeAttribute("srcset");
}

installPrivateConstructionStyles();
ensurePrivateRobotsMeta();
removePrivateConstructionDiscovery();

if (isPrivateConstructionArticle) {
  // 此兩頁只使用 Email 身分；移除舊 magic-link token，避免繞過 Email 權限。
  if (params.get("token")) {
    params.delete("token");
    params.delete("event");
    const cleanQuery = params.toString();
    location.replace(`${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${location.hash || ""}`);
  } else {
    renderEmailOnlyGate();
    void attemptAuthorizedUnlock(auth.currentUser);
    onAuthStateChanged(auth, (user) => void attemptAuthorizedUnlock(user));
  }
}

let scheduled = false;
const observer = new MutationObserver(() => {
  removePrivateConstructionDiscovery();
  if (!isPrivateConstructionArticle || scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const authorized = root?.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"][data-construction-authorized="true"]`);
    if (authorized) {
      enforcePublicRecordCover();
      return;
    }
    void attemptAuthorizedUnlock(auth.currentUser);
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

[120, 500, 1200, 2500, 5000].forEach((delay) => window.setTimeout(() => {
  removePrivateConstructionDiscovery();
  void attemptAuthorizedUnlock(auth.currentUser);
  enforcePublicRecordCover();
}, delay));

window.addEventListener("pageshow", () => {
  void attemptAuthorizedUnlock(auth.currentUser);
  enforcePublicRecordCover();
});
