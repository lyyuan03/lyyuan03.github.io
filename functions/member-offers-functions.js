"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "asia-east1";

const MEMBER_TYPES = Object.freeze({
  WELLNESS_GENERAL: "wellness_general",
  WELLNESS_LINGJI: "wellness_lingji",
  ARTICLE_PAID: "article_paid"
});

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function isActiveWellness(member = {}, now = new Date()) {
  const expiry = asDate(member.expiresAt);
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

function isActiveSponsorPaid(member = {}, now = new Date()) {
  const expiry = asDate(member.expiresAt);
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

async function resolveRoles(email) {
  const now = new Date();
  const [wellnessSnapshot, sponsorSnapshot] = await Promise.all([
    db.doc(`memberAccess/${email}`).get(),
    db.doc(`sponsorMemberAccess/${email}`).get()
  ]);
  const wellness = wellnessSnapshot.exists ? wellnessSnapshot.data() : null;
  const sponsor = sponsorSnapshot.exists ? sponsorSnapshot.data() : null;
  const roles = [];
  if (wellness && isActiveWellness(wellness, now)) {
    roles.push(wellness.memberLevel === "lingji" ? MEMBER_TYPES.WELLNESS_LINGJI : MEMBER_TYPES.WELLNESS_GENERAL);
  }
  if (sponsor && isActiveSponsorPaid(sponsor, now)) roles.push(MEMBER_TYPES.ARTICLE_PAID);
  return [...new Set(roles)];
}

function intersects(left = [], right = []) {
  const set = new Set(Array.isArray(right) ? right : []);
  return (Array.isArray(left) ? left : []).some((value) => set.has(value));
}

function safeUrl(value = "") {
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

function normalizePhase(phase = {}) {
  const start = asDate(phase.startsAt);
  const end = asDate(phase.endsAt);
  if (!phase.id || !start || !end) return null;
  return {
    id: String(phase.id),
    name: String(phase.name || ""),
    startsAtDate: start,
    endsAtDate: end,
    allowedTypes: Array.isArray(phase.allowedTypes) ? phase.allowedTypes.filter((type) => Object.values(MEMBER_TYPES).includes(type)) : [],
    actionLabel: String(phase.actionLabel || "立即參加"),
    actionUrl: safeUrl(phase.actionUrl)
  };
}

function sanitizeOffer(docSnapshot, roles, now) {
  const offer = docSnapshot.data() || {};
  if (offer.type !== "memberOffer" || offer.status !== "published") return null;
  const phases = (Array.isArray(offer.phases) ? offer.phases : [])
    .map(normalizePhase)
    .filter(Boolean)
    .sort((a, b) => a.startsAtDate - b.startsAtDate);
  if (!phases.length) return null;

  const startsAt = asDate(offer.startsAt) || phases[0].startsAtDate;
  const endsAt = asDate(offer.endsAt) || phases[phases.length - 1].endsAtDate;
  const currentPhase = phases.find((phase) => phase.startsAtDate <= now && phase.endsAtDate > now) || null;
  const currentEligible = Boolean(currentPhase && intersects(roles, currentPhase.allowedTypes));
  const everEligible = phases.some((phase) => intersects(roles, phase.allowedTypes));
  const ended = Boolean(endsAt && now >= endsAt);
  const visibilityMode = ["hide", "locked", "schedule"].includes(offer.visibilityMode) ? offer.visibilityMode : "schedule";

  if (visibilityMode === "hide") {
    if (ended && !everEligible) return null;
    if (!ended && !currentEligible) return null;
  }

  const currentAction = currentEligible && currentPhase?.actionUrl
    ? { phaseId: currentPhase.id, url: currentPhase.actionUrl, label: currentPhase.actionLabel || "立即參加" }
    : null;

  return {
    id: String(offer.offerId || docSnapshot.id.replace(/^memberOffer__/, "")),
    title: String(offer.title || "會員專屬優惠"),
    summary: String(offer.summary || ""),
    description: String(offer.description || ""),
    imageUrl: safeUrl(offer.imageUrl),
    visibilityMode,
    limited: offer.limited === true,
    quota: Math.max(0, Number(offer.quota) || 0),
    startsAt: iso(startsAt),
    endsAt: iso(endsAt),
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      startsAt: phase.startsAtDate.toISOString(),
      endsAt: phase.endsAtDate.toISOString(),
      allowedTypes: phase.allowedTypes,
      actionLabel: phase.actionLabel
    })),
    currentAction
  };
}

exports.getMemberOffers = onCall(
  {
    region: REGION,
    enforceAppCheck: false
  },
  async (request) => {
    const email = normalizeEmail(request.auth?.token?.email);
    if (!request.auth || !email || request.auth.token.email_verified !== true) {
      throw new HttpsError("unauthenticated", "請先使用已驗證的會員 Google 帳號登入。");
    }

    const roles = await resolveRoles(email);
    if (!roles.length) {
      throw new HttpsError("permission-denied", "此帳號目前沒有有效的會員優惠資格。");
    }

    const snapshot = await db.collection("membershipSettings").where("type", "==", "memberOffer").get();
    const now = new Date();
    const offers = snapshot.docs.map((document) => sanitizeOffer(document, roles, now)).filter(Boolean);
    offers.sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0));

    return { roles, offers, serverTime: now.toISOString() };
  }
);
