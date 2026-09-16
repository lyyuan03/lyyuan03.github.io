const SITE_ORIGIN = "https://lyyuan.tw";
const NEED_A_TEACHER_THUMBNAIL_PATH = "/assets/articles/need-a-teacher/thumbnail.svg";
const NEED_A_TEACHER_THUMBNAIL_VERSION = "20260916-clean-4";

function cleanThumbnailUrl(value = "") {
  return String(value || "").trim().replace(/^<|>$/g, "");
}

function isDataOrBlobUrl(value = "") {
  return /^(?:data:|blob:)/i.test(value);
}

function isLyyuanHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host === "lyyuan.tw" || host === "www.lyyuan.tw";
}

export const NEED_A_TEACHER_THUMBNAIL_URL = `${SITE_ORIGIN}${NEED_A_TEACHER_THUMBNAIL_PATH}?v=${NEED_A_TEACHER_THUMBNAIL_VERSION}`;

function normalizedArticleTitle(value = "") {
  return String(value || "").replace(/[〈〉《》\s，,。！？?!：:]/g, "");
}

export function isNeedATeacherArticle(article = {}) {
  const id = String(article?.id || article?.slug || article?.__firestoreId || "").toLowerCase();
  const title = normalizedArticleTitle(article?.title || "");
  return id.includes("need-a-teacher") || title.includes("走靈修到底需不需要老師");
}

export function resolveThumbnailUrl(value = "") {
  const raw = cleanThumbnailUrl(value);
  if (!raw || isDataOrBlobUrl(raw)) return raw;

  try {
    const url = raw.startsWith("//")
      ? new URL(`https:${raw}`)
      : new URL(raw, `${SITE_ORIGIN}/`);

    if (isLyyuanHost(url.hostname)) {
      if (url.pathname === NEED_A_TEACHER_THUMBNAIL_PATH) {
        url.searchParams.set("v", NEED_A_TEACHER_THUMBNAIL_VERSION);
      }
      return `${SITE_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return raw;
  }
}

export function resolveArticleThumbnailUrl(article = {}, value = "") {
  if (isNeedATeacherArticle(article)) return NEED_A_TEACHER_THUMBNAIL_URL;
  return resolveThumbnailUrl(value);
}

export function classifyThumbnailUrl(value = "") {
  const raw = cleanThumbnailUrl(value);
  if (!raw) return "empty";
  if (isDataOrBlobUrl(raw)) return "embedded";

  const resolved = resolveThumbnailUrl(raw);
  try {
    const url = new URL(resolved);
    return isLyyuanHost(url.hostname) ? "internal" : "external";
  } catch {
    return "invalid";
  }
}

function firstMarkdownImage(content = "") {
  return String(content || "").match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] || "";
}

function adminPreviewFallbackFor(url = "") {
  const resolved = resolveThumbnailUrl(url);
  if (!resolved) return "";
  try {
    const parsed = new URL(resolved);
    if (parsed.pathname === "/assets/articles/channeling-ability-secrets-draft/00-photo-first-v3.jpg") {
      parsed.pathname = "/assets/articles/channeling-ability-secrets-draft/00-photo-first-v3.png";
      parsed.search = "?v=20260906-admin-preview-recovery-1";
      return parsed.href;
    }
  } catch {}
  return "";
}

function installAdminThumbnailPreviewRecovery() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!/\/admin\.html$/.test(window.location.pathname)) return;

  const attemptedByImage = new WeakMap();

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.id !== "thumbnail-preview-image") return;

    const current = resolveThumbnailUrl(image.currentSrc || image.src || "");
    const attempted = attemptedByImage.get(image) || new Set();
    if (current) attempted.add(current);

    const rawConfigured = document.getElementById("thumbnail-image")?.value || "";
    const coverImage = document.getElementById("coverImage")?.value || "";
    const content = document.getElementById("content")?.value || "";
    const candidates = [
      adminPreviewFallbackFor(current),
      resolveThumbnailUrl(rawConfigured),
      resolveThumbnailUrl(coverImage),
      resolveThumbnailUrl(firstMarkdownImage(content))
    ].filter((value, index, values) => value && values.indexOf(value) === index && !attempted.has(value));

    const fallback = candidates[0] || "";
    const status = document.getElementById("thumbnail-control-status");
    attemptedByImage.set(image, attempted);

    if (fallback) {
      image.hidden = false;
      image.src = fallback;
      if (status) {
        status.textContent = "原縮圖載入失敗，後台預覽已改用備援圖片；儲存值未更動";
        status.dataset.state = "error";
      }
      return;
    }

    if (status) {
      status.textContent = "縮圖預覽載入失敗，請檢查圖片網址";
      status.dataset.state = "error";
    }
  }, true);

  document.addEventListener("load", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.id !== "thumbnail-preview-image") return;
    attemptedByImage.delete(image);
  }, true);
}

installAdminThumbnailPreviewRecovery();

export { SITE_ORIGIN };
