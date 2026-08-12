import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const dashboard = document.getElementById("member-dashboard");
const REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
let pendingReminder = null;

const reminderStyle = document.createElement("style");
reminderStyle.id = "member-dashboard-expiry-reminder-style";
reminderStyle.textContent = `
#dashboard-greeting .membership-expiry-badge {
  display:inline-flex;
  align-items:center;
  margin-left:10px;
  padding:4px 10px;
  border:1px solid rgba(165,130,84,.42);
  border-radius:999px;
  background:rgba(165,130,84,.11);
  color:#77583A;
  font-family:var(--sans);
  font-size:11px;
  font-weight:500;
  line-height:1.4;
  letter-spacing:.06em;
  vertical-align:middle;
  white-space:nowrap;
}
#dashboard-greeting .membership-expiry-badge.is-urgent {
  border-color:rgba(139,86,55,.48);
  background:rgba(139,86,55,.13);
  color:#7B432E;
}
.membership-expiry-alert {
  position:relative;
  overflow:hidden;
  display:grid;
  grid-template-columns:auto 1fr;
  gap:14px;
  align-items:start;
  padding:18px 22px;
  border:1px solid rgba(165,130,84,.3);
  background:linear-gradient(135deg,rgba(248,240,225,.96),rgba(255,252,247,.9));
  box-shadow:0 12px 30px rgba(89,79,71,.08);
}
.membership-expiry-alert:before {
  content:'';
  position:absolute;
  inset:0 auto 0 0;
  width:4px;
  background:var(--gold);
}
.membership-expiry-alert.is-urgent {
  border-color:rgba(139,86,55,.32);
  background:linear-gradient(135deg,rgba(246,232,219,.97),rgba(255,251,246,.92));
}
.membership-expiry-alert.is-urgent:before { background:#8B5637; }
.membership-expiry-alert-icon {
  --expiry-pulse:165,130,84;
  display:grid;
  place-items:center;
  width:28px;
  height:28px;
  margin-top:1px;
  border:1px solid rgba(165,130,84,.5);
  border-radius:50%;
  color:#7A5937;
  font-family:Georgia,serif;
  font-size:16px;
  font-weight:600;
  line-height:1;
  transform-origin:center;
  will-change:transform,box-shadow;
  animation:membershipExpiryNudge 2.4s ease-in-out infinite;
}
.membership-expiry-alert.is-urgent .membership-expiry-alert-icon {
  --expiry-pulse:139,86,55;
  border-color:rgba(139,86,55,.55);
  color:#7B432E;
  animation-duration:1.8s;
}
@keyframes membershipExpiryNudge {
  0%,58%,100% {
    transform:translateY(0) scale(1);
    box-shadow:0 0 0 0 rgba(var(--expiry-pulse),0);
  }
  66% {
    transform:translateY(-3px) scale(1.06);
    box-shadow:0 0 0 0 rgba(var(--expiry-pulse),.24);
  }
  74% {
    transform:translateY(0) scale(1);
    box-shadow:0 0 0 7px rgba(var(--expiry-pulse),0);
  }
  82% {
    transform:translateY(-1px) scale(1.025);
    box-shadow:0 0 0 0 rgba(var(--expiry-pulse),.16);
  }
  90% {
    transform:translateY(0) scale(1);
    box-shadow:0 0 0 5px rgba(var(--expiry-pulse),0);
  }
}
.membership-expiry-alert-copy strong {
  display:block;
  margin:0 0 2px;
  color:#513A27;
  font-family:var(--serif);
  font-size:16px;
  font-weight:500;
  letter-spacing:.08em;
}
.membership-expiry-alert-copy p {
  margin:0;
  color:#756351;
  font-size:13px;
  line-height:1.8;
  letter-spacing:.035em;
}
.membership-expiry-alert-copy b {
  color:#60442E;
  font-weight:500;
}
@media(max-width:768px) {
  #dashboard-greeting .membership-expiry-badge {
    margin:8px 0 0;
  }
  .membership-expiry-alert {
    grid-template-columns:auto 1fr;
    gap:11px;
    padding:16px 17px;
  }
}
@media(prefers-reduced-motion:reduce) {
  .membership-expiry-alert-icon {
    animation:none!important;
  }
}
`;
document.head.appendChild(reminderStyle);

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function taipeiDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyToUtcMs(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysUntilTaipeiDate(expiry) {
  const todayKey = taipeiDateKey(new Date());
  const expiryKey = taipeiDateKey(expiry);
  if (!todayKey || !expiryKey) return null;
  return Math.round((dateKeyToUtcMs(expiryKey) - dateKeyToUtcMs(todayKey)) / DAY_MS);
}

function formatTaipeiDate(value) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(date)
    : "";
}

