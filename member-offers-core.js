import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const OFFER_MEMBER_TYPES = Object.freeze({
  WELLNESS_GENERAL: "wellness_general",
  WELLNESS_LINGJI: "wellness_lingji",
  ARTICLE_PAID: "article_paid"
});

export const OFFER_MEMBER_LABELS = Object.freeze({
  wellness_general: "養生療癒頻道｜一般會員",
  wellness_lingji: "養生療癒頻道｜靈極會員",
  article_paid: "贊助專屬文章付費會員"
});

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTaipeiDateTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return "未設定";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: options.dateOnly ? undefined : "2-digit",
    minute: options.dateOnly ? undefined : "2-digit",
    hour12: false
  }).format(date);
}

export function formatTaipeiShort(value) {
  const date = toDate(value);
  if (!date) return "未設定";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function isActiveWellnessMember(member = {}, now = new Date()) {
  const expiry = toDate(member.expiresAt);
  return member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && Boolean(expiry && expiry > now);
}

export function isActiveSponsorPaidMember(member = {}, now = new Date()) {
  const expiry = toDate(member.expiresAt);
  return member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim())
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && Boolean(expiry && expiry > now);
}

export async function loadOfferMemberProfile(db, user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) return { email: "", roles: [], member: null, sponsorMember: null, active: false };

  const [wellnessSnapshot, sponsorSnapshot] = await Promise.all([
    getDoc(doc(db, "memberAccess", email)),
    getDoc(doc(db, "sponsorMemberAccess", email))
  ]);
  const member = wellnessSnapshot.exists() ? { id: wellnessSnapshot.id, ...wellnessSnapshot.data() } : null;
  const sponsorMember = sponsorSnapshot.exists() ? { id: sponsorSnapshot.id, ...sponsorSnapshot.data() } : null;
  const roles = [];

  if (member && isActiveWellnessMember(member)) {
    roles.push(member.memberLevel === "lingji"
      ? OFFER_MEMBER_TYPES.WELLNESS_LINGJI
      : OFFER_MEMBER_TYPES.WELLNESS_GENERAL);
  }
  if (sponsorMember && isActiveSponsorPaidMember(sponsorMember)) {
    roles.push(OFFER_MEMBER_TYPES.ARTICLE_PAID);
  }

  return {
    email,
    roles: [...new Set(roles)],
    member,
    sponsorMember,
    active: roles.length > 0
  };
}

export function roleLabels(roles = []) {
  return roles.map((role) => OFFER_MEMBER_LABELS[role] || role);
}

export function intersects(a = [], b = []) {
  const right = new Set(Array.isArray(b) ? b : []);
  return (Array.isArray(a) ? a : []).some((value) => right.has(value));
}

export function normalizeOfferPhases(offer = {}) {
  const phases = Array.isArray(offer.phases) ? offer.phases : [];
  return phases
    .map((phase) => ({
      ...phase,
      startsAtDate: toDate(phase.startsAt),
      endsAtDate: toDate(phase.endsAt),
      allowedTypes: Array.isArray(phase.allowedTypes) ? phase.allowedTypes : []
    }))
    .filter((phase) => phase.id && phase.startsAtDate && phase.endsAtDate)
    .sort((a, b) => a.startsAtDate.getTime() - b.startsAtDate.getTime());
}

export function evaluateOfferForRoles(offer = {}, roles = [], now = new Date()) {
  const phases = normalizeOfferPhases(offer);
  const startsAt = toDate(offer.startsAt) || phases[0]?.startsAtDate || null;
  const endsAt = toDate(offer.endsAt) || phases.at(-1)?.endsAtDate || null;
  const currentPhase = phases.find((phase) => phase.startsAtDate <= now && phase.endsAtDate > now) || null;
  const currentEligible = Boolean(currentPhase && intersects(roles, currentPhase.allowedTypes));
  const nextEligiblePhase = phases.find((phase) => phase.startsAtDate > now && intersects(roles, phase.allowedTypes)) || null;
  const everEligible = phases.some((phase) => intersects(roles, phase.allowedTypes));
  const ended = Boolean(endsAt && now >= endsAt);
  const beforeStart = Boolean(startsAt && now < startsAt);
  const visibilityMode = ["hide", "locked", "schedule"].includes(offer.visibilityMode)
    ? offer.visibilityMode
    : "schedule";

  let hidden = false;
  if (visibilityMode === "hide") {
    hidden = ended ? !everEligible : !currentEligible;
  }

  let bucket = "current";
  if (ended) bucket = "history";
  else if (beforeStart || (!currentEligible && visibilityMode === "schedule" && nextEligiblePhase)) bucket = "upcoming";

  let message = "";
  if (ended) {
    message = "活動已結束";
  } else if (currentEligible) {
    message = "您目前具有參加資格";
  } else if (visibilityMode === "schedule" && nextEligiblePhase) {
    message = `您的會員資格將於 ${formatTaipeiShort(nextEligiblePhase.startsAtDate)} 開放`;
  } else if (currentPhase) {
    message = `目前階段限 ${roleLabels(currentPhase.allowedTypes).join("、")}`;
  } else if (startsAt) {
    message = `活動將於 ${formatTaipeiShort(startsAt)} 開始`;
  } else {
    message = "目前尚未開放";
  }

  return {
    phases,
    startsAt,
    endsAt,
    currentPhase,
    currentEligible,
    nextEligiblePhase,
    everEligible,
    ended,
    beforeStart,
    hidden,
    bucket,
    message,
    visibilityMode
  };
}

export function safeWebUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
