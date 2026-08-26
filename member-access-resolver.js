import { db, isAdminEmail } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function accessDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFuture(value, now = new Date()) {
  const date = accessDate(value);
  return Boolean(date && date > now);
}

function validRecordEmail(record = {}, email = "") {
  const normalizedEmail = normalizeEmail(email);
  const recordEmail = normalizeEmail(record.email || normalizedEmail);
  return Boolean(normalizedEmail && recordEmail === normalizedEmail);
}

export function activeSponsorMember(member = {}, email = "", now = new Date()) {
  const startsAt = accessDate(member.startsAt || member.firstJoinedAt);
  return Boolean(
    validRecordEmail(member, email)
    && member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 1
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && (!startsAt || startsAt <= now)
    && isFuture(member.expiresAt, now)
  );
}

export function activeWellnessMember(member = {}, email = "", now = new Date()) {
  const startsAt = accessDate(member.startsAt || member.firstJoinedAt);
  return Boolean(
    validRecordEmail(member, email)
    && member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && (!startsAt || startsAt <= now)
    && isFuture(member.expiresAt, now)
  );
}

export function activeEntitlement(entitlement = {}, email = "", now = new Date()) {
  if (!validRecordEmail(entitlement, email)) return false;
  if (Number(entitlement.schemaVersion || 0) < 1) return false;
  if (entitlement.status === "disabled") return false;

  const sponsor = entitlement.sponsorArticleAccess === true
    && isFuture(entitlement.sponsorExpiresAt, now);
  const wellness = entitlement.wellnessArticleAccess === true
    && isFuture(entitlement.wellnessExpiresAt, now);
  return sponsor || wellness;
}

async function safeRead(collectionName, email) {
  try {
    const snapshot = await getDoc(doc(db, collectionName, email));
    return snapshot.exists() ? snapshot.data() || {} : {};
  } catch (error) {
    console.warn(`會員權限資料暫時無法讀取：${collectionName}`, error);
    return {};
  }
}

export async function resolveMemberAccess(user) {
  if (!user?.email) {
    return { allowed: false, source: "signed-out", email: "", entitlement: {}, sponsor: {}, wellness: {} };
  }

  const email = normalizeEmail(user.email);
  if (isAdminEmail(email)) {
    return { allowed: true, source: "admin", email, entitlement: {}, sponsor: {}, wellness: {} };
  }

  const [entitlement, sponsor, wellness] = await Promise.all([
    safeRead("memberEntitlements", email),
    safeRead("sponsorMemberAccess", email),
    safeRead("memberAccess", email)
  ]);

  if (activeEntitlement(entitlement, email)) {
    return { allowed: true, source: "entitlement", email, entitlement, sponsor, wellness };
  }
  if (activeSponsorMember(sponsor, email)) {
    return { allowed: true, source: "sponsor-fallback", email, entitlement, sponsor, wellness };
  }
  if (activeWellnessMember(wellness, email)
      && (wellness.memberLevel === "lingji" || wellness.articleAccess === true)) {
    return { allowed: true, source: "wellness-fallback", email, entitlement, sponsor, wellness };
  }

  return { allowed: false, source: "none", email, entitlement, sponsor, wellness };
}

export async function hasUnifiedPaidArticleAccess(user) {
  return (await resolveMemberAccess(user)).allowed;
}
