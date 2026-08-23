import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHtml, formatTaipeiDateTime, safeWebUrl, toDate } from "./member-offers-core.js?v=20260812-2";

const OFFER_DOC_PREFIX = "__member-offer__";
let currentOfferId = "";
let currentOffer = null;
let offerCache = [];

function addStyle() {
  if (document.getElementById("member-offer-admin-style")) return;
  const style = document.createElement("style");
  style.id = "member-offer-admin-style";
  style.textContent = `.offer-admin-layout{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(520px,1.28fr);gap:20px;padding:22px}.offer-admin-list{display:grid;gap:8px;max-height:760px;overflow:auto}.offer-admin-item{width:100%;padding:13px;text-align:left;border:1px solid rgba(165,130,84,.18);background:rgba(165,130,84,.035);color:#F5F0E8;cursor:pointer}.offer-admin-item:hover,.offer-admin-item.is-active{background:rgba(165,130,84,.13);border-color:rgba(165,130,84,.42)}.offer-admin-item strong{display:block;font-size:13px}.offer-admin-item small{display:block;margin-top:4px;color:rgba(245,240,232,.5);font-size:10px}.offer-admin-form{display:grid;gap:14px}.offer-admin-phases{display:grid;gap:12px}.offer-phase-admin{padding:15px;border:1px solid rgba(165,130,84,.22);background:rgba(165,130,84,.04)}.offer-phase-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.offer-phase-head strong{color:#D8BD91;font-family:var(--serif);font-weight:500}.offer-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.offer-role-option{display:flex;gap:7px;align-items:flex-start;padding:9px;border:1px solid rgba(165,130,84,.18);font-size:11px;color:rgba(245,240,232,.7)}.offer-role-option input{width:auto;margin-top:3px}.offer-time-24{display:grid;grid-template-columns:minmax(150px,1fr) 92px 92px;gap:8px}.offer-time-24 select{font-variant-numeric:tabular-nums}.offer-time-label{display:block;margin-bottom:7px;font-size:13px;color:rgba(245,240,232,.72)}.offer-admin-note{padding:12px;border-left:2px solid #A58254;background:rgba(165,130,84,.06);font-size:11px;color:rgba(245,240,232,.58)}.offer-admin-save{position:sticky;bottom:10px;z-index:10;display:flex;gap:9px;flex-wrap:wrap;padding:12px;border:1px solid rgba(165,130,84,.3);background:rgba(7,17,6,.96)}@media(max-width:900px){.offer-admin-layout{grid-template-columns:1fr;padding:16px}.offer-role-grid{grid-template-columns:1fr}.offer-time-24{grid-template-columns:1fr 1fr}.offer-time-24 input[type=date]{grid-column:1/-1}}`;
  document.head.appendChild(style);
}

function hourOptions(selected = "00") {
  return Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
    .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value} 時</option>`).join("");
}

function minuteOptions(selected = "00") {
  return Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"))
    .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value} 分</option>`).join("");
}

function datePartsTaipei(value) {
  const date = toDate(value);
  if (!date) return { date: "", hour: "00", minute: "00" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parts.hour, minute: parts.minute };
}