function isActiveWellness(record = {}) {
  const expiry = toDate(record.expiresAt);
  return record.memberType === "wellness-channel"
    && record.wellnessAccess === true
    && ["wellness", "lingji"].includes(record.memberLevel)
    && record.status === "active"
    && record.paymentStatus === "paid"
    && record.disabled !== true
    && record.suspended !== true
    && !record.revokedAt
    && Boolean(expiry && expiry > new Date());
}

function isActiveSponsor(record = {}) {
  const expiry = toDate(record.expiresAt);
  return record.memberType === "sponsor-member"
    && record.status === "active"
    && record.paymentStatus === "paid"
    && record.articleAccess === true
    && record.accessScope === "sponsor-paid-articles"
    && Number(record.accessVersion || 0) >= 2
    && Boolean(String(record.lastOrderNo || "").trim())
    && record.disabled !== true
    && record.suspended !== true
    && !record.revokedAt
    && Boolean(expiry && expiry > new Date());
}

function buildReminder(member, sponsorMember) {
  const activeRecords = [];
  if (member && isActiveWellness(member)) {
    activeRecords.push({
      kind: "wellness",
      label: "會員會籍",
      expiry: toDate(member.expiresAt)
    });
  }
  if (sponsorMember && isActiveSponsor(sponsorMember)) {
    activeRecords.push({
      kind: "sponsor",
      label: "贊助文章會籍",
      expiry: toDate(sponsorMember.expiresAt)
    });
  }
  if (!activeRecords.length) return null;

  activeRecords.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());
  const next = activeRecords[0];
  const days = daysUntilTaipeiDate(next.expiry);
  if (days === null || days < 0 || days > REMINDER_DAYS) return null;

  const urgent = days <= 7;
  const badge = days === 0
    ? "會籍今日到期"
    : days <= 14
      ? `會籍剩餘 ${days} 天`
      : "會籍即將到期";
  const title = days === 0 ? "會籍今日到期" : "會籍即將到期";
  const expiryText = formatTaipeiDate(next.expiry);
  const gratitudeMessage = "非常感謝您一路以來的護持！如果這段期間，靈元院的文章與內容曾帶給您一些啟發與陪伴，若您還想繼續與我們同行，歡迎續會，讓這份靈性的成長與陪伴延續下去。";
  const message = days === 0
    ? `您的${next.label}將於今日（${expiryText}）到期。${gratitudeMessage}`
    : `您的${next.label}將於 ${expiryText} 到期，目前還有 ${days} 天。${gratitudeMessage}`;

  return { ...next, days, urgent, badge, title, message };
}

function removeReminder() {
  document.getElementById("membership-expiry-alert")?.remove();
  document.querySelector("#dashboard-greeting .membership-expiry-badge")?.remove();
}

function renderReminder(reminder) {
  removeReminder();
  if (!reminder || !dashboard || dashboard.hidden) return;

  const greeting = document.getElementById("dashboard-greeting");
  if (greeting) {
    const badge = document.createElement("span");
    badge.className = `membership-expiry-badge${reminder.urgent ? " is-urgent" : ""}`;
    badge.textContent = reminder.badge;
    greeting.appendChild(badge);
  }

  const identity = dashboard.querySelector(".identity");
  if (!identity) return;

  const alert = document.createElement("section");
  alert.id = "membership-expiry-alert";
  alert.className = `membership-expiry-alert${reminder.urgent ? " is-urgent" : ""}`;
  alert.setAttribute("role", "status");
  alert.setAttribute("aria-live", "polite");
  alert.innerHTML = `
    <span class="membership-expiry-alert-icon" aria-hidden="true">!</span>
    <div class="membership-expiry-alert-copy">
      <strong>${reminder.title}</strong>
      <p>${reminder.message.replace(/(\d{4}年\d{1,2}月\d{1,2}日|還有 \d+ 天)/g, "<b>$1</b>")}</p>
    </div>
  `;
  identity.insertAdjacentElement("afterend", alert);
}

function tryRenderReminder() {
  if (!dashboard || dashboard.hidden) return;
  renderReminder(pendingReminder);
}

if (dashboard) {
  const dashboardObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "hidden")) {
      tryRenderReminder();
    }
  });
  dashboardObserver.observe(dashboard, { attributes: true, attributeFilter: ["hidden"] });
}

onAuthStateChanged(auth, async (user) => {
  pendingReminder = null;
  removeReminder();
  if (!user?.email) return;

  try {
    const email = user.email.trim().toLowerCase();
    const [memberSnapshot, sponsorSnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email))
    ]);
    const member = memberSnapshot.exists() ? memberSnapshot.data() : null;
    const sponsorMember = sponsorSnapshot.exists() ? sponsorSnapshot.data() : null;
    pendingReminder = buildReminder(member, sponsorMember);
    tryRenderReminder();
  } catch (error) {
    console.warn("會員會籍到期提醒載入失敗：", error);
  }
});
