"use strict";

const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const REGION = "asia-east1";
const SPONSOR_SCOPE = "sponsor-paid-articles";
const SPONSOR_ACCESS_VERSION = 2;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function timestampFromLegacyValue(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Timestamp.fromDate(parsed);
}

/**
 * Keep sponsor-paid-article records in one canonical schema.
 *
 * Important policy:
 * - Sponsor paid-article membership is independent from wellness/general membership.
 * - An active + paid sponsor-member is a sponsor paid-article member and must have articleAccess.
 * - Legacy ISO date strings are converted to Firestore Timestamp so security rules can validate expiry.
 */
exports.normalizeSponsorMemberAccess = onDocumentWritten(
  {
    document: "sponsorMemberAccess/{email}",
    region: REGION
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const member = after.data() || {};
    if (member.memberType !== "sponsor-member") return;

    const email = normalizeEmail(event.params.email);
    const updates = {};

    if (email && normalizeEmail(member.email) !== email) updates.email = email;
    if (member.wellnessAccess !== false) updates.wellnessAccess = false;
    if (member.accessScope !== SPONSOR_SCOPE) updates.accessScope = SPONSOR_SCOPE;
    if (Number(member.accessVersion || 0) < SPONSOR_ACCESS_VERSION) {
      updates.accessVersion = SPONSOR_ACCESS_VERSION;
    }

    const isPaidActive = member.paymentStatus === "paid" && member.status === "active";
    if (isPaidActive && member.articleAccess !== true) updates.articleAccess = true;

    for (const field of ["firstJoinedAt", "startsAt", "expiresAt", "paidAt", "discountUsedAt"]) {
      const timestamp = timestampFromLegacyValue(member[field]);
      if (timestamp) updates[field] = timestamp;
    }

    if (!Object.keys(updates).length) return;
    updates.updatedAt = FieldValue.serverTimestamp();
    await after.ref.set(updates, { merge: true });
  }
);
