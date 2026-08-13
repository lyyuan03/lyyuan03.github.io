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

  .member-offer-entry{
    position:relative;
    top:0;
    overflow:hidden;
    padding:27px 30px;
    isolation:isolate;
    background:
      radial-gradient(circle at 84% 18%,rgba(165,130,84,.10),transparent 31%),
      linear-gradient(135deg,rgba(239,225,201,.93),rgba(255,252,247,.96))!important;
    border-color:rgba(165,130,84,.42)!important;
    box-shadow:0 16px 38px rgba(89,79,71,.11),0 0 0 1px rgba(255,255,255,.42) inset;
    animation:memberOfferEntryReveal .9s cubic-bezier(.16,.78,.24,1) both;
    transition:top .25s ease,box-shadow .35s ease,border-color .35s ease;
  }
  .member-offer-entry:hover{
    top:-2px;
    border-color:rgba(165,130,84,.58)!important;
    box-shadow:0 20px 46px rgba(89,79,71,.15),0 0 0 1px rgba(255,255,255,.5) inset;
  }
  .member-offer-entry:before{
    content:'';
    position:absolute;
    z-index:3;
    inset:0 auto 0 0;
    width:5px;
    background:linear-gradient(180deg,#A58254 0%,#C6A56B 48%,#A58254 100%);
    box-shadow:0 0 12px rgba(165,130,84,.12);
    animation:memberOfferGoldBreath 4.8s ease-in-out infinite;
  }
  .member-offer-entry-inner{
    position:relative;
    z-index:4;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    gap:26px;
    align-items:center;
  }
  .member-offer-entry-copy{position:relative;z-index:2;min-width:0}
  .member-offer-entry-kicker{
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
    color:#85643F;
    font-size:10px;
    letter-spacing:.14em;
  }
  .member-offer-entry-kicker>span:not(.member-offer-entry-status){opacity:.86}
  .member-offer-entry-status{
    display:inline-flex;
    align-items:center;
    min-height:24px;
    padding:3px 10px;
    border:1px solid rgba(96,99,48,.34);
    border-radius:999px;
    background:rgba(96,99,48,.10);
    color:#606330;
    font-size:10px;
    font-weight:500;
    letter-spacing:.1em;
  }
  .member-offer-entry-status.upcoming{
    border-color:rgba(165,130,84,.34);
    background:rgba(165,130,84,.09);
    color:#795A36;
  }
  .member-offer-entry h2{
    margin:7px 0 6px;
    color:#493724;
    font-family:var(--serif,'Noto Serif TC',serif);
    font-size:24px;
    font-weight:500;
    line-height:1.55;
    letter-spacing:.09em;
  }
  .member-offer-entry p{margin:0;color:#756452;font-size:13px}
  .member-offer-entry-eligibility{
    display:inline-flex;
    align-items:center;
    gap:6px;
    margin-top:12px;
    padding:6px 11px;
    border:1px solid rgba(96,99,48,.28);
    border-radius:999px;
    background:rgba(96,99,48,.075);
    color:#55592F;
    font-size:11px;
    line-height:1.5;
    letter-spacing:.06em;
  }
  .member-offer-entry-eligibility.upcoming{
    border-color:rgba(165,130,84,.28);
    background:rgba(165,130,84,.07);
    color:#765A38;
  }
  .member-offer-entry-eligibility[hidden]{display:none!important}
  .member-offer-entry-actions{
    position:relative;
    z-index:5;
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:10px;
    flex-wrap:wrap;
  }
  .member-offer-entry a{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:42px;
    padding:9px 18px;
    border:1px solid rgba(139,104,63,.48);
    background:#A58254;
    color:#FFFDF8;
    white-space:nowrap;
    font-size:12px;
    letter-spacing:.08em;
    box-shadow:0 7px 16px rgba(89,79,71,.09);
    transition:filter .2s ease,box-shadow .25s ease,transform .2s ease;
  }
  .member-offer-entry a:hover{
    filter:brightness(.96);
    box-shadow:0 9px 20px rgba(89,79,71,.14);
    transform:translateY(-1px);
  }
  .member-offer-entry-watermark{
    position:absolute;
    z-index:1;
    right:10%;
    top:50%;
    width:250px;
    height:118px;
    transform:translateY(-50%);
    background:url('/assets/footer-logo-gold.svg?v=20260721-1') center/contain no-repeat;
    opacity:.045;
    pointer-events:none;
    filter:sepia(.12);
  }
  .member-offer-entry-sheen{
    position:absolute;
    z-index:2;
    inset:0;
    overflow:hidden;
    pointer-events:none;
  }
  .member-offer-entry-sheen:before{
    content:'';
    position:absolute;
    top:-65%;
    left:-18%;
    width:9%;
    height:230%;
    transform:rotate(18deg);
    background:linear-gradient(90deg,transparent,rgba(219,186,125,.14),rgba(255,248,225,.28),rgba(219,186,125,.12),transparent);
    animation:memberOfferBorderSheen 9s ease-in-out 1.6s infinite;
  }

  @keyframes memberOfferEntryReveal{
    from{opacity:0;transform:translateY(9px);filter:blur(2px)}
    to{opacity:1;transform:none;filter:none}
  }
  @keyframes memberOfferGoldBreath{
    0%,100%{filter:brightness(.95);box-shadow:0 0 10px rgba(165,130,84,.10)}
    50%{filter:brightness(1.12);box-shadow:0 0 16px rgba(165,130,84,.20)}
  }
  @keyframes memberOfferBorderSheen{
    0%,68%{left:-18%;opacity:0}
    72%{opacity:.55}
    88%{left:112%;opacity:.18}
    100%{left:112%;opacity:0}
  }

  @media(prefers-reduced-motion:reduce){
    .member-offer-entry{animation:none;transition:none}
    .member-offer-entry:before,.member-offer-entry-sheen:before{animation:none}
    .member-offer-entry:hover{top:0}
  }
  @media(max-width:680px){
    .member-offer-entry{padding:24px 22px}
    .member-offer-entry-inner{grid-template-columns:1fr;gap:18px}
    .member-offer-entry-actions{width:100%;justify-content:stretch}
    .member-offer-entry-actions a{width:100%}
    .member-offer-entry-watermark{right:-46px;top:66%;width:210px;opacity:.035}
  }
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
  entry.innerHTML = `
    <span class="member-offer-entry-watermark" aria-hidden="true"></span>
    <span class="member-offer-entry-sheen" aria-hidden="true"></span>
    <div class="member-offer-entry-inner">
      <div class="member-offer-entry-copy">
        <div class="member-offer-entry-kicker"><span>MEMBER EXCLUSIVE</span></div>
        <h2>會員專屬優惠</h2>
        <p id="member-offer-entry-message">查看目前進行中與即將開放的會員限定活動。</p>
        <div id="member-offer-entry-eligibility" class="member-offer-entry-eligibility" hidden></div>
      </div>
      <div class="member-offer-entry-actions">
        <a class="member-offer-main-button" href="/member-offers.html">查看最新優惠 →</a>
      </div>
    </div>`;

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
      const eligibility = document.getElementById("member-offer-entry-eligibility");

      if (best.state.currentEligible) {
        kicker.innerHTML = '<span>會員限定</span><span class="member-offer-entry-status">目前開放</span>';
        title.textContent = best.offer.title || "會員專屬優惠";
        message.textContent = "點擊即可查看活動內容與您的專屬入口。";
        if (eligibility) {
          eligibility.hidden = false;
          eligibility.classList.remove("upcoming");
          eligibility.textContent = "✓ 您已取得本活動資格";
        }
      } else if (best.state.nextEligiblePhase) {
        kicker.innerHTML = '<span>會員限定</span><span class="member-offer-entry-status upcoming">即將開放</span>';
        title.textContent = best.offer.title || "會員專屬優惠";
        message.textContent = `您的會員資格將於 ${formatTaipeiShort(best.state.nextEligiblePhase.startsAtDate)} 開放。`;
        if (eligibility) {
          eligibility.hidden = false;
          eligibility.classList.add("upcoming");
          eligibility.textContent = "您的活動資格即將開放";
        }
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
