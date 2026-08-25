import { auth, db, storage, isAdminEmail } from "./firebase-config.js";
import { doc, onSnapshot, serverTimestamp, setDoc } from "./firebase-config.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const MAX_IMAGES = 6;
const SCALE_MIN = 100;
const SCALE_MAX = 250;
const DEFAULTS = { positionX: 50, positionY: 50, scale: 100 };
let settingsByArticle = new Map();
let currentImages = [];
let activeId = "";
let selection = { start: 0, end: 0 };
let wrapperInstalled = false;

function clamp(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalize(item = {}) {
  return {
    src: String(item.src || "").trim(),
    alt: String(item.alt || "").trim(),
    positionX: clamp(item.positionX, DEFAULTS.positionX, 0, 100),
    positionY: clamp(item.positionY, DEFAULTS.positionY, 0, 100),
    scale: clamp(item.scale, DEFAULTS.scale, SCALE_MIN, SCALE_MAX)
  };
}

function articleId() {
  const id = document.querySelector("#article-list .article-item.is-active")?.dataset.id || "";
  return id === SETTINGS_DOC_ID ? "" : id;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function adminPreviewSrc(value = "") {
  const src = String(value || "").trim();
  if (!src) return "";
  if (/^(?:https?:|data:|blob:)/i.test(src) || src.startsWith("//")) return src;
  const cleaned = src.replace(/^(?:(?:\.\.\/)|(?:\.\/))+/, "").replace(/^\/+/, "");
  return `https://lyyuan.tw/${cleaned}`;
}

function parseImages(content = "") {
  const result = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let match;
  while ((match = re.exec(content)) && result.length < MAX_IMAGES) {
    result.push({ alt: match[1] || "", src: match[2] || "", full: match[0], start: match.index, end: match.index + match[0].length });
  }
  return result;
}

function syncImages(content, id = activeId || articleId()) {
  const saved = new Map((settingsByArticle.get(id)?.images || []).map(x => [x.src, normalize(x)]));
  const prior = new Map(currentImages.map(x => [x.src, x]));
  currentImages = parseImages(content).map(x => normalize({ ...x, ...(saved.get(x.src) || prior.get(x.src) || {}) }));
  return currentImages;
}

function record() {
  return {
    version: 1,
    ratio: "16:9",
    fit: "cover",
    maxImages: MAX_IMAGES,
    images: currentImages.slice(0, MAX_IMAGES).map(normalize)
  };
}

async function saveSettings(id = activeId || articleId(), announce = true) {
  const status = document.getElementById("inline-image-status");
  if (!id) {
    if (announce && status) {
      status.textContent = "新文章請直接按「儲存文章」，系統會同時建立圖片設定。";
      status.dataset.state = "error";
    }
    throw new Error("尚未建立文章 ID");
  }
  if (!isAdminEmail(auth.currentUser?.email)) throw new Error("管理員尚未登入");
  if (announce && status) {
    status.textContent = "正在儲存圖片設定…";
    status.dataset.state = "saving";
  }
  const next = record();
  await setDoc(doc(db, "articles", SETTINGS_DOC_ID), {
    inlineImageSettings: { [id]: next },
    inlineImageSettingsUpdatedAt: serverTimestamp()
  }, { merge: true });
  settingsByArticle.set(id, next);
  if (announce && status) {
    status.textContent = "圖片設定已儲存，前台會自動同步。";
    status.dataset.state = "success";
  }
  return next;
}

function rememberSelection(input) {
  selection.start = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
  selection.end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : input.value.length;
}

function dirty(form) {
  let marker = document.getElementById("inline-image-dirty-marker");
  if (!marker) {
    marker = document.createElement("input");
    marker.type = "hidden";
    marker.id = "inline-image-dirty-marker";
    form.appendChild(marker);
  }
  marker.value = String(Date.now());
  marker.dispatchEvent(new Event("input", { bubbles: true }));
}

function replaceContent(input, next, cursor) {
  input.value = next;
  input.focus();
  input.setSelectionRange(cursor, cursor);
  rememberSelection(input);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function render(panel, input, form) {
  activeId = articleId();
  // 文章正文圖片 Markdown 以管理員手動編輯內容為準。
  // 圖片管理器只讀取圖片與顯示設定，不得自動補回、換掉或依順序改寫圖片語法。
  syncImages(input.value, activeId);
  const list = panel.querySelector("#inline-image-list");
  const status = panel.querySelector("#inline-image-status");
  status.textContent = activeId
    ? `已偵測 ${currentImages.length}/${MAX_IMAGES} 張｜格式固定 16:9`
    : `新文章｜最多 ${MAX_IMAGES} 張｜首次儲存時自動建立設定`;
  delete status.dataset.state;

  list.innerHTML = Array.from({ length: MAX_IMAGES }, (_, i) => {
    const image = currentImages[i];
    if (!image) return `<section class="inline-image-card is-empty"><div class="inline-image-head"><strong>圖 ${i + 1}</strong><span>尚未上傳</span></div><div class="inline-image-empty">先在文章內文點選插入位置，再按「上傳內文圖片」。</div></section>`;
    const pos = `${image.positionX}% ${image.positionY}%`;
    return `<section class="inline-image-card" data-index="${i}">
      <div class="inline-image-head"><strong>圖 ${i + 1}</strong><span>固定 16:9｜裁切填滿</span></div>
      <div class="inline-image-preview"><img src="${esc(adminPreviewSrc(image.src))}" alt="${esc(image.alt)}" style="object-position:${pos};transform:scale(${image.scale / 100});transform-origin:${pos}"></div>
      <div class="inline-image-controls">
        <label>水平位置 <output data-out="x">${image.positionX}%</output><input data-key="x" type="range" min="0" max="100" value="${image.positionX}"></label><div class="inline-labels"><span>左</span><span>中</span><span>右</span></div>
        <label>垂直位置 <output data-out="y">${image.positionY}%</output><input data-key="y" type="range" min="0" max="100" value="${image.positionY}"></label><div class="inline-labels"><span>上</span><span>中</span><span>下</span></div>
        <label>放大比例 <output data-out="scale">${image.scale}%</output><input data-key="scale" type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" value="${image.scale}"></label><div class="inline-labels"><span>100%</span><span>放大</span><span>${SCALE_MAX}%</span></div>
      </div>
      <div class="inline-image-actions"><button class="btn" type="button" data-action="move">移到目前游標位置</button><button class="btn" type="button" data-action="reset">重設</button><button class="btn danger" type="button" data-action="remove">移除</button></div>
    </section>`;
  }).join("");

  list.querySelectorAll(".inline-image-card[data-index]").forEach(card => {
    const index = Number(card.dataset.index);
    const preview = card.querySelector("img");
    const refresh = () => {
      const image = currentImages[index];
      if (!image) return;
      const pos = `${image.positionX}% ${image.positionY}%`;
      preview.style.objectPosition = pos;
      preview.style.transform = `scale(${image.scale / 100})`;
      preview.style.transformOrigin = pos;
      card.querySelector('[data-out="x"]').value = `${image.positionX}%`;
      card.querySelector('[data-out="y"]').value = `${image.positionY}%`;
      card.querySelector('[data-out="scale"]').value = `${image.scale}%`;
    };
    card.querySelectorAll("input[type=range]").forEach(control => control.addEventListener("input", () => {
      const image = currentImages[index];
      if (!image) return;
      if (control.dataset.key === "x") image.positionX = clamp(control.value, 50, 0, 100);
      if (control.dataset.key === "y") image.positionY = clamp(control.value, 50, 0, 100);
      if (control.dataset.key === "scale") image.scale = clamp(control.value, 100, SCALE_MIN, SCALE_MAX);
      refresh();
      status.textContent = "圖片位置已修改，按「儲存文章」即可一併儲存。";
      status.dataset.state = "dirty";
      dirty(form);
    }));
    card.querySelector('[data-action="reset"]').addEventListener("click", () => {
      currentImages[index] = normalize({ ...currentImages[index], ...DEFAULTS });
      render(panel, input, form);
      dirty(form);
    });
    card.querySelector('[data-action="remove"]').addEventListener("click", () => {
      const parsed = parseImages(input.value);
      const target = parsed[index];
      if (!target) return;
      const before = input.value.slice(0, target.start).replace(/\n{3,}$/g, "\n\n");
      const after = input.value.slice(target.end).replace(/^\n{3,}/g, "\n\n");
      replaceContent(input, before + after, Math.min(before.length, (before + after).length));
      render(panel, input, form);
    });
    card.querySelector('[data-action="move"]').addEventListener("click", () => {
      const parsed = parseImages(input.value);
      const target = parsed[index];
      if (!target) return;
      let insertion = Math.min(selection.start, input.value.length);
      const without = input.value.slice(0, target.start) + input.value.slice(target.end);
      if (target.start < insertion) insertion = Math.max(0, insertion - (target.end - target.start));
      const block = `\n\n${target.full}\n\n`;
      const next = without.slice(0, insertion) + block + without.slice(insertion);
      replaceContent(input, next, insertion + block.length);
      render(panel, input, form);
      status.textContent = `圖 ${index + 1} 已移到游標位置，尚未儲存。`;
      status.dataset.state = "dirty";
    });
  });
}

function styles() {
  if (document.getElementById("inline-image-control-styles")) return;
  const style = document.createElement("style");
  style.id = "inline-image-control-styles";
  style.textContent = `
  .inline-image-control-panel{display:grid;gap:15px;padding:17px;border:1px solid rgba(165,130,84,.3);background:rgba(165,130,84,.055)}
  .inline-image-control-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.inline-image-control-head strong{display:block;color:#CBAA77;font-family:var(--serif);font-size:16px;font-weight:500;letter-spacing:.1em}.inline-image-control-head small{display:block;margin-top:4px;color:rgba(245,240,232,.5);font-size:11px;line-height:1.7}#inline-image-status{font-size:11px;color:rgba(245,240,232,.55);text-align:right}#inline-image-status[data-state="dirty"]{color:#E3CEAA}#inline-image-status[data-state="saving"]{color:#D8BD91}#inline-image-status[data-state="success"]{color:#BFD39C}#inline-image-status[data-state="error"]{color:#F1AAA2}
  .inline-image-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.inline-image-card{display:grid;align-content:start;gap:10px;padding:12px;border:1px solid rgba(165,130,84,.22);background:rgba(4,8,3,.34)}.inline-image-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.inline-image-head strong{color:#D8BD91;font-size:13px}.inline-image-head span{font-size:9px;color:rgba(245,240,232,.42)}
  .inline-image-preview{position:relative;overflow:hidden;aspect-ratio:16/9;background:#E8E1D3}.inline-image-preview img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;will-change:transform}.inline-image-controls{display:grid;gap:4px}.inline-image-controls label{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:10px;color:rgba(245,240,232,.66)}.inline-image-controls label input{grid-column:1/-1;padding:0;border:0;background:transparent}.inline-image-controls output{color:#CBAA77}.inline-labels{display:flex;justify-content:space-between;margin-top:-3px;font-size:9px;color:rgba(245,240,232,.34)}
  .inline-image-actions{display:flex;gap:6px;flex-wrap:wrap}.inline-image-actions .btn{padding:6px 8px;font-size:10px}.inline-image-empty{display:flex;align-items:center;justify-content:center;min-height:150px;padding:16px;border:1px dashed rgba(165,130,84,.2);color:rgba(245,240,232,.4);font-size:11px;line-height:1.8;text-align:center}.inline-image-panel-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.inline-image-lock-note{font-size:10px;color:rgba(245,240,232,.44)}
  @media(max-width:1050px){.inline-image-list{grid-template-columns:1fr}}@media(max-width:620px){.inline-image-control-head{display:grid}#inline-image-status{text-align:left}}
  `;
  document.head.appendChild(style);
}

async function upload(file, input, panel, form, imageInput, button, status) {
  if (!file?.type?.startsWith("image/")) return;
  if (!auth.currentUser || !isAdminEmail(auth.currentUser.email)) return;
  const count = parseImages(input.value).length;
  if (count >= MAX_IMAGES) {
    status.textContent = `每篇文章最多 ${MAX_IMAGES} 張內文圖片；請先移除一張。`;
    imageInput.value = "";
    return;
  }
  button.disabled = true;
  status.textContent = `正在上傳圖 ${count + 1}/${MAX_IMAGES}…`;
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = articleId() || "draft";
    const imageRef = ref(storage, `articles/${key}/${Date.now()}-${safeName}`);
    await uploadBytes(imageRef, file, { contentType: file.type, customMetadata: { uploadedBy: auth.currentUser.email || "", articleId: key, usage: "article-inline-image" } });
    const url = await getDownloadURL(imageRef);
    const start = Math.min(selection.start, input.value.length);
    const end = Math.min(selection.end, input.value.length);
    const block = `\n\n![${file.name}](${url})\n\n`;
    replaceContent(input, input.value.slice(0, start) + block + input.value.slice(end), start + block.length);
    render(panel, input, form);
    status.textContent = `已插入圖 ${count + 1}｜調整位置後按「儲存文章」。`;
  } catch (error) {
    console.error("內文圖片上傳失敗：", error);
    status.textContent = "圖片上傳失敗，請確認網路或管理員權限。";
  } finally {
    button.disabled = false;
    imageInput.value = "";
  }
}

function installSaveWrapper() {
  if (wrapperInstalled || typeof window.articleThumbnailAdmin?.saveForArticle !== "function") return false;
  const original = window.articleThumbnailAdmin.saveForArticle.bind(window.articleThumbnailAdmin);
  window.articleThumbnailAdmin.saveForArticle = async (id, options = {}) => {
    const result = await original(id, options);
    await saveSettings(id, false);
    return result;
  };
  wrapperInstalled = true;
  return true;
}

function init() {
  const form = document.getElementById("article-form");
  const input = document.getElementById("content");
  const field = input?.closest(".field");
  const list = document.getElementById("article-list");
  const uploadButton = document.getElementById("upload-image");
  const imageInput = document.getElementById("image-input");
  const uploadStatus = document.getElementById("upload-status");
  if (!form || !input || !field || !list || !uploadButton || !imageInput || !uploadStatus || document.getElementById("inline-image-control-panel")) return;

  styles();
  imageInput.removeAttribute("multiple");
  uploadButton.textContent = "上傳內文圖片";
  uploadStatus.textContent = `最多 ${MAX_IMAGES} 張；先把游標點在文章想插圖的位置，每次上傳 1 張。`;

  const panel = document.createElement("section");
  panel.id = "inline-image-control-panel";
  panel.className = "inline-image-control-panel";
  panel.innerHTML = `<div class="inline-image-control-head"><div><strong>文章內文圖片</strong><small>每篇最多 ${MAX_IMAGES} 張。版型固定為 16:9、裁切填滿；只需調整左右、上下與放大比例，所有圖片尺寸會保持一致。</small></div><span id="inline-image-status" role="status" aria-live="polite"></span></div><div id="inline-image-list" class="inline-image-list"></div><div class="inline-image-panel-actions"><span class="inline-image-lock-note">固定：16:9｜100% 文章寬度｜cover 裁切｜最多 ${MAX_IMAGES} 張</span><button id="inline-image-save" class="btn primary" type="button">儲存圖片設定</button></div>`;
  field.insertAdjacentElement("afterend", panel);

  ["click","keyup","select","focus","blur"].forEach(name => input.addEventListener(name, () => rememberSelection(input)));
  input.addEventListener("input", () => setTimeout(() => render(panel, input, form), 0));
  imageInput.addEventListener("change", event => {
    event.stopImmediatePropagation();
    const file = imageInput.files?.[0];
    if (file) upload(file, input, panel, form, imageInput, uploadButton, uploadStatus);
  }, true);
  panel.querySelector("#inline-image-save").addEventListener("click", () => saveSettings().catch(console.error));
  list.addEventListener("click", () => setTimeout(() => render(panel, input, form), 50));
  new MutationObserver(() => {
    const next = articleId();
    if (next !== activeId) setTimeout(() => render(panel, input, form), 0);
  }).observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

  onSnapshot(doc(db, "articles", SETTINGS_DOC_ID), snapshot => {
    settingsByArticle = new Map(Object.entries(snapshot.exists() ? snapshot.data().inlineImageSettings || {} : {}));
    render(panel, input, form);
  }, error => console.warn("內文圖片設定同步失敗：", error));

  rememberSelection(input);
  render(panel, input, form);
  if (!installSaveWrapper()) {
    const timer = setInterval(() => { if (installSaveWrapper()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 5000);
  }
  window.articleInlineImageAdmin = { saveForArticle: (id, options = {}) => saveSettings(id, options.announce !== false), refresh: () => render(panel, input, form) };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
