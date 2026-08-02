import { auth, db, isAdminEmail } from "./firebase-config.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const SCALE_MIN = 100;
const SCALE_MAX = 300;
const PREVIEW_BACKGROUND = "#E8E1D3";

const DEFAULT_SETTINGS = {
  thumbnailFit: "cover",
  thumbnailPositionX: 50,
  thumbnailPositionY: 50,
  thumbnailScale: 100,
  thumbnailTitleAlign: "left",
  thumbnailImage: ""
};

const THUMBNAIL_SETTING_KEYS = [
  "thumbnailFit",
  "thumbnailPositionX",
  "thumbnailPositionY",
  "thumbnailScale",
  "thumbnailTitleAlign",
  "thumbnailImage"
];

const RECOVERY_SETTINGS = {
  "2026-guanyin-vow-lamp-record-v2": {
    thumbnailFit: "cover",
    thumbnailPositionX: 0,
    thumbnailPositionY: 5,
    thumbnailScale: 116,
    thumbnailTitleAlign: "left"
  },
  "reading-you-can-not-fear-death": {
    thumbnailFit: "cover",
    thumbnailPositionX: 50,
    thumbnailPositionY: 28,
    thumbnailScale: 218,
    thumbnailTitleAlign: "center"
  }
};

function numberValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSettings(source = {}, articleId = "") {
  const defaults = DEFAULT_SETTINGS;
  const thumbnailFit = source.thumbnailFit === "contain" ? "contain" : defaults.thumbnailFit;
  return {
    thumbnailFit,
    thumbnailPositionX: numberValue(source.thumbnailPositionX, defaults.thumbnailPositionX, 0, 100),
    thumbnailPositionY: numberValue(source.thumbnailPositionY, defaults.thumbnailPositionY, 0, 100),
    thumbnailScale: numberValue(source.thumbnailScale, defaults.thumbnailScale, SCALE_MIN, SCALE_MAX),
    thumbnailTitleAlign: source.thumbnailTitleAlign === "center" ? "center" : defaults.thumbnailTitleAlign,
    thumbnailImage: String(source.thumbnailImage || defaults.thumbnailImage || "").trim()
  };
}

function activeArticleId() {
  const id = document.querySelector("#article-list .article-item.is-active")?.dataset.id || "";
  return id === SETTINGS_DOC_ID ? "" : id;
}

function firstMarkdownImage(content = "") {
  return content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] || "";
}

function removeSystemArticleEntry() {
  document.querySelectorAll(`#article-list .article-item[data-id="${SETTINGS_DOC_ID}"]`).forEach((node) => node.remove());
}

