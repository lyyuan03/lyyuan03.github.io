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

// 付費文章閱讀範圍（與 functions/article-window.js、firestore.rules 同一規則）：
// 只能閱讀「本期連續會員開通日前 30 天起」發表的付費文章。
// 規則生效（2026-10-01）前已在期間內的舊會員，本期不受限制。
const ARTICLE_WINDOW_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const ARTICLE_WINDOW_EFFECTIVE_AT = new Date("2026-09-30T16:00:00.000Z");

function memberRecordWindowStart(record = {}) {
  let anchor = accessDate(record.articleWindowStartsAt);
  if (!anchor) {
    const startsAt = accessDate(record.startsAt);
    if (startsAt && startsAt >= ARTICLE_WINDOW_EFFECTIVE_AT) anchor = startsAt;
  }
  return anchor ? new Date(anchor.getTime() - ARTICLE_WINDOW_LOOKBACK_MS) : new Date(0);
}

// 回傳此會員可閱讀的最早發表時間；null 代表不受限制（管理員），undefined 代表尚無法判斷（交由伺服器規則決定）。
export function paidArticleWindowStart(access = {}, now = new Date()) {
  if (!access?.allowed) return undefined;
  if (access.source === "admin") return null;
  const starts = [];
  if (access.source === "entitlement") {
    const entitlement = access.entitlement || {};
    if (entitlement.sponsorArticleAccess === true && isFuture(entitlement.sponsorExpiresAt, now)) {
      starts.push(accessDate(entitlement.sponsorArticleWindowStartsAt));
    }
    if (entitlement.wellnessArticleAccess === true && isFuture(entitlement.wellnessExpiresAt, now)) {
      starts.push(accessDate(entitlement.wellnessArticleWindowStartsAt));
    }
  } else if (access.source === "sponsor-fallback") {
    starts.push(memberRecordWindowStart(access.sponsor));
  } else if (access.source === "wellness-fallback") {
    starts.push(memberRecordWindowStart(access.wellness));
  }
  if (!starts.length || starts.some((value) => !value)) return undefined;
  return new Date(Math.min(...starts.map((value) => value.getTime())));
}

export function paidArticleWithinWindow(access = {}, publishedAt, now = new Date()) {
  const windowStart = paidArticleWindowStart(access, now);
  if (windowStart === null || windowStart === undefined) return true;
  if (windowStart.getTime() <= 0) return true;
  const published = accessDate(publishedAt);
  return Boolean(published && published >= windowStart);
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
