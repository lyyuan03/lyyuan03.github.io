"use strict";

const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { ARTICLE_WINDOW_POLICY, articleWindowStart } = require("./article-window");
const { resolveFirstJoinMonth, videoPublishedMonth } = require("./wellness-first-join");

const REGION = "asia-east1";
const SCHEMA_VERSION = 1;

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function dateFromValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function activeWindow(record = {}, now = new Date()) {
  const startsAt = dateFromValue(record.startsAt || record.firstJoinedAt);
  const expiresAt = dateFromValue(record.expiresAt);
  return Boolean((!startsAt || startsAt <= now) && expiresAt && expiresAt > now);
}

function sponsorState(member = {}, email = "", now = new Date()) {
  const recordEmail = normalizeEmail(member.email || email);
  const active = Boolean(
    recordEmail === email
    && member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && activeWindow(member, now)
  );
  return {
    active,
    articleAccess: active,
    expiresAt: dateFromValue(member.expiresAt),
    articleWindowStartsAt: active ? articleWindowStart(member) : null
  };
}

function wellnessState(member = {}, email = "", now = new Date()) {
  const recordEmail = normalizeEmail(member.email || email);
  const active = Boolean(
    recordEmail === email
    && member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && activeWindow(member, now)
  );
  const lingji = active && member.memberLevel === "lingji";
  return {
    active,
    lingji,
    articleAccess: active && (lingji || member.articleAccess === true),
    videoAccess: active,
    expiresAt: dateFromValue(member.expiresAt),
    articleWindowStartsAt: active ? articleWindowStart(member) : null
  };
}

async function rebuildEntitlement(emailParam) {
  const email = normalizeEmail(emailParam);
  if (!email) return;

  const db = getFirestore();
  const [sponsorSnapshot, wellnessSnapshot, entitlementSnapshot, historySnapshot] = await Promise.all([
    db.doc(`sponsorMemberAccess/${email}`).get(),
    db.doc(`memberAccess/${email}`).get(),
    db.doc(`memberEntitlements/${email}`).get(),
    db.doc(`membershipHistory/${email}`).get()
  ]);

  const sponsor = sponsorSnapshot.exists ? sponsorSnapshot.data() || {} : {};
  const wellness = wellnessSnapshot.exists ? wellnessSnapshot.data() || {} : {};
  const now = new Date();
  const sponsorAccess = sponsorState(sponsor, email, now);
  const wellnessAccess = wellnessState(wellness, email, now);
  const history = historySnapshot.exists ? historySnapshot.data() || {} : {};

  // 首次入會月份：取現有值、歷史備份與推估值中最早者；只寫入一次或往更早修正，續會／重新入會不會延後。
  if (wellnessSnapshot.exists && wellness.memberType === "wellness-channel") {
    const firstJoinMonth = resolveFirstJoinMonth(wellness, history);
    if (firstJoinMonth) {
      if (wellness.wellnessFirstJoinMonth !== firstJoinMonth) {
        await db.doc(`memberAccess/${email}`).set({ wellnessFirstJoinMonth: firstJoinMonth }, { merge: true });
      }
      if (history.wellnessFirstJoinMonth !== firstJoinMonth) {
        await db.doc(`membershipHistory/${email}`).set({ email, wellnessFirstJoinMonth: firstJoinMonth }, { merge: true });
      }
      wellnessAccess.firstJoinMonth = firstJoinMonth;
    }
  }

  const hasIndependentPermissions = Array.isArray(entitlementSnapshot.data()?.permissions)
    && entitlementSnapshot.data().permissions.length > 0;
  if (!sponsorSnapshot.exists && !wellnessSnapshot.exists && !hasIndependentPermissions) {
    await db.doc(`memberEntitlements/${email}`).delete().catch(() => {});
    return;
  }

  const payload = {
    email,
    schemaVersion: SCHEMA_VERSION,
    status: sponsorAccess.articleAccess || wellnessAccess.articleAccess || wellnessAccess.videoAccess ? "active" : "inactive",
    paidArticleAccess: sponsorAccess.articleAccess || wellnessAccess.articleAccess,
    sponsorArticleAccess: sponsorAccess.articleAccess,
    wellnessArticleAccess: wellnessAccess.articleAccess,
    wellnessVideoAccess: wellnessAccess.videoAccess,
    lingjiAccess: wellnessAccess.lingji,
    wellnessFirstJoinMonth: wellnessAccess.firstJoinMonth || history.wellnessFirstJoinMonth || FieldValue.delete(),
    articleWindowPolicy: ARTICLE_WINDOW_POLICY,
    sourceCollections: {
      sponsorMemberAccess: sponsorSnapshot.exists,
      memberAccess: wellnessSnapshot.exists
    },
    computedAt: FieldValue.serverTimestamp()
  };

  if (sponsorAccess.expiresAt) payload.sponsorExpiresAt = Timestamp.fromDate(sponsorAccess.expiresAt);
  else payload.sponsorExpiresAt = FieldValue.delete();

  if (wellnessAccess.expiresAt) payload.wellnessExpiresAt = Timestamp.fromDate(wellnessAccess.expiresAt);
  else payload.wellnessExpiresAt = FieldValue.delete();

  // 付費文章閱讀範圍：只能閱讀此時間之後發表的付費文章（1970-01-01 代表規則生效前的舊會員本期不受限制）。
  if (sponsorAccess.articleWindowStartsAt) payload.sponsorArticleWindowStartsAt = Timestamp.fromDate(sponsorAccess.articleWindowStartsAt);
  else payload.sponsorArticleWindowStartsAt = FieldValue.delete();

  if (wellnessAccess.articleWindowStartsAt) payload.wellnessArticleWindowStartsAt = Timestamp.fromDate(wellnessAccess.articleWindowStartsAt);
  else payload.wellnessArticleWindowStartsAt = FieldValue.delete();

  await db.doc(`memberEntitlements/${email}`).set(payload, { merge: true });
}

exports.syncEntitlementsFromSponsor = onDocumentWritten(
  { document: "sponsorMemberAccess/{email}", region: REGION },
  async (event) => rebuildEntitlement(event.params.email)
);

exports.syncEntitlementsFromWellness = onDocumentWritten(
  { document: "memberAccess/{email}", region: REGION },
  async (event) => rebuildEntitlement(event.params.email)
);

// 影片寫入時自動補上 publishedMonth（"YYYY-MM"，台北時間），供 firestore.rules 與查詢比對首次入會月份。
exports.syncMemberVideoPublishedMonth = onDocumentWritten(
  { document: "memberVideos/{videoId}", region: REGION },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const video = after.data() || {};
    const month = videoPublishedMonth(video);
    if (month && video.publishedMonth !== month) {
      await after.ref.set({ publishedMonth: month }, { merge: true });
    }
  }
);

exports._test = { activeWindow, sponsorState, wellnessState };
