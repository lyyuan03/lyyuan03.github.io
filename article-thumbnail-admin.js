import { auth, db, isAdminEmail } from "./firebase-config.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_SETTINGS = {
  thumbnailFit: "cover",
  thumbnailPositionX: 50,
  thumbnailPositionY: 50,
  thumbnailScale: 100,
  thumbnailTitleAlign: "left"
};

const ARTICLE_DEFAULTS = {
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
  const defaults = { ...DEFAULT_SETTINGS, ...(ARTICLE_DEFAULTS[articleId] || {}) };
  return {
    thumbnailFit: source.thumbnailFit === "contain" ? "contain" : defaults.thumbnailFit,
    thumbnailPositionX: numberValue(source.thumbnailPositionX, defaults.thumbnailPositionX, 0, 100),
    thumbnailPositionY: numberValue(source.thumbnailPositionY, defaults.thumbnailPositionY, 0, 100),
    thumbnailScale: numberValue(source.thumbnailScale, defaults.thumbnailScale, 50, 300),
    thumbnailTitleAlign: source.thumbnailTitleAlign === "center" ? "center" : defaults.thumbnailTitleAlign
  };
}

function activeArticleId() {
  return document.querySelector("#article-list .article-item.is-active")?.dataset.id || "";
}

function firstMarkdownImage(content = "") {
  return content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] || "";
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
        <small>可選擇完整顯示或裁切填滿，並調整書名與主體所在位置。</small>
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
          <label for="thumbnail-scale">縮放比例 <output id="thumbnail-scale-value">100%</output></label>
          <input id="thumbnail-scale" type="range" min="50" max="300" step="1" value="100">
          <div class="thumbnail-range-labels"><span>縮小</span><span>原始</span><span>放大</span></div>
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
    #thumbnail-control-status[data-state="success"]{color:#BFD39C}#thumbnail-control-status[data-state="error"]{color:#F1AAA2}#thumbnail-control-status[data-state="saving"]{color:#D8BD91}
    .thumbnail-control-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:18px;align-items:start}
    .thumbnail-control-fields{display:grid;gap:13px}.thumbnail-range-field label{display:flex;justify-content:space-between}.thumbnail-range-field input{padding:0;border:0;background:transparent}
    .thumbnail-range-labels{display:flex;justify-content:space-between;font-size:10px;color:rgba(245,240,232,.38)}
    .thumbnail-control-actions{display:flex;gap:8px;flex-wrap:wrap}.thumbnail-control-actions .btn{padding:8px 11px;font-size:12px}
    .thumbnail-preview-wrap{padding:12px;border:1px solid rgba(165,130,84,.2);background:rgba(4,8,3,.34)}
    .thumbnail-preview-wrap>span{display:block;margin-bottom:8px;font-size:10px;color:rgba(245,240,232,.45);letter-spacing:.1em}
    .thumbnail-preview-media{position:relative;overflow:hidden;aspect-ratio:16/9;background:#EEE9DF}
    .thumbnail-preview-media img{position:absolute;inset:0;width:100%;height:100%;display:block}
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

  function currentSettings() {
    return normalizeSettings({
      thumbnailFit: fitInput.value,
      thumbnailPositionX: xInput.value,
      thumbnailPositionY: yInput.value,
      thumbnailScale: scaleInput.value,
      thumbnailTitleAlign: alignInput.value
    }, loadedId || activeArticleId());
  }

  function applySettings(settings) {
    fitInput.value = settings.thumbnailFit;
    xInput.value = String(settings.thumbnailPositionX);
    yInput.value = String(settings.thumbnailPositionY);
    scaleInput.value = String(settings.thumbnailScale);
    alignInput.value = settings.thumbnailTitleAlign;
    updatePreview();
  }

  function updatePreview() {
    const settings = currentSettings();
    xValue.value = `${settings.thumbnailPositionX}%`;
    yValue.value = `${settings.thumbnailPositionY}%`;
    scaleValue.value = `${settings.thumbnailScale}%`;
    previewImage.src = coverInput.value.trim() || "";
    previewImage.hidden = !previewImage.src;
    previewImage.style.objectFit = settings.thumbnailFit;
    previewImage.style.objectPosition = `${settings.thumbnailPositionX}% ${settings.thumbnailPositionY}%`;
    previewImage.style.transform = `scale(${settings.thumbnailScale / 100})`;
    previewImage.style.transformOrigin = "center";
    previewMedia.style.background = settings.thumbnailFit === "contain" ? "#EEE9DF" : "rgba(7,17,6,.7)";
    previewTitle.textContent = titleInput?.value.trim() || "文章標題";
    previewTitle.style.textAlign = settings.thumbnailTitleAlign;
  }

  async function loadForActiveArticle() {
    const articleId = activeArticleId();
    const serial = ++loadSerial;
    loadedId = articleId;
    if (!articleId) {
      applySettings(normalizeSettings());
      saveButton.disabled = true;
      status.textContent = "請先選擇或儲存文章";
      delete status.dataset.state;
      return;
    }
    saveButton.disabled = true;
    status.textContent = "正在讀取縮圖設定…";
    status.dataset.state = "saving";
    try {
      const snapshot = await getDoc(doc(db, "articles", articleId));
      if (serial !== loadSerial) return;
      if (!snapshot.exists()) {
        applySettings(normalizeSettings({}, articleId));
        status.textContent = "請先按「匯入後台編輯」";
        status.dataset.state = "error";
        return;
      }
      applySettings(normalizeSettings(snapshot.data(), articleId));
      status.textContent = "可直接調整並儲存";
      delete status.dataset.state;
      saveButton.disabled = false;
    } catch (error) {
      console.error("縮圖設定載入失敗：", error);
      status.textContent = "縮圖設定載入失敗";
      status.dataset.state = "error";
    }
  }

  async function saveSettings() {
    const articleId = activeArticleId();
    if (!articleId || !isAdminEmail(auth.currentUser?.email)) {
      status.textContent = "請先選擇文章並確認管理員登入";
      status.dataset.state = "error";
      return;
    }
    saveButton.disabled = true;
    status.textContent = "正在儲存縮圖設定…";
    status.dataset.state = "saving";
    try {
      const articleRef = doc(db, "articles", articleId);
      const snapshot = await getDoc(articleRef);
      if (!snapshot.exists()) throw new Error("文章尚未匯入後台");
      await setDoc(articleRef, {
        ...currentSettings(),
        coverImage: coverInput.value.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      status.textContent = "縮圖設定已儲存";
      status.dataset.state = "success";
      window.setTimeout(() => {
        if (status.dataset.state === "success") {
          status.textContent = "可繼續調整";
          delete status.dataset.state;
        }
      }, 3000);
    } catch (error) {
      console.error("縮圖設定儲存失敗：", error);
      status.textContent = error.message === "文章尚未匯入後台" ? "請先匯入後台編輯" : "縮圖設定儲存失敗";
      status.dataset.state = "error";
    } finally {
      saveButton.disabled = false;
    }
  }

  [fitInput, xInput, yInput, scaleInput, alignInput, coverInput, titleInput].filter(Boolean).forEach((input) => {
    input.addEventListener("input", updatePreview);
    input.addEventListener("change", updatePreview);
  });

  panel.querySelector("#thumbnail-use-first-image").addEventListener("click", () => {
    const image = firstMarkdownImage(contentInput.value);
    if (!image) {
      status.textContent = "內文尚未找到圖片";
      status.dataset.state = "error";
      return;
    }
    coverInput.value = image;
    coverInput.dispatchEvent(new Event("input", { bubbles: true }));
    status.textContent = "已帶入內文第一張圖，請儲存文章與縮圖設定";
    delete status.dataset.state;
  });

  panel.querySelector("#thumbnail-reset").addEventListener("click", () => {
    applySettings(normalizeSettings({}, activeArticleId()));
    status.textContent = "已重設為預設位置，尚未儲存";
    delete status.dataset.state;
  });
  saveButton.addEventListener("click", saveSettings);

  articleList.addEventListener("click", () => window.setTimeout(loadForActiveArticle, 0));
  new MutationObserver(() => {
    const nextId = activeArticleId();
    if (nextId !== loadedId) loadForActiveArticle();
  }).observe(articleList, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });

  form.addEventListener("reset", () => window.setTimeout(loadForActiveArticle, 0));
  updatePreview();
  loadForActiveArticle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
