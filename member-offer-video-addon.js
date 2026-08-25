import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "./firebase-config.js";
import {
  evaluateOfferForRoles,
  loadOfferMemberProfile,
  safeWebUrl
} from "./member-offers-core.js?v=20260812-2";

const path = location.pathname.toLowerCase();
const OFFER_DOC_PREFIX = "__member-offer__";
let adminLoadToken = 0;

function waitForElement(selector, timeout = 8000) {
  const immediate = document.querySelector(selector);
  if (immediate) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
}

function normalizeVideoUrl(value) {
  return safeWebUrl(String(value || "").trim());
}

async function installAdminVideoField() {
  const panel = await waitForElement("#member-offer-management");
  if (!panel || document.getElementById("member-offer-video-url")) return;

  const description = document.getElementById("member-offer-description")?.closest(".field");
  if (!description) return;

  const field = document.createElement("div");
  field.className = "field";
  field.id = "member-offer-video-field";
  field.innerHTML = `
    <label for="member-offer-video-url">會員優惠影片連結</label>
    <input id="member-offer-video-url" type="url" placeholder="https://www.youtube.com/... 或其他短影片網址">
    <small style="color:rgba(245,240,232,.48);font-size:11px;line-height:1.7">選填。填入後，會員中心的這一檔優惠會自動出現「觀看會員優惠影片」按鈕；未填則不顯示。</small>`;
  description.insertAdjacentElement("afterend", field);

  const input = document.getElementById("member-offer-video-url");
  const status = document.getElementById("member-offer-admin-status");

  async function loadActiveVideo() {
    const token = ++adminLoadToken;
    const active = document.querySelector(".offer-admin-item.is-active[data-offer-id]");
    if (!active) {
      if (input) input.value = "";
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, "articles", `${OFFER_DOC_PREFIX}${active.dataset.offerId}`));
      if (token !== adminLoadToken || !input) return;
      input.value = snapshot.exists() ? String(snapshot.data()?.videoUrl || "") : "";
    } catch (error) {
      console.warn("會員優惠影片連結載入失敗：", error);
    }
  }

  panel.addEventListener("click", (event) => {
    if (event.target.closest("#member-offer-new, #member-offer-reset")) {
      adminLoadToken += 1;
      if (input) input.value = "";
      return;
    }
    if (event.target.closest("[data-offer-id]")) {
      window.setTimeout(loadActiveVideo, 0);
    }
  });

  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest("#member-offer-save");
    if (!saveButton || !input) return;

    const raw = input.value.trim();
    const videoUrl = raw ? normalizeVideoUrl(raw) : "";
    if (raw && !videoUrl) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (status) {
        status.textContent = "會員優惠影片連結必須是有效的 HTTP／HTTPS 網址。";
        status.dataset.state = "error";
      }
      return;
    }

    window.setTimeout(async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 200));
        if (status?.dataset.state === "error") return;
        if (status?.dataset.state !== "success" || !status.textContent.includes("活動已儲存")) continue;
        const active = document.querySelector(".offer-admin-item.is-active[data-offer-id]");
        if (!active) continue;
        try {
          await setDoc(doc(db, "articles", `${OFFER_DOC_PREFIX}${active.dataset.offerId}`), {
            videoUrl,
            videoUpdatedAt: serverTimestamp()
          }, { merge: true });
          if (status) {
            status.textContent = videoUrl ? "活動與會員優惠影片連結已儲存。" : "活動已儲存；會員優惠影片連結已清除。";
            status.dataset.state = "success";
          }
        } catch (error) {
          console.error("會員優惠影片連結儲存失敗：", error);
          if (status) {
            status.textContent = "活動已儲存，但影片連結儲存失敗。";
            status.dataset.state = "error";
          }
        }
        return;
      }
    }, 0);
  }, true);

  window.setTimeout(loadActiveVideo, 0);
}

async function loadPublishedOffers() {
  const snapshot = await getDocs(query(collection(db, "articles"), where("status", "==", "published")));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((offer) => offer.systemRecord === true && offer.systemType === "memberOffer");
}

function bestOffer(roles, offers, now = new Date()) {
  const candidates = (Array.isArray(offers) ? offers : [])
    .map((offer) => ({ offer, state: evaluateOfferForRoles(offer, roles, now) }))
    .filter((item) => !item.state.hidden && !item.state.ended);
  candidates.sort((a, b) => {
    if (a.state.currentEligible !== b.state.currentEligible) return a.state.currentEligible ? -1 : 1;
    const aNext = a.state.nextEligiblePhase?.startsAtDate || a.state.startsAt || new Date(8640000000000000);
    const bNext = b.state.nextEligiblePhase?.startsAtDate || b.state.startsAt || new Date(8640000000000000);
    return aNext.getTime() - bNext.getTime();
  });
  return candidates[0] || null;
}

function installDashboardStyles() {
  if (document.getElementById("member-offer-video-addon-style")) return;
  const style = document.createElement("style");
  style.id = "member-offer-video-addon-style";
  style.textContent = `
    .member-offer-entry-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
    .member-offer-entry-actions .member-offer-video-button{background:#606330!important;border-color:rgba(96,99,48,.65)!important;color:#FFFDF8!important}
    .member-offer-entry-actions .member-offer-video-button:hover{background:#50542A!important}
    .member-offer-entry-actions .member-offer-video-button[hidden]{display:none!important}
    @media(max-width:680px){.member-offer-entry-actions{width:100%;justify-content:stretch}.member-offer-entry-actions a{width:100%}}
  `;
  document.head.appendChild(style);
}

async function installDashboardVideoLink() {
  installDashboardStyles();
  const entry = await waitForElement("#member-offer-dashboard-entry");
  if (!entry) return;

  let actions = entry.querySelector(".member-offer-entry-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "member-offer-entry-actions";
    const existingLink = entry.querySelector('a[href="/member-offers.html"]');
    if (existingLink) {
      existingLink.parentNode.insertBefore(actions, existingLink);
      actions.appendChild(existingLink);
    } else {
      entry.querySelector(".member-offer-entry-inner")?.appendChild(actions);
    }
  }

  let videoButton = actions.querySelector(".member-offer-video-button");
  if (!videoButton) {
    videoButton = document.createElement("a");
    videoButton.className = "member-offer-video-button";
    videoButton.target = "_blank";
    videoButton.rel = "noopener";
    videoButton.textContent = "觀看會員優惠影片 →";
    videoButton.hidden = true;
    actions.insertBefore(videoButton, actions.firstChild);
  }

  onAuthStateChanged(auth, async (user) => {
    videoButton.hidden = true;
    videoButton.removeAttribute("href");
    if (!user || isAdminEmail(user.email)) return;
    try {
      const profile = await loadOfferMemberProfile(db, user);
      if (!profile.active || auth.currentUser?.uid !== user.uid) return;
      const offers = await loadPublishedOffers();
      if (auth.currentUser?.uid !== user.uid) return;
      const best = bestOffer(profile.roles, offers, new Date());
      const videoUrl = best ? normalizeVideoUrl(best.offer.videoUrl) : "";
      if (!videoUrl) return;
      videoButton.href = videoUrl;
      videoButton.hidden = false;
    } catch (error) {
      console.warn("會員中心優惠影片連結載入失敗：", error);
    }
  });
}

if (/(^|\/)admin\.html$/.test(path)) installAdminVideoField();
if (/(^|\/)member-dashboard\.html$/.test(path)) installDashboardVideoLink();
