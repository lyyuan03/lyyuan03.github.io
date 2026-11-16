// 讀者在這台裝置上的閱讀紀錄。
// 只存在讀者自己的瀏覽器（localStorage），不傳到伺服器，也不與帳號綁定。
// 首頁「接續你的閱讀」依這份紀錄推薦文章。

const STORAGE_KEY = "lyyuan-reading-history-v1";
const MAX_ENTRIES = 60;

export function readHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // 無痕模式或儲存空間已滿時不記錄，不影響閱讀。
  }
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}

function recordVisit(id, depth) {
  const now = Date.now();
  const entries = readHistory();
  const existing = entries.find((entry) => entry.id === id);
  const next = {
    id,
    firstAt: existing?.firstAt || now,
    lastAt: now,
    depth: Math.max(existing?.depth || 0, Math.min(1, Math.round(depth * 100) / 100))
  };
  writeHistory([next, ...entries.filter((entry) => entry.id !== id)]);
}

function readingDepth() {
  const view = document.querySelector(".article-view");
  if (!view) return 0;
  const rect = view.getBoundingClientRect();
  if (rect.height <= 0) return 0;
  const seen = window.innerHeight - rect.top;
  return Math.max(0, Math.min(1, seen / rect.height));
}

function trackArticlePage() {
  const id = new URLSearchParams(window.location.search).get("id") || "";
  if (!id) return;

  let maxDepth = 0;
  let saveTimer = 0;
  let frame = 0;
  let armed = false;
  const save = () => {
    if (!armed) return;
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    recordVisit(id, maxDepth);
  };
  const scheduleSave = () => {
    if (!saveTimer) saveTimer = window.setTimeout(save, 3000);
  };
  const measure = () => {
    frame = 0;
    const depth = readingDepth();
    if (depth > maxDepth) {
      maxDepth = depth;
      scheduleSave();
    }
  };

  window.addEventListener("scroll", () => {
    if (!frame) frame = window.requestAnimationFrame(measure);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  window.addEventListener("pagehide", save);

  // 文章內容由核心非同步載入；停留數秒後才記為一次閱讀，避免誤點也被記錄。
  window.setTimeout(() => {
    armed = true;
    measure();
    save();
  }, 4000);
}

if (document.getElementById("article-root")) trackArticlePage();
