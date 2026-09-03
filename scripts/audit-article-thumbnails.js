// 一次性唯讀掃描：列出 Firestore articles 中 thumbnailImage 為空值或外部網址的文章。
// 使用方式：先登入後台，再在瀏覽器 Console 執行：
// import("/scripts/audit-article-thumbnails.js?v=20260903-1")

import { auth, db, isAdminEmail } from "../firebase-config.js?v=20260831-permissions-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { classifyThumbnailUrl, resolveThumbnailUrl } from "../article-thumbnail-url.js?v=20260903-thumbnail-url-normalize-1";

const SYSTEM_ARTICLE_IDS = new Set(["__article-thumbnail-settings", "sponsor-offer-status"]);

function waitForAdminUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      if (user) resolve(user);
      else reject(new Error("請先登入文章後台，再執行縮圖掃描。"));
    }, reject);
  });
}

function compactArticle(item) {
  const data = item.data() || {};
  const raw = String(data.thumbnailImage || "").trim();
  return {
    id: item.id,
    title: String(data.title || "未命名文章"),
    status: String(data.status || ""),
    category: String(data.category || ""),
    thumbnailImage: raw,
    resolvedThumbnailImage: resolveThumbnailUrl(raw),
    type: classifyThumbnailUrl(raw)
  };
}

export async function auditArticleThumbnails() {
  const user = await waitForAdminUser();
  if (!isAdminEmail(user?.email)) {
    throw new Error("目前登入帳號沒有文章後台管理員權限。");
  }

  const snapshot = await getDocs(collection(db, "articles"));
  const rows = snapshot.docs
    .filter((item) => {
      const data = item.data() || {};
      return !SYSTEM_ARTICLE_IDS.has(item.id) && data.systemType !== "article-thumbnail-settings";
    })
    .map(compactArticle)
    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));

  const empty = rows.filter((item) => item.type === "empty");
  const external = rows.filter((item) => item.type === "external");
  const internal = rows.filter((item) => item.type === "internal");
  const invalid = rows.filter((item) => item.type === "invalid" || item.type === "embedded");

  const summary = {
    totalArticles: rows.length,
    emptyThumbnailImage: empty.length,
    externalThumbnailImage: external.length,
    internalThumbnailImage: internal.length,
    invalidOrEmbeddedThumbnailImage: invalid.length
  };

  console.group("文章 thumbnailImage 掃描結果");
  console.table([summary]);

  console.group(`空值：${empty.length} 篇`);
  console.table(empty.map(({ id, title, status, category, thumbnailImage }) => ({
    id, title, status, category, thumbnailImage
  })));
  console.groupEnd();

  console.group(`外部網站：${external.length} 篇`);
  console.table(external.map(({ id, title, status, category, thumbnailImage }) => ({
    id, title, status, category, thumbnailImage
  })));
  console.groupEnd();

  if (invalid.length) {
    console.group(`無法判讀／內嵌網址：${invalid.length} 篇`);
    console.table(invalid.map(({ id, title, status, category, thumbnailImage, type }) => ({
      id, title, status, category, thumbnailImage, type
    })));
    console.groupEnd();
  }

  console.groupEnd();

  const result = { summary, empty, external, internal, invalid, all: rows };
  if (typeof window !== "undefined") window.articleThumbnailAuditResult = result;
  return result;
}

auditArticleThumbnails().catch((error) => {
  console.error("文章縮圖掃描失敗：", error);
});
