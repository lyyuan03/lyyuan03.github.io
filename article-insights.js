// 文選統計：只觀察文章核心已發出的事件，不介入文章渲染或付費權限判斷。
import { auth, db, isAdminEmail } from "./firebase-config.js";
import { resolveMemberAccess } from "./member-access-resolver.js?v=20261122-grace-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const articleParam = new URLSearchParams(location.search).get("id");
const isArticlePage = location.pathname.endsWith("/articles.html") && Boolean(articleParam);
const progressMarks = [25, 50, 75, 90];
const sentViews = new Set();
const recordWrites = new Map();
let currentUser = null;
let memberTier = "guest";
let activeArticle = null;
let foregroundSince = performance.now();
let visibleDuration = 0;

function taipeiMonth(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit"
  }).format(date);
}

function trafficSource() {
  const params = new URLSearchParams(location.search);
  const hint = String(params.get("utm_source") || "").toLowerCase();
  let host = "";
  try { host = new URL(document.referrer).hostname.toLowerCase(); } catch {}
  const source = hint || host;
  if (/google/.test(source)) return "google";
  if (/facebook|fb\.|m\.facebook/.test(source)) return "facebook";
  if (/line\.|^line$|lineapp/.test(source)) return "line";
  if (/instagram|^ig$/.test(source)) return "instagram";
  if (/youtube|youtu\.be/.test(source)) return "youtube";
  return source ? "other" : "direct";
}

function expiryActive(value) {
  if (!value) return false;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

async function classifyMember(user) {
  if (!user) return "guest";
  if (isAdminEmail(user.email)) return "admin";
  try {
    const access = await resolveMemberAccess(user);
    if (!access.allowed) return "signed_in";
    if (access.source === "sponsor-fallback"
      || (access.entitlement?.sponsorArticleAccess === true && expiryActive(access.entitlement.sponsorExpiresAt))) {
      return "sponsor";
    }
    if (access.wellness?.memberLevel === "lingji" || access.entitlement?.lingjiAccess === true) return "lingji";
    return "wellness";
  } catch {
    return "signed_in";
  }
}

const authReady = new Promise((resolve) => {
  let first = true;
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    memberTier = await classifyMember(user);
    // Firebase UID 是內部識別碼；絕不傳送 Gmail、姓名、電話或私有正文。
    const identity = { member_tier: memberTier };
    if (user && memberTier !== "admin") identity.user_id = user.uid;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(identity);
    if (typeof window.gtag === "function") {
      window.gtag("set", { user_id: identity.user_id || null, member_tier: memberTier });
    }
    if (first) {
      first = false;
      resolve();
    }
  }, () => {
    if (first) {
      first = false;
      resolve();
    }
  });
});

function sendEvent(name, parameters) {
  const config = window.LYY_ANALYTICS_CONFIG || {};
  // GTM 讀取 dataLayer 自訂事件；直接安裝 GA4 時必須改用 gtag('event')。
  if (!config.gtmId && config.measurementId && typeof window.gtag === "function") {
    window.gtag("event", name, parameters);
  } else if (typeof window.lyyuanTrack === "function") {
    window.lyyuanTrack(name, parameters);
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...parameters });
  }
}

function readerDocument(articleId, articleDocId, user) {
  if (!/^[\w-]{1,120}$/.test(articleId) || !/^[\w-]{1,120}$/.test(articleDocId) || !user?.uid) return null;
  const month = taipeiMonth();
  return {
    key: `${month}:${user.uid}:${articleId}`,
    ref: doc(db, "articleMonthlyReaders", month, "readers", `${user.uid}__${articleId}`)
  };
}

async function ensureViewRecord(articleId, articleDocId, user) {
  if (!user || isAdminEmail(user.email)) return null;
  const record = readerDocument(articleId, articleDocId, user);
  if (!record) return null;
  if (!recordWrites.has(record.key)) {
    recordWrites.set(record.key, setDoc(record.ref, {
      uid: user.uid,
      articleId,
      articleDocId,
      source: trafficSource(),
      viewedAt: serverTimestamp()
    }).catch(() => {
      // 已存在的唯一閱讀紀錄不得覆寫；未部署新規則時也不影響文章閱讀。
    }));
  }
  await recordWrites.get(record.key);
  return record.ref;
}

async function markUnique(articleId, articleDocId, field, user) {
  const recordRef = await ensureViewRecord(articleId, articleDocId, user);
  if (!recordRef) return;
  try {
    await updateDoc(recordRef, { [field]: serverTimestamp() });
  } catch {
    // 已記錄過同一會員／文章／月份事件時，規則會拒絕重複計數。
  }
}

