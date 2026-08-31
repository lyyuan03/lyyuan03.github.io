"use strict";

const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

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
    expiresAt: dateFromValue(member.expiresAt)
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
    expiresAt: dateFromValue(member.expiresAt)
  };
}

async function rebuildEntitlement(emailParam) {
  const email = normalizeEmail(emailParam);
  if (!email) return;

  const db = getFirestore();
  const [sponsorSnapshot, wellnessSnapshot, entitlementSnapshot] = await Promise.all([
    db.doc(`sponsorMemberAccess/${email}`).get(),
    db.doc(`memberAccess/${email}`).get(),
    db.doc(`memberEntitlements/${email}`).get()
  ]);

  const sponsor = sponsorSnapshot.exists ? sponsorSnapshot.data() || {} : {};
  const wellness = wellnessSnapshot.exists ? wellnessSnapshot.data() || {} : {};
  const now = new Date();
  const sponsorAccess = sponsorState(sponsor, email, now);
  const wellnessAccess = wellnessState(wellness, email, now);

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

exports._test = { activeWindow, sponsorState, wellnessState };
