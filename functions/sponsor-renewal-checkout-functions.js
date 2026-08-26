"use strict";

const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineJsonSecret } = require("firebase-functions/params");
const { createMerchantTradeNo } = require("./ecpay");
const {
  normalizeSponsorOfferSettings,
  sponsorPlanAmount
} = require("./membership-plans");

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const FUNCTIONS_BASE_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net";
const ecpayConfig = defineJsonSecret("ECPAY_CONFIG");

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value = "", maximum = 100) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .trim()
    .slice(0, maximum);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasPurchasedBefore(member = {}, history = {}) {
  const sponsorHistory = history?.sponsor || {};
  return Boolean(
    member.memberType === "sponsor-member"
    && (
      member.paymentStatus === "paid"
      || member.articleAccess === true
      || member.lastOrderNo
      || Number(member.purchaseCount || 0) > 0
      || (
        sponsorHistory.memberType === "sponsor-member"
        && sponsorHistory.paymentStatus === "paid"
        && sponsorHistory.verified === true
      )
    )
  );
}

exports.createSponsorRenewalCheckout = onCall(
  {
    region: REGION,
    secrets: [ecpayConfig],
    enforceAppCheck: false
  },
  async (request) => {
    const email = normalizeEmail(request.auth?.token?.email);
    const uid = cleanText(request.auth?.uid, 128);
    const name = cleanText(request.data?.name || request.auth?.token?.name || "", 60);
    const planMonths = Number(request.data?.planMonths);

    if (!request.auth || !email || !email.includes("@")) {
      throw new HttpsError("unauthenticated", "請先使用會員 Gmail 登入後再續期。");
    }
    if (request.auth.token.email_verified === false) {
      throw new HttpsError("failed-precondition", "請先完成 Email 驗證後再建立續期付款。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "續期目前僅提供一個月或三個月方案。");
    }

    const settingsRef = db.doc("membershipSettings/default");
    const memberRef = db.doc(`sponsorMemberAccess/${email}`);
    const historyRef = db.doc(`membershipHistory/${email}`);
    const tradeNo = createMerchantTradeNo();
    const paymentToken = crypto.randomBytes(24).toString("base64url");
    const paymentUrl = `${FUNCTIONS_BASE_URL}/membershipPayment?order=${encodeURIComponent(tradeNo)}&token=${encodeURIComponent(paymentToken)}`;
    const orderRef = db.doc(`membershipOrders/${tradeNo}`);
    const environment = ecpayConfig.value().environment === "production" ? "production" : "stage";

    const checkout = await db.runTransaction(async (transaction) => {
      const [settingsSnapshot, memberSnapshot, historySnapshot] = await Promise.all([
        transaction.get(settingsRef),
        transaction.get(memberRef),
        transaction.get(historyRef)
      ]);

      const member = memberSnapshot.data() || {};
      const history = historySnapshot.data() || {};
      if (!hasPurchasedBefore(member, history)) {
        throw new HttpsError("failed-precondition", "目前找不到可續期的贊助文章閱讀紀錄。");
      }

      const settings = normalizeSponsorOfferSettings(settingsSnapshot.data() || {});
      const amount = sponsorPlanAmount(planMonths, "regular", settings);
      if (!amount) {
        throw new HttpsError("failed-precondition", "續期方案價格設定不正確。");
      }

      const existingOrderNo = cleanText(member.pendingOrderNo, 20);
      let existingOrderSnapshot = null;
      let existingOrder = null;
      if (existingOrderNo) {
        existingOrderSnapshot = await transaction.get(db.doc(`membershipOrders/${existingOrderNo}`));
        existingOrder = existingOrderSnapshot.exists ? existingOrderSnapshot.data() || {} : null;
      }

      const now = Timestamp.now();
      const paymentLinkExpiresAt = Timestamp.fromMillis(
        now.toMillis() + settings.reservationHours * 60 * 60 * 1000
      );
      const existingExpiry = toDate(member.expiresAt || history?.sponsor?.expiresAt);
      const preserveActiveMembership = member.status === "active"
        && existingExpiry
        && existingExpiry > now.toDate();

      if (existingOrderSnapshot?.exists && existingOrder?.status === "pending") {
        transaction.update(existingOrderSnapshot.ref, {
          status: "cancelled",
          replacedByOrderNo: tradeNo,
          updatedAt: now
        });
      }

      transaction.create(orderRef, {
        merchantTradeNo: tradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: false,
        wellnessAccess: false,
        amount,
        planMonths,
        priceTier: "regular",
        renewal: true,
        status: "pending",
        manualPaymentReview: false,
        paymentProvider: "ecpay-aio",
        paymentTokenHash: tokenHash(paymentToken),
        externalPaymentUrl: paymentUrl,
        paymentLinkExpiresAt,
        ecpayEnvironment: environment,
        createdBy: `self-service-renewal:${uid || email}`,
        createdAt: now,
        updatedAt: now
      });

      const pendingMember = {
        email,
        name: name || member.name || "",
        memberType: "sponsor-member",
        articleAccess: preserveActiveMembership,
        wellnessAccess: false,
        pendingPlanMonths: planMonths,
        pendingAmount: amount,
        pendingPriceTier: "regular",
        pendingOrderNo: tradeNo,
        pendingPaymentUrl: paymentUrl,
        pendingPaymentDeadline: paymentLinkExpiresAt,
        updatedAt: now
      };

      if (!preserveActiveMembership) {
        Object.assign(pendingMember, {
          planMonths,
          amount,
          priceTier: "regular",
          paymentStatus: "pending",
          status: "pending"
        });
      }

      transaction.set(memberRef, pendingMember, { merge: true });

      return {
        paymentUrl,
        amount,
        planMonths,
        priceTier: "regular"
      };
    });

    return checkout;
  }
);