async function track(name, articleId, accessType, extra = {}) {
  const articleDocId = activeArticle?.id === articleId ? activeArticle.docId : articleId;
  await authReady;
  if (memberTier === "admin") return;
  const user = currentUser;
  sendEvent(name, {
    article_id: articleId,
    access_type: accessType,
    member_tier: memberTier,
    traffic_source: trafficSource(),
    ...extra
  });
  if (!user) return;
  if (name === "article_view") await ensureViewRecord(articleId, articleDocId, user);
  if (name === "paid_article_unlock") await markUnique(articleId, articleDocId, "unlockedAt", user);
  if (name === "article_read_progress" && extra.read_threshold === 90) {
    await markUnique(articleId, articleDocId, "completedAt", user);
  }
}

function visibleElapsedMs() {
  return visibleDuration + (document.hidden ? 0 : performance.now() - foregroundSince);
}

function trackProgress() {
  if (!activeArticle || document.hidden) return;
  const view = document.querySelector(".article-view");
  if (!view || view.dataset.articleId !== activeArticle.id) return;
  if (activeArticle.accessType === "paid" && view.dataset.paidSecureAccess !== "granted") return;
  const bodies = [...view.querySelectorAll(":scope > .article-body")]
    .filter((node) => !node.hidden && node.getBoundingClientRect().height > 0);
  if (!bodies.length) return;
  const first = bodies[0].getBoundingClientRect();
  const last = bodies[bodies.length - 1].getBoundingClientRect();
  const length = last.bottom - first.top;
  if (length <= 0) return;
  const percentage = Math.max(0, Math.min(100, Math.round(100 * (innerHeight - first.top) / length)));
  for (const mark of progressMarks) {
    if (percentage < mark || activeArticle.progress.has(mark)) continue;
    // 90% 需至少停留 15 秒，避免開頁後直接拉到底部就被當成讀完。
    if (mark === 90 && visibleElapsedMs() < 15000) continue;
    activeArticle.progress.add(mark);
    void track("article_read_progress", activeArticle.id, activeArticle.accessType, {
      read_threshold: mark
    });
  }
}

function initializeArticle(articleId, accessType, articleDocId = articleId) {
  const view = document.querySelector(".article-view");
  if (!view || !articleId || view.querySelector(".article-draft-notice")) return;
  if (!activeArticle || activeArticle.id !== articleId) {
    activeArticle = { id: articleId, docId: articleDocId, accessType, progress: new Set() };
    visibleDuration = 0;
    foregroundSince = performance.now();
    setTimeout(trackProgress, 15050);
  } else {
    activeArticle.accessType = accessType;
    if (articleDocId !== articleId) activeArticle.docId = articleDocId;
  }
  if (!sentViews.has(articleId)) {
    sentViews.add(articleId);
    void track("article_view", articleId, accessType);
  }
  trackProgress();
}

if (isArticlePage) {
  document.addEventListener("lyyuan:article-rendered", (event) => {
    initializeArticle(
      String(event.detail?.articleId || ""),
      String(event.detail?.accessType || "open"),
      String(event.detail?.articleDocId || event.detail?.articleId || "")
    );
  });
  document.addEventListener("lyyuan:paid-article-loaded", (event) => {
    const view = document.querySelector(".article-view");
    const articleId = String(event.detail?.articleId || "");
    if (!view || !articleId || view.dataset.paidSecureAccess !== "granted") return;
    initializeArticle(articleId, "paid", view.dataset.articleDocId || articleId);
    if (!activeArticle.unlocked) {
      activeArticle.unlocked = true;
      void track("paid_article_unlock", articleId, "paid");
    }
    trackProgress();
  });
  addEventListener("scroll", trackProgress, { passive: true });
  addEventListener("resize", trackProgress, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) visibleDuration += performance.now() - foregroundSince;
    else foregroundSince = performance.now();
    trackProgress();
  });
  // 兼容事件在本模組載入前就已發生的情況。
  const view = document.querySelector(".article-view");
  if (view?.dataset.articleId) {
    initializeArticle(view.dataset.articleId, view.dataset.articleAccess || "open", view.dataset.articleDocId || view.dataset.articleId);
    if (view.dataset.paidSecureAccess === "granted") {
      activeArticle.unlocked = true;
      void track("paid_article_unlock", view.dataset.articleId, "paid");
    }
  }
}