function initialize() {
  const form = document.getElementById("article-form");
  const coverInput = document.getElementById("coverImage");
  const contentInput = document.getElementById("content");
  const titleInput = document.getElementById("title");
  const articleList = document.getElementById("article-list");
  if (!form || !coverInput || !contentInput || !articleList || document.getElementById("thumbnail-control-panel")) return;

  const coverField = coverInput.closest(".field");
  const panel = document.createElement("section");
  panel.id = "thumbnail-control-panel";
  panel.className = "thumbnail-control-panel";
  panel.innerHTML = `
    <div class="thumbnail-control-head">
      <div>
        <strong>文章列表縮圖</strong>
        <small>調整完成後，按下「儲存文章」會連同縮圖位置一起儲存；也可單獨按「儲存縮圖設定」。</small>
      </div>
      <span id="thumbnail-control-status" role="status" aria-live="polite">選擇文章後即可調整</span>
    </div>
    <div class="thumbnail-control-layout">
      <div class="thumbnail-control-fields">
        <div class="grid">
          <div class="field">
            <label for="thumbnail-fit">圖片顯示方式</label>
            <select id="thumbnail-fit">
              <option value="cover">裁切填滿</option>
              <option value="contain">完整顯示</option>
            </select>
          </div>
          <div class="field">
            <label for="thumbnail-title-align">卡片標題對齊</label>
            <select id="thumbnail-title-align">
              <option value="left">靠左</option>
              <option value="center">置中</option>
            </select>
          </div>
        </div>
        <div class="field thumbnail-range-field">
          <label for="thumbnail-position-x">水平位置 <output id="thumbnail-position-x-value">50%</output></label>
          <input id="thumbnail-position-x" type="range" min="0" max="100" step="1" value="50">
          <div class="thumbnail-range-labels"><span>左</span><span>中</span><span>右</span></div>
        </div>
        <div class="field thumbnail-range-field">
          <label for="thumbnail-position-y">垂直位置 <output id="thumbnail-position-y-value">50%</output></label>
          <input id="thumbnail-position-y" type="range" min="0" max="100" step="1" value="50">
          <div class="thumbnail-range-labels"><span>上</span><span>中</span><span>下</span></div>
        </div>
        <div class="field thumbnail-range-field">
          <label for="thumbnail-scale">放大比例 <output id="thumbnail-scale-value">100%</output></label>
          <input id="thumbnail-scale" type="range" min="100" max="300" step="1" value="100">
          <div class="thumbnail-range-labels"><span>原始顯示</span><span>放大</span><span>最大</span></div>
          <small class="thumbnail-scale-help">想看完整圖片，請選「完整顯示」；縮放不再低於 100%，避免圖片四周出現空白或黑邊。</small>
        </div>
        <div class="thumbnail-control-actions">
          <button id="thumbnail-use-first-image" class="btn" type="button">使用內文第一張圖</button>
          <button id="thumbnail-reset" class="btn" type="button">重設</button>
          <button id="thumbnail-save" class="btn primary" type="button">儲存縮圖設定</button>
        </div>
      </div>
      <div class="thumbnail-preview-wrap">
        <span>文章列表預覽</span>
        <div class="thumbnail-preview-media" id="thumbnail-preview-media"><img id="thumbnail-preview-image" alt="縮圖預覽"></div>
        <strong id="thumbnail-preview-title">文章標題</strong>
      </div>
    </div>
  `;
  coverField.insertAdjacentElement("afterend", panel);

  const style = document.createElement("style");
  style.id = "thumbnail-control-styles";
  style.textContent = `
    .thumbnail-control-panel{padding:17px;border:1px solid rgba(165,130,84,.3);background:rgba(165,130,84,.055);display:grid;gap:16px}
    .thumbnail-control-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
    .thumbnail-control-head strong{display:block;color:#CBAA77;font-family:var(--serif);font-size:16px;font-weight:500;letter-spacing:.1em}
    .thumbnail-control-head small{display:block;margin-top:4px;color:rgba(245,240,232,.5);font-size:11px;line-height:1.7}
    #thumbnail-control-status{font-size:11px;color:rgba(245,240,232,.55);white-space:nowrap}
    #thumbnail-control-status[data-state="success"]{color:#BFD39C}#thumbnail-control-status[data-state="error"]{color:#F1AAA2}#thumbnail-control-status[data-state="saving"]{color:#D8BD91}#thumbnail-control-status[data-state="dirty"]{color:#E3CEAA}
    .thumbnail-control-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:18px;align-items:start}
    .thumbnail-control-fields{display:grid;gap:13px}.thumbnail-range-field label{display:flex;justify-content:space-between}.thumbnail-range-field input{padding:0;border:0;background:transparent}
    .thumbnail-range-labels{display:flex;justify-content:space-between;font-size:10px;color:rgba(245,240,232,.38)}
    .thumbnail-scale-help{display:block;color:rgba(245,240,232,.46);font-size:10px;line-height:1.65}
    .thumbnail-control-actions{display:flex;gap:8px;flex-wrap:wrap}.thumbnail-control-actions .btn{padding:8px 11px;font-size:12px}
    .thumbnail-preview-wrap{padding:12px;border:1px solid rgba(165,130,84,.2);background:rgba(4,8,3,.34)}
    .thumbnail-preview-wrap>span{display:block;margin-bottom:8px;font-size:10px;color:rgba(245,240,232,.45);letter-spacing:.1em}
    .thumbnail-preview-media{position:relative;overflow:hidden;aspect-ratio:16/9;background:${PREVIEW_BACKGROUND}}
    .thumbnail-preview-media img{position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform}
    .thumbnail-preview-wrap>strong{display:block;margin-top:10px;font-family:var(--serif);font-size:14px;font-weight:500;line-height:1.55;color:#F5F0E8}
    @media(max-width:980px){.thumbnail-control-layout{grid-template-columns:1fr}.thumbnail-preview-wrap{max-width:360px}}
    @media(max-width:560px){.thumbnail-control-head{display:grid}.thumbnail-control-layout{gap:13px}}
  `;
  document.head.appendChild(style);

  const fitInput = panel.querySelector("#thumbnail-fit");
  const xInput = panel.querySelector("#thumbnail-position-x");
  const yInput = panel.querySelector("#thumbnail-position-y");
  const scaleInput = panel.querySelector("#thumbnail-scale");
  const alignInput = panel.querySelector("#thumbnail-title-align");
  const xValue = panel.querySelector("#thumbnail-position-x-value");
  const yValue = panel.querySelector("#thumbnail-position-y-value");
  const scaleValue = panel.querySelector("#thumbnail-scale-value");
  const previewMedia = panel.querySelector("#thumbnail-preview-media");
  const previewImage = panel.querySelector("#thumbnail-preview-image");
  const previewTitle = panel.querySelector("#thumbnail-preview-title");
  const status = panel.querySelector("#thumbnail-control-status");
  const saveButton = panel.querySelector("#thumbnail-save");
  let loadedId = "";
  let loadSerial = 0;
  let thumbnailDirty = false;

  function currentSettings(articleId = loadedId || activeArticleId()) {
    return normalizeSettings({
      thumbnailFit: fitInput.value,
      thumbnailPositionX: xInput.value,
      thumbnailPositionY: yInput.value,
      thumbnailScale: scaleInput.value,
      thumbnailTitleAlign: alignInput.value,
      thumbnailImage: coverInput.value.trim()
    }, articleId);
  }

  function applySettings(settings, articleId = loadedId || activeArticleId()) {
    const normalized = normalizeSettings(settings, articleId);
    fitInput.value = normalized.thumbnailFit;
    xInput.value = String(normalized.thumbnailPositionX);
    yInput.value = String(normalized.thumbnailPositionY);
    scaleInput.value = String(normalized.thumbnailScale);
    alignInput.value = normalized.thumbnailTitleAlign;
    if (normalized.thumbnailImage) coverInput.value = normalized.thumbnailImage;
    thumbnailDirty = false;
    updatePreview();
  }

  function updatePreview() {
    const settings = currentSettings();
    const position = `${settings.thumbnailPositionX}% ${settings.thumbnailPositionY}%`;
    xValue.value = `${settings.thumbnailPositionX}%`;
    yValue.value = `${settings.thumbnailPositionY}%`;
    scaleValue.value = `${settings.thumbnailScale}%`;
    previewImage.src = coverInput.value.trim() || "";
    previewImage.hidden = !previewImage.src;
    previewImage.style.objectFit = settings.thumbnailFit;
    previewImage.style.objectPosition = position;
    previewImage.style.transform = `scale(${settings.thumbnailScale / 100})`;
    previewImage.style.transformOrigin = position;
    previewMedia.style.background = PREVIEW_BACKGROUND;
    previewTitle.textContent = titleInput?.value.trim() || "文章標題";
    previewTitle.style.textAlign = settings.thumbnailTitleAlign;
  }

  function hasLegacySettings(source = {}) {
    return THUMBNAIL_SETTING_KEYS.some((key) => Object.prototype.hasOwnProperty.call(source, key));
  }

  async function writeSettings(articleId, saved) {
    await setDoc(doc(db, "articles", SETTINGS_DOC_ID), {
      title: "系統縮圖設定",
      slug: SETTINGS_DOC_ID,
      category: "system",
      status: "published",
      accessType: "system",
      content: "",
      excerpt: "",
      publishedAt: "2000-01-01T00:00:00.000Z",
      systemType: "article-thumbnail-settings",
      settings: { [articleId]: saved },
      settingsUpdatedAt: serverTimestamp()
    }, { merge: true });
  }

  async function persistSettings(articleId, { announce = true } = {}) {
    if (!articleId || !isAdminEmail(auth.currentUser?.email)) {
      throw new Error("請先選擇文章並確認管理員登入");
    }
    if (announce) {
      saveButton.disabled = true;
      status.textContent = "正在儲存縮圖設定…";
      status.dataset.state = "saving";
    }
    const saved = currentSettings(articleId);
    await writeSettings(articleId, saved);
    loadedId = articleId;
    applySettings(saved, articleId);
    status.textContent = announce ? "縮圖設定已儲存，前台會自動同步" : "縮圖設定已隨文章一併儲存";
    status.dataset.state = "success";
    return saved;
  }

  function markThumbnailDirty() {
    if (!loadedId && !activeArticleId()) return;
    thumbnailDirty = true;
    status.textContent = "縮圖位置已修改，按「儲存文章」即可一併儲存";
    status.dataset.state = "dirty";
  }

  async function loadForActiveArticle() {
    removeSystemArticleEntry();
    const articleId = activeArticleId();
    const serial = ++loadSerial;
    loadedId = articleId;
    if (!articleId) {
      applySettings(normalizeSettings());
      saveButton.disabled = true;
      status.textContent = "請先選擇文章";
      delete status.dataset.state;
      return;
    }
    saveButton.disabled = true;
    status.textContent = "正在讀取縮圖設定…";
    status.dataset.state = "saving";
    try {
      const [settingsSnapshot, articleSnapshot] = await Promise.all([
        getDoc(doc(db, "articles", SETTINGS_DOC_ID)),
        getDoc(doc(db, "articles", articleId))
      ]);
      if (serial !== loadSerial) return;
      const saved = settingsSnapshot.exists() ? settingsSnapshot.data().settings?.[articleId] : null;
      const fallback = articleSnapshot.exists() ? articleSnapshot.data() : {};
      const recovery = !saved && RECOVERY_SETTINGS[articleId]
        ? normalizeSettings({
            ...RECOVERY_SETTINGS[articleId],
            thumbnailImage: fallback.thumbnailImage || fallback.coverImage || ""
          }, articleId)
        : null;
      const legacy = !saved && !recovery && hasLegacySettings(fallback)
        ? normalizeSettings({
            ...fallback,
            thumbnailImage: fallback.thumbnailImage || fallback.coverImage || ""
          }, articleId)
        : null;
      const source = saved || recovery || legacy || {};
      const hadInvalidScale = Number(source?.thumbnailScale) < SCALE_MIN;
      if (legacy || recovery) await writeSettings(articleId, source);
      applySettings(source, articleId);
      status.textContent = hadInvalidScale
        ? "舊縮放比例低於 100%，已自動修正並儲存"
        : recovery ? "已依先前調整紀錄還原位置並儲存"
          : legacy ? "原本的縮圖位置已自動轉移並儲存"
            : saved ? "已載入縮圖設定" : "尚未設定縮圖，可直接調整";
      status.dataset.state = hadInvalidScale ? "error" : legacy || recovery ? "success" : "";
      if (!hadInvalidScale && !legacy && !recovery) delete status.dataset.state;
      saveButton.disabled = false;
    } catch (error) {
      console.error("縮圖設定載入失敗：", error);
      applySettings(normalizeSettings({}, articleId));
      status.textContent = "縮圖設定載入失敗";
      status.dataset.state = "error";
      saveButton.disabled = false;
    }
  }

  async function saveSettings(event) {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      await persistSettings(activeArticleId());
    } catch (error) {
      console.error("縮圖設定儲存失敗：", error);
      status.textContent = error?.message || "縮圖設定儲存失敗";
      status.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  }

  window.articleThumbnailAdmin = {
    saveForArticle(articleId, options = {}) {
      return persistSettings(articleId, options);
    },
    hasUnsavedChanges() {
      return thumbnailDirty;
    }
  };

  [xInput, yInput, scaleInput, alignInput].forEach((input) => {
    input.addEventListener("input", () => {
      updatePreview();
      markThumbnailDirty();
    });
    input.addEventListener("change", () => {
      updatePreview();
      markThumbnailDirty();
    });
  });
  [coverInput, titleInput].filter(Boolean).forEach((input) => {
    input.addEventListener("input", updatePreview);
    input.addEventListener("change", updatePreview);
  });
  coverInput.addEventListener("input", markThumbnailDirty);
  coverInput.addEventListener("change", markThumbnailDirty);

  fitInput.addEventListener("change", () => {
    scaleInput.value = "100";
    updatePreview();
    status.textContent = fitInput.value === "contain"
      ? "已切換為完整顯示；圖片會以 100% 顯示整張內容"
      : "已切換為裁切填滿；可從 100% 開始放大與調整位置";
    markThumbnailDirty();
  });

  panel.querySelector("#thumbnail-use-first-image").addEventListener("click", () => {
    const image = firstMarkdownImage(contentInput.value);
    if (!image) {
      status.textContent = "內文尚未找到圖片";
      status.dataset.state = "error";
      return;
    }
    coverInput.value = image;
    updatePreview();
    markThumbnailDirty();
  });

  panel.querySelector("#thumbnail-reset").addEventListener("click", () => {
    applySettings(normalizeSettings({ thumbnailImage: coverInput.value }, activeArticleId()), activeArticleId());
    markThumbnailDirty();
  });
  saveButton.addEventListener("click", saveSettings);

  articleList.addEventListener("click", () => window.setTimeout(loadForActiveArticle, 40));
  new MutationObserver(() => {
    removeSystemArticleEntry();
    const nextId = activeArticleId();
    if (nextId !== loadedId) window.setTimeout(loadForActiveArticle, 0);
  }).observe(articleList, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });

  form.addEventListener("reset", () => window.setTimeout(loadForActiveArticle, 0));
  removeSystemArticleEntry();
  updatePreview();
  loadForActiveArticle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
