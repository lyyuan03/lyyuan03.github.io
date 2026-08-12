import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  evaluateOfferForRoles,
  formatTaipeiShort,
  loadOfferMemberProfile
} from "./member-offers-core.js?v=20260812-2";

const path = location.pathname.toLowerCase();

function onReady(callback) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
  else callback();
}

function injectStyles() {
  if (document.getElementById("member-offers-integration-style")) return;
  const style = document.createElement("style");
  style.id = "member-offers-integration-style";
  style.textContent = `
  .member-offer-public-note{margin-top:12px;color:#766653;font-size:12px;line-height:1.7}
  .member-offer-public-link{display:inline-flex;margin-top:10px;padding:7px 12px;border:1px solid rgba(165,130,84,.35);color:#795A36;font-size:11px;letter-spacing:.08em}
  .member-offer-entry{position:relative;overflow:hidden;padding:26px 30px;background:linear-gradient(135deg,rgba(239,225,201,.92),rgba(255,252,247,.94))!important;border-color:rgba(165,130,84,.36)!important}
  .member-offer-entry:before{content:'';position:absolute;inset:0 auto 0 0;width:5px;background:#A58254}
  .member-offer-entry-inner{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
  .member-offer-entry-kicker{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#85643F;font-size:10px;letter-spacing:.14em}
  .member-offer-entry-new{color:#D92B2B;font-size:10px;font-weight:700;line-height:1;letter-spacing:.12em;text-shadow:0 0 7px rgba(217,43,43,.28);animation:memberOfferEntryNewPulse 1.15s ease-in-out infinite}
  @keyframes memberOfferEntryNewPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.94)}}
  .member-offer-entry h2{margin:6px 0 5px;color:#493724;font-family:var(--serif,'Noto Serif TC',serif);font-size:24px;font-weight:500;letter-spacing:.09em}
  .member-offer-entry p{margin:0;color:#756452;font-size:13px}
  .member-offer-entry a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 18px;border:1px solid rgba(139,104,63,.5);background:#8B683F;color:#FFFDF8;white-space:nowrap;font-size:12px;letter-spacing:.08em}
  @media(prefers-reduced-motion:reduce){.member-offer-entry-new{animation:none}}
  @media(max-width:680px){.member-offer-entry-inner{grid-template-columns:1fr}.member-offer-entry a{width:100%}}
  `;
  document.head.appendChild(style);
}

function enhanceMembershipPage() {
  injectStyles();
  const cards = [...document.querySelectorAll(".benefit")];
  const target = cards.find((card) => card.textContent.includes("促銷專屬優惠"));
  if (!target || target.querySelector(".member-offer-public-note")) return;
  const note = document.createElement("div");
  note.className = "member-offer-public-note";
  note.innerHTML = '會員限定優惠不定期開放；已加入會員可登入會員中心查看目前活動。<br><a class="member-offer-public-link" href="/member-dashboard.html">登入會員中心查看 →</a>';
  target.appendChild(note);
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

function enhanceDashboardPage() {
  injectStyles();
  const dashboard = document.getElementById("member-dashboard");
  if (!dashboard || document.getElementById("member-offer-dashboard-entry")) return;
  const entry = document.createElement("section");
  entry.id = "member-offer-dashboard-entry";
  entry.className = "card member-offer-entry";
  entry.innerHTML = `<div class="member-offer-entry-inner"><div><div class="member-offer-entry-kicker"><span>MEMBER EXCLUSIVE</span></div><h2>會員專屬優惠</h2><p id="member-offer-entry-message">查看目前進行中與即將開放的會員限定活動。</p></div><a href="/member-offers.html">查看最新優惠 →</a></div>`;
  const identity = dashboard.querySelector(".identity");
  if (identity?.nextSibling) dashboard.insertBefore(entry, identity.nextSibling);
  else dashboard.prepend(entry);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const profile = await loadOfferMemberProfile(db, user);
      if (!profile.active) return;
      const offers = await loadPublishedOffers();
      const best = bestOffer(profile.roles, offers, new Date());
      if (!best) return;
      const message = document.getElementById("member-offer-entry-message");
      const kicker = entry.querySelector(".member-offer-entry-kicker");
      const title = entry.querySelector("h2");
      if (best.state.currentEligible) {
        kicker.innerHTML = '<span class="member-offer-entry-new">NEW</span><span>會員限定｜目前開放</span>';
        title.textContent = best.offer.title || "會員專屬優惠";
        message.textContent = "您目前具有參加資格，點擊即可查看活動與專屬入口。";
      } else if (best.state.nextEligiblePhase) {
        kicker.innerHTML = '<span class="member-offer-entry-new">NEW</span><span>會員限定｜即將開放</span>';
        title.textContent = best.offer.title || "會員專屬優惠";
        message.textContent = `您的會員資格將於 ${formatTaipeiShort(best.state.nextEligiblePhase.startsAtDate)} 開放。`;
      }
    } catch (error) {
      console.warn("會員中心優惠摘要載入失敗：", error);
    }
  });
}

onReady(() => {
  if (/(^|\/)membership\.html$/.test(path)) enhanceMembershipPage();
  if (/(^|\/)member-dashboard\.html$/.test(path)) enhanceDashboardPage();
  if (/(^|\/)admin\.html$/.test(path)) import("./member-offer-admin.js?v=20260812-2").catch((error) => console.error("會員優惠後台載入失敗：", error));
});
