"use strict";

const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");

const db = getFirestore();

/** Minimum gap between *new* self-service checkout creations for one uid. */
const CHECKOUT_MIN_INTERVAL_MS = 60 * 1000;

function requireVerifiedCaller(request, unauthenticatedMessage, unverifiedMessage) {
  const email = String(request.auth?.token?.email || "").trim().toLowerCase();
  if (!request.auth || !email || !email.includes("@")) {
    throw new HttpsError("unauthenticated", unauthenticatedMessage);
  }
  // Strict: missing / undefined / false all fail (unlike `=== false` alone).
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", unverifiedMessage);
  }
  return {
    email,
    uid: String(request.auth.uid || "").trim().slice(0, 128)
  };
}

/**
 * Rate-limit new checkout creation per Firebase uid.
 * Call only when creating a new order (skip for reusable pending links).
 */
async function assertCheckoutRateLimit(uid, email) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "缺少登入身分，無法建立付款申請。");
  }
  const ref = db.doc(`checkoutRateLimits/${uid}`);
  const nowMs = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const lastMs = snapshot.exists && typeof snapshot.data()?.lastCheckoutAt?.toMillis === "function"
      ? snapshot.data().lastCheckoutAt.toMillis()
      : 0;
    if (lastMs && nowMs - lastMs < CHECKOUT_MIN_INTERVAL_MS) {
      throw new HttpsError("resource-exhausted", "請稍候再建立付款申請。");
    }
    const now = Timestamp.fromMillis(nowMs);
    transaction.set(ref, {
      email: String(email || "").trim().toLowerCase(),
      lastCheckoutAt: now,
      updatedAt: now
    }, { merge: true });
  });
}

module.exports = {
  CHECKOUT_MIN_INTERVAL_MS,
  requireVerifiedCaller,
  assertCheckoutRateLimit
};