function taipeiPartsToDate(dateValue, hourValue, minuteValue) {
  const date = String(dateValue || "").trim();
  const hour = String(hourValue || "00").padStart(2, "0");
  const minute = String(minuteValue || "00").padStart(2, "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}$/.test(hour) || !/^\d{2}$/.test(minute)) return null;
  const parsed = new Date(`${date}T${hour}:${minute}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function installPanel() {
  if (document.getElementById("member-offer-management")) return;
  addStyle();
  const topActions = document.querySelector(".top-actions");
  if (topActions) {
    const button = document.createElement("a");
    button.className = "btn";
    button.href = "#member-offer-management";
    button.textContent = "會員優惠";
    const videoLink = [...topActions.querySelectorAll("a")].find((a) => a.getAttribute("href") === "#member-video-management");
    if (videoLink) topActions.insertBefore(button, videoLink); else topActions.appendChild(button);
  }

  const panel = document.createElement("section");
  panel.id = "member-offer-management";
  panel.className = "panel membership-panel";
  panel.innerHTML = `<div class="panel-head"><h2>會員專屬優惠活動</h2><span id="member-offer-admin-status" class="status" aria-live="polite"></span></div><div class="offer-admin-layout"><div class="membership-card"><div class="top-actions" style="justify-content:space-between;margin-bottom:14px"><h3 style="margin:0">活動列表</h3><button id="member-offer-new" class="btn" type="button">新增活動</button></div><div id="member-offer-list" class="offer-admin-list"><div class="empty">載入中…</div></div></div><div class="membership-card"><h3>活動設定</h3><form id="member-offer-form" class="offer-admin-form" onsubmit="return false;"><div class="grid"><div class="field"><label for="member-offer-title">活動名稱</label><input id="member-offer-title" required></div><div class="field"><label for="member-offer-status">發布狀態</label><select id="member-offer-status"><option value="draft">草稿</option><option value="published">發布</option></select></div></div><div class="field"><label for="member-offer-summary">活動摘要</label><input id="member-offer-summary" placeholder="會員列表卡片的一句重點"></div><div class="field"><label for="member-offer-description">活動說明</label><textarea id="member-offer-description" style="min-height:120px"></textarea></div><div class="grid"><div class="field"><label for="member-offer-image">活動圖片網址</label><input id="member-offer-image" type="url" placeholder="https://..."></div><div class="field"><span class="offer-time-label">活動截止時間（台灣時間｜24 小時制）</span><div class="offer-time-24"><input id="member-offer-end-date" type="date" required><select id="member-offer-end-hour" aria-label="截止小時">${hourOptions("23")}</select><select id="member-offer-end-minute" aria-label="截止分鐘">${minuteOptions("59")}</select></div></div></div><div class="grid"><div class="field"><label for="member-offer-visibility">未符合目前資格時的顯示方式</label><select id="member-offer-visibility"><option value="schedule">顯示活動與自己的開放日期</option><option value="locked">顯示活動，但鎖住入口</option><option value="hide">完全不顯示</option></select></div><label class="check-field"><input id="member-offer-limited" type="checkbox"><span><strong>限量活動</strong><small>勾選後可顯示名額／數量</small></span></label></div><div id="member-offer-quota-field" class="field" hidden><label for="member-offer-quota">限量名額／數量</label><input id="member-offer-quota" type="number" min="1" step="1"></div><div class="membership-subsection"><div class="membership-subsection-head"><strong>開放資格與階段</strong><small>可新增任意階段；時間一律使用 00:00–23:59</small></div><div id="member-offer-phases" class="offer-admin-phases"></div><button id="member-offer-add-phase" class="btn" type="button">＋ 新增開放階段</button></div><div class="offer-admin-note">此版本不再依賴新的 Firebase Functions 部署。會員前台直接使用既有登入資料判斷會員身份，再讀取已發布的活動設定。請注意：訂購／報名網址屬前端資料，熟悉開發者工具的人理論上仍可能查到網址，因此不適合用於高度機密內容。</div><div class="offer-admin-save"><button id="member-offer-save" class="btn primary" type="button">儲存活動</button><button id="member-offer-reset" class="btn" type="button">清除</button><button id="member-offer-delete" class="btn danger" type="button" hidden>刪除活動</button></div></form></div></div>`;
  document.querySelector(".admin-main")?.appendChild(panel);
}

function setStatus(message, state = "") {
  const element = document.getElementById("member-offer-admin-status");
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
}

function phaseId() {
  return globalThis.crypto?.randomUUID
    ? `phase-${globalThis.crypto.randomUUID().slice(0, 8)}`
    : `phase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function roleOptions(selected = []) {
  return [
    ["wellness_general", "養生療癒｜一般會員"],
    ["wellness_lingji", "養生療癒｜靈極會員"],
    ["article_paid", "贊助專屬文章付費會員"]
  ].map(([value, label]) => `<label class="offer-role-option"><input type="checkbox" data-offer-role="${value}" ${selected.includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("");
}

function addPhase(data = {}) {
  const container = document.getElementById("member-offer-phases");
  if (!container) return;
  const parts = datePartsTaipei(data.startsAt);
  const card = document.createElement("section");
  card.className = "offer-phase-admin";
  card.dataset.phaseId = data.id || phaseId();
  card.innerHTML = `<div class="offer-phase-head"><strong>開放階段</strong><button class="btn danger" type="button" data-remove-phase>移除此階段</button></div><div class="grid"><div class="field"><label>階段名稱</label><input data-phase-name value="${escapeHtml(data.name || "")}" placeholder="例：養生會員優先預購"></div><div class="field"><span class="offer-time-label">開始時間（台灣時間｜24 小時制）</span><div class="offer-time-24"><input data-phase-date type="date" value="${escapeHtml(parts.date)}" required><select data-phase-hour aria-label="開始小時">${hourOptions(parts.hour)}</select><select data-phase-minute aria-label="開始分鐘">${minuteOptions(parts.minute)}</select></div></div></div><div class="field"><label>本階段開放會員</label><div class="offer-role-grid">${roleOptions(data.allowedTypes || [])}</div></div><div class="grid"><div class="field"><label>按鈕文字</label><input data-action-label value="${escapeHtml(data.actionLabel || "立即參加")}" placeholder="立即訂購"></div><div class="field"><label>訂購／報名網址</label><input data-action-url type="url" value="${escapeHtml(data.actionUrl || "")}" placeholder="https://..."></div></div>`;
  container.appendChild(card);
}

function resetForm() {
  currentOfferId = "";
  currentOffer = null;
  ["member-offer-title", "member-offer-summary", "member-offer-description", "member-offer-image", "member-offer-quota", "member-offer-end-date"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });
  document.getElementById("member-offer-end-hour").value = "23";
  document.getElementById("member-offer-end-minute").value = "59";
  document.getElementById("member-offer-status").value = "draft";
  document.getElementById("member-offer-visibility").value = "schedule";
  document.getElementById("member-offer-limited").checked = false;
  document.getElementById("member-offer-quota-field").hidden = true;
  document.getElementById("member-offer-phases").innerHTML = "";
  addPhase({ name: "第一階段", actionLabel: "立即參加", allowedTypes: ["wellness_general", "wellness_lingji"] });
  document.getElementById("member-offer-delete").hidden = true;
  document.querySelectorAll(".offer-admin-item").forEach((item) => item.classList.remove("is-active"));
  setStatus("新增活動模式");
}

function loadOffer(id) {
  const offer = offerCache.find((item) => item.offerId === id);
  if (!offer) return;
  currentOfferId = id;
  currentOffer = offer;
  document.getElementById("member-offer-title").value = offer.title || "";
  document.getElementById("member-offer-status").value = offer.status || "draft";
  document.getElementById("member-offer-summary").value = offer.summary || "";
  document.getElementById("member-offer-description").value = offer.description || "";
  document.getElementById("member-offer-image").value = offer.imageUrl || "";
  const endParts = datePartsTaipei(offer.endsAt);
  document.getElementById("member-offer-end-date").value = endParts.date;
  document.getElementById("member-offer-end-hour").value = endParts.hour;
  document.getElementById("member-offer-end-minute").value = endParts.minute;
  document.getElementById("member-offer-visibility").value = offer.visibilityMode || "schedule";
  document.getElementById("member-offer-limited").checked = offer.limited === true;
  document.getElementById("member-offer-quota").value = offer.quota || "";
  document.getElementById("member-offer-quota-field").hidden = offer.limited !== true;
  document.getElementById("member-offer-phases").innerHTML = "";
  (offer.phases || []).forEach(addPhase);
  if (!(offer.phases || []).length) addPhase();
  document.getElementById("member-offer-delete").hidden = false;
  document.querySelectorAll(".offer-admin-item").forEach((item) => item.classList.toggle("is-active", item.dataset.offerId === id));
  setStatus(`正在編輯：${offer.title || id}`);
}

function collectPhases(endsAt) {
  const cards = [...document.querySelectorAll(".offer-phase-admin")];
  if (!cards.length) throw new Error("至少需要一個開放階段。");
  const phases = cards.map((card, index) => {
    const startsAt = taipeiPartsToDate(
      card.querySelector("[data-phase-date]").value,
      card.querySelector("[data-phase-hour]").value,
      card.querySelector("[data-phase-minute]").value
    );
    const allowedTypes = [...card.querySelectorAll("[data-offer-role]:checked")].map((input) => input.dataset.offerRole);
    const actionUrl = safeWebUrl(card.querySelector("[data-action-url]").value);
    const actionLabel = card.querySelector("[data-action-label]").value.trim() || "立即參加";
    if (!startsAt) throw new Error(`第 ${index + 1} 階段尚未設定正確開始時間。`);
    if (!allowedTypes.length) throw new Error(`第 ${index + 1} 階段至少要勾選一種會員資格。`);
    return {
      id: card.dataset.phaseId || phaseId(),
      name: card.querySelector("[data-phase-name]").value.trim() || `第 ${index + 1} 階段`,
      startsAt,
      allowedTypes,
      actionUrl,
      actionLabel
    };
  }).sort((a, b) => a.startsAt - b.startsAt);

  phases.forEach((phase, index) => {
    const next = phases[index + 1]?.startsAt || endsAt;
    if (phase.startsAt >= next) throw new Error("各階段開始時間必須依序遞增，且最後一階段必須早於活動截止時間。");
    phase.endsAt = next;
  });
  return phases;
}

async function saveOffer() {
  const title = document.getElementById("member-offer-title").value.trim();
  const status = document.getElementById("member-offer-status").value;
  const endsAt = taipeiPartsToDate(
    document.getElementById("member-offer-end-date").value,
    document.getElementById("member-offer-end-hour").value,
    document.getElementById("member-offer-end-minute").value
  );
  if (!title) throw new Error("請填寫活動名稱。");
  if (!endsAt) throw new Error("請設定活動截止時間。");
  const phases = collectPhases(endsAt);
  if (phases[0].startsAt >= endsAt) throw new Error("活動截止時間必須晚於第一階段開始時間。");

  const id = currentOfferId || `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const limited = document.getElementById("member-offer-limited").checked;
  const payload = {
    type: "memberOffer",
    systemRecord: true,
    systemType: "memberOffer",
    offerId: id,
    title,
    summary: document.getElementById("member-offer-summary").value.trim(),
    description: document.getElementById("member-offer-description").value.trim(),
    imageUrl: safeWebUrl(document.getElementById("member-offer-image").value),
    status,
    visibilityMode: document.getElementById("member-offer-visibility").value,
    limited,
    quota: limited ? Math.max(0, Number(document.getElementById("member-offer-quota").value || 0)) : 0,
    startsAt: Timestamp.fromDate(phases[0].startsAt),
    endsAt: Timestamp.fromDate(endsAt),
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      startsAt: Timestamp.fromDate(phase.startsAt),
      endsAt: Timestamp.fromDate(phase.endsAt),
      allowedTypes: phase.allowedTypes,
      actionLabel: phase.actionLabel,
      actionUrl: phase.actionUrl
    })),
    updatedAt: serverTimestamp()
  };
  if (!currentOfferId) payload.createdAt = serverTimestamp();

  await setDoc(doc(db, "articles", `${OFFER_DOC_PREFIX}${id}`), payload, { merge: Boolean(currentOfferId) });
  currentOfferId = id;
  setStatus("活動已儲存；不需另行部署 Firebase Functions。", "success");
  await loadOffers();
  loadOffer(id);
}

async function deleteOffer() {
  if (!currentOfferId || !currentOffer) return;
  if (!confirm(`確定刪除「${currentOffer.title || currentOfferId}」？`)) return;
  await deleteDoc(doc(db, "articles", `${OFFER_DOC_PREFIX}${currentOfferId}`));
  setStatus("活動已刪除", "success");
  await loadOffers();
  resetForm();
}

function activityState(offer) {
  const now = new Date();
  const start = toDate(offer.startsAt);
  const end = toDate(offer.endsAt);
  if (offer.status !== "published") return "草稿";
  if (end && now >= end) return "已結束";
  if (start && now < start) return "即將開始";
  return "進行中";
}

function hideSystemOfferRows() {
  document.querySelectorAll(`#article-list .article-item[data-id^="${OFFER_DOC_PREFIX}"]`).forEach((element) => element.remove());
  const titles = new Set(offerCache.map((offer) => String(offer.title || "").trim()).filter(Boolean));
  document.querySelectorAll("#article-metrics .metrics-row").forEach((row) => {
    const title = row.querySelector(".metrics-title")?.textContent?.trim();
    if (title && titles.has(title)) row.remove();
  });
}

async function migrateLegacyOffers() {
  try {
    const [legacySnapshot, currentSnapshot] = await Promise.all([
      getDocs(query(collection(db, "membershipSettings"), where("type", "==", "memberOffer"))),
      getDocs(collection(db, "articles"))
    ]);
    const existing = new Set(currentSnapshot.docs
      .filter((item) => item.data().systemRecord === true && item.data().systemType === "memberOffer")
      .map((item) => item.data().offerId || item.id.replace(OFFER_DOC_PREFIX, "")));
    let migrated = 0;
    for (const item of legacySnapshot.docs) {
      const legacy = item.data() || {};
      const id = String(legacy.offerId || item.id.replace(/^memberOffer__/, ""));
      if (!id || existing.has(id)) continue;
      await setDoc(doc(db, "articles", `${OFFER_DOC_PREFIX}${id}`), {
        ...legacy,
        type: "memberOffer",
        systemRecord: true,
        systemType: "memberOffer",
        offerId: id,
        migratedFrom: "membershipSettings",
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      migrated += 1;
    }
    if (migrated) setStatus(`已自動轉移 ${migrated} 個既有會員優惠活動。`, "success");
  } catch (error) {
    console.warn("既有會員優惠資料轉移略過：", error);
  }
}

async function loadOffers() {
  const list = document.getElementById("member-offer-list");
  const snapshot = await getDocs(collection(db, "articles"));
  offerCache = snapshot.docs
    .map((item) => ({ docId: item.id, ...item.data() }))
    .filter((offer) => offer.systemRecord === true && offer.systemType === "memberOffer")
    .map((offer) => ({ ...offer, offerId: offer.offerId || String(offer.docId || "").replace(OFFER_DOC_PREFIX, "") }))
    .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0));

  if (!offerCache.length) {
    list.innerHTML = '<div class="empty">尚未建立會員優惠活動</div>';
    hideSystemOfferRows();
    return;
  }
  list.innerHTML = offerCache.map((offer) => `<button class="offer-admin-item ${offer.offerId === currentOfferId ? "is-active" : ""}" type="button" data-offer-id="${escapeHtml(offer.offerId)}"><strong>${escapeHtml(offer.title || "未命名活動")}</strong><small>${escapeHtml(activityState(offer))}｜截止 ${escapeHtml(formatTaipeiDateTime(offer.endsAt))}</small></button>`).join("");
  hideSystemOfferRows();
}

function bindEvents() {
  document.getElementById("member-offer-new")?.addEventListener("click", resetForm);
  document.getElementById("member-offer-reset")?.addEventListener("click", resetForm);
  document.getElementById("member-offer-add-phase")?.addEventListener("click", () => addPhase());
  document.getElementById("member-offer-limited")?.addEventListener("change", (event) => {
    document.getElementById("member-offer-quota-field").hidden = !event.target.checked;
  });
  document.getElementById("member-offer-list")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-offer-id]");
    if (item) loadOffer(item.dataset.offerId);
  });
  document.getElementById("member-offer-phases")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-phase]");
    if (!button) return;
    if (document.querySelectorAll(".offer-phase-admin").length <= 1) {
      setStatus("至少需要保留一個開放階段", "error");
      return;
    }
    button.closest(".offer-phase-admin")?.remove();
  });
  document.getElementById("member-offer-save")?.addEventListener("click", async () => {
    try {
      setStatus("正在儲存…", "saving");
      await saveOffer();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "儲存失敗", "error");
    }
  });
  document.getElementById("member-offer-delete")?.addEventListener("click", async () => {
    try {
      await deleteOffer();
    } catch (error) {
      setStatus(error.message || "刪除失敗", "error");
    }
  });

  const articleList = document.getElementById("article-list");
  const metrics = document.getElementById("article-metrics");
  if (articleList) new MutationObserver(hideSystemOfferRows).observe(articleList, { childList: true, subtree: true });
  if (metrics) new MutationObserver(hideSystemOfferRows).observe(metrics, { childList: true, subtree: true });
}

installPanel();
bindEvents();
resetForm();

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    setStatus("正在載入會員優惠…");
    await migrateLegacyOffers();
    await loadOffers();
    if (!document.getElementById("member-offer-admin-status").textContent.includes("轉移")) {
      setStatus("會員優惠後台已就緒｜24 小時制", "success");
    }
  } catch (error) {
    console.error(error);
    setStatus("無法載入會員優惠資料", "error");
  }
});
