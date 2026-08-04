"use strict";

const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineJsonSecret } = require("firebase-functions/params");
const { createMerchantTradeNo } = require("./ecpay");
const {
  normalizeSponsorOfferSettings,
  sponsorPlanAmount
} = require("./membership-plans");

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const FUNCTIONS_BASE_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net";
const SITE_URL = "https://lyyuan.tw";

const ecpayConfig = defineJsonSecret("ECPAY_CONFIG");
const smtpConfig = defineJsonSecret("SMTP_CONFIG");

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function cleanText(value = "", maximum = 100) {
  return String(value).replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, maximum);
}

function isAdminRequest(request) {
  return Boolean(request.auth && ADMIN_EMAILS.has(normalizeEmail(request.auth.token.email)));
}

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function htmlEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function mailTransport() {
  const config = smtpConfig.value();
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: Number(config.port || 465),
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.pass
      }
    }),
    from: config.from || `LYY靈元院行政團隊 <${config.user}>`
  };
}

async function sendSponsorPaymentEmail({ email, name, amount, months, paymentUrl, priceTier, promotionSequence }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  const offerLine = priceTier === "promo"
    ? `本次適用前200名優惠${promotionSequence ? `（第 ${promotionSequence} 名）` : ""}`
    : "本次適用一般方案價格";
  await transporter.sendMail({
    from,
    to: email,
    subject: `靈元院贊助會員｜${months}個月方案繳費通知`,
    text: `${displayName}您好：\n\n感謝您申請靈元院贊助會員。\n\n${offerLine}\n會員期間：${months}個月\n應繳金額：新台幣 ${amount.toLocaleString("zh-TW")} 元\n\n請由以下專屬連結前往綠界安全付款：\n${paymentUrl}\n\n付款成功後，系統會自動開通會員閱讀資格。請使用本信收件 Email 登入靈元院官網。\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>
      <p>感謝您申請靈元院贊助會員。</p>
      <p><strong>${htmlEscape(offerLine)}</strong><br>會員期間：<strong>${months}個月</strong><br>應繳金額：<strong>新台幣 ${amount.toLocaleString("zh-TW")} 元</strong></p>
      <p><a href="${htmlEscape(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#606330;color:#fff;text-decoration:none">前往綠界安全付款</a></p>
      <p>付款成功後，系統會自動開通會員閱讀資格。請使用本信收件 Email 登入靈元院官網。</p>
      <p>LYY靈元院行政團隊</p>`
  });
}

async function sendSponsorActivationEmail({ email, name, expiresAt }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  const expiry = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "long"
  }).format(expiresAt);
  await transporter.sendMail({
    from,
    to: email,
    subject: "靈元院贊助會員｜閱讀資格已開通",
    text: `${displayName}您好：\n\n您的款項已確認，靈元院贊助會員閱讀資格已開通。\n本次會期至：${expiry}\n\n請使用本信收件 Email 登入靈元院官網。\n${SITE_URL}/articles.html\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>
      <p>您的款項已確認，靈元院贊助會員閱讀資格已開通。</p>
      <p>本次會期至：<strong>${htmlEscape(expiry)}</strong></p>
      <p><a href="${SITE_URL}/articles.html">登入靈元院官網</a></p>
      <p>LYY靈元院行政團隊</p>`
  });
}

function millis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readSponsorOfferStatus(reader = null) {
  const get = reader
    ? (target) => reader.get(target)
    : (target) => target.get();
  const settingsRef = db.doc("membershipSettings/default");
  const ordersQuery = db.collection("membershipOrders").where("memberType", "==", "sponsor-member");
  const membersQuery = db.collection("sponsorMemberAccess").where("memberType", "==", "sponsor-member");

  const settingsSnapshot = await get(settingsRef);
  const ordersSnapshot = await get(ordersQuery);
  const membersSnapshot = await get(membersQuery);
  const settings = normalizeSponsorOfferSettings(settingsSnapshot.data() || {});
  const now = Date.now();

  let paidCount = 0;
  let pendingCount = 0;
  ordersSnapshot.docs.forEach((item) => {
    const order = item.data();
    if (order.status === "paid") {
      paidCount += 1;
      return;
    }
    if (order.status === "pending" && millis(order.paymentLinkExpiresAt) > now) pendingCount += 1;
  });

  let legacyPaidCount = 0;
  membersSnapshot.docs.forEach((item) => {
    const member = item.data();
    if (member.paymentStatus === "paid" && !member.lastOrderNo) legacyPaidCount += 1;
  });

  const occupiedCount = paidCount + pendingCount + legacyPaidCount;
  const remaining = Math.max(0, settings.promoLimit - occupiedCount);
  return {
    settings,
    paidCount,
    pendingCount,
    legacyPaidCount,
    occupiedCount,
    remaining,
    promotionAvailable: remaining > 0,
    currentTier: remaining > 0 ? "promo" : "regular"
  };
}

function publicOfferPayload(status) {
  const { settings } = status;
  return {
    promoLimit: settings.promoLimit,
    promoPrice1: settings.promoPrice1,
    promoPrice3: settings.promoPrice3,
    regularPrice1: settings.regularPrice1,
    regularPrice3: settings.regularPrice3,
    paidCount: status.paidCount + status.legacyPaidCount,
    pendingCount: status.pendingCount,
    occupiedCount: status.occupiedCount,
    remaining: status.remaining,
    promotionAvailable: status.promotionAvailable,
    currentTier: status.currentTier,
    currentPrice1: sponsorPlanAmount(1, status.currentTier, settings),
    currentPrice3: sponsorPlanAmount(3, status.currentTier, settings)
  };
}

exports.sponsorOfferStatus = onRequest(
  {
    region: REGION,
    cors: [/^https:\/\/(www\.)?lyyuan\.tw$/]
  },
  async (request, response) => {
    if (request.method !== "GET") {
      response.status(405).json({ ready: false });
      return;
    }
    try {
      const status = await readSponsorOfferStatus();
      response.set("Cache-Control", "no-store");
      response.status(200).json({ ready: true, ...publicOfferPayload(status) });
    } catch (error) {
      console.error("Sponsor offer status failed", error);
      response.status(500).json({ ready: false });
    }
  }
);

exports.createSponsorMembershipCheckout = onCall(
  {
    region: REGION,
    secrets: [ecpayConfig, smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError("permission-denied", "僅限靈元院管理員建立付款訂單。");
    }

    const email = normalizeEmail(request.data?.email);
    const name = cleanText(request.data?.name, 60);
    const planMonths = Number(request.data?.planMonths);
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "請填寫有效的會員 Email。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "贊助會員目前僅提供一個月或三個月方案。");
    }

    const tradeNo = createMerchantTradeNo();
    const paymentToken = crypto.randomBytes(24).toString("base64url");
    const paymentUrl = `${FUNCTIONS_BASE_URL}/membershipPayment?order=${encodeURIComponent(tradeNo)}&token=${encodeURIComponent(paymentToken)}`;
    const orderRef = db.doc(`membershipOrders/${tradeNo}`);
    const memberRef = db.doc(`sponsorMemberAccess/${email}`);

    const checkout = await db.runTransaction(async (transaction) => {
      const status = await readSponsorOfferStatus(transaction);
      const memberSnapshot = await transaction.get(memberRef);
      const member = memberSnapshot.data() || {};
      const priceTier = status.promotionAvailable ? "promo" : "regular";
      const amount = sponsorPlanAmount(planMonths, priceTier, status.settings);
      const now = Timestamp.now();
      const nowDate = now.toDate();
      const existingExpiry = dateValue(member.expiresAt);
      const preserveActiveMembership = member.status === "active"
        && existingExpiry
        && existingExpiry > nowDate;
      const paymentLinkExpiresAt = Timestamp.fromMillis(
        now.toMillis() + status.settings.paymentDays * 24 * 60 * 60 * 1000
      );
      const promotionSequence = priceTier === "promo" ? status.occupiedCount + 1 : null;

      transaction.create(orderRef, {
        merchantTradeNo: tradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: false,
        wellnessAccess: false,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "pending",
        paymentTokenHash: tokenHash(paymentToken),
        paymentLinkExpiresAt,
        ecpayEnvironment: ecpayConfig.value().environment === "production" ? "production" : "stage",
        createdBy: normalizeEmail(request.auth.token.email),
        createdAt: now,
        updatedAt: now
      });

      const pendingMember = {
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: preserveActiveMembership,
        wellnessAccess: false,
        pendingPlanMonths: planMonths,
        pendingAmount: amount,
        pendingPriceTier: priceTier,
        pendingPromotionSequence: promotionSequence,
        pendingOrderNo: tradeNo,
        updatedAt: now
      };
      if (!preserveActiveMembership) {
        Object.assign(pendingMember, {
          planMonths,
          amount,
          priceTier,
          promotionSequence,
          paymentStatus: "pending",
          status: "pending"
        });
      }
      transaction.set(memberRef, pendingMember, { merge: true });

      return {
        amount,
        priceTier,
        promotionSequence,
        remaining: Math.max(0, status.remaining - (priceTier === "promo" ? 1 : 0))
      };
    });

    try {
      await sendSponsorPaymentEmail({
        email,
        name,
        amount: checkout.amount,
        months: planMonths,
        paymentUrl,
        priceTier: checkout.priceTier,
        promotionSequence: checkout.promotionSequence
      });
      await orderRef.update({
        emailStatus: "sent",
        emailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Sponsor payment email failed", { tradeNo, error });
      await orderRef.update({
        emailStatus: "error",
        emailError: cleanText(error.message, 300),
        updatedAt: FieldValue.serverTimestamp()
      });
      throw new HttpsError("internal", "訂單已建立，但繳費信寄送失敗。請檢查寄信設定後再試。");
    }

    return {
      merchantTradeNo: tradeNo,
      paymentUrl,
      amount: checkout.amount,
      planMonths,
      priceTier: checkout.priceTier,
      promotionSequence: checkout.promotionSequence,
      offerRemaining: checkout.remaining,
      emailSent: true
    };
  }
);

exports.activateSponsorMembershipManually = onCall(
  {
    region: REGION,
    secrets: [smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError("permission-denied", "僅限靈元院管理員手動開通會員。");
    }

    const email = normalizeEmail(request.data?.email);
    const name = cleanText(request.data?.name, 60);
    const note = cleanText(request.data?.note, 500);
    const planMonths = Number(request.data?.planMonths);
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "請填寫有效的會員 Email。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "贊助會員目前僅提供一個月或三個月方案。");
    }

    const tradeNo = createMerchantTradeNo();
    const orderRef = db.doc(`membershipOrders/${tradeNo}`);
    const memberRef = db.doc(`sponsorMemberAccess/${email}`);

    const activation = await db.runTransaction(async (transaction) => {
      const status = await readSponsorOfferStatus(transaction);
      const memberSnapshot = await transaction.get(memberRef);
      const member = memberSnapshot.data() || {};
      const priceTier = status.promotionAvailable ? "promo" : "regular";
      const amount = sponsorPlanAmount(planMonths, priceTier, status.settings);
      const promotionSequence = priceTier === "promo" ? status.occupiedCount + 1 : null;
      const now = new Date();
      const existingExpiry = dateValue(member.expiresAt);
      const startAt = existingExpiry && existingExpiry > now ? existingExpiry : now;
      const expiresAt = addMonths(startAt, planMonths);
      const nowTimestamp = Timestamp.fromDate(now);
      const expiryTimestamp = Timestamp.fromDate(expiresAt);

      transaction.create(orderRef, {
        merchantTradeNo: tradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "paid",
        paidAt: nowTimestamp,
        paymentType: "manual-admin",
        manualActivation: true,
        createdBy: normalizeEmail(request.auth.token.email),
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp
      });

      transaction.set(memberRef, {
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        wellnessAccess: false,
        accessScope: "sponsor-paid-articles",
        accessVersion: 2,
        planMonths,
        amount,
        priceTier,
        promotionSequence,
        paymentStatus: "paid",
        status: "active",
        disabled: false,
        suspended: false,
        revokedAt: FieldValue.delete(),
        firstJoinedAt: member.firstJoinedAt || nowTimestamp,
        startsAt: nowTimestamp,
        expiresAt: expiryTimestamp,
        paidAt: nowTimestamp,
        lastOrderNo: tradeNo,
        pendingOrderNo: FieldValue.delete(),
        pendingPlanMonths: FieldValue.delete(),
        pendingAmount: FieldValue.delete(),
        pendingPriceTier: FieldValue.delete(),
        pendingPromotionSequence: FieldValue.delete(),
        note,
        updatedAt: nowTimestamp
      }, { merge: true });
      transaction.set(db.doc(`membershipHistory/${email}`), {
        email,
        sponsor: {
          memberType: "sponsor-member",
          articleAccess: true,
          accessScope: "sponsor-paid-articles",
          accessVersion: 2,
          paymentStatus: "paid",
          startsAt: nowTimestamp,
          expiresAt: expiryTimestamp,
          lastOrderNo: tradeNo,
          verified: true,
          historicalStatus: "verified",
          verificationSource: "manual-admin",
          recordedAt: nowTimestamp
        },
        updatedAt: nowTimestamp
      }, { merge: true });

      return {
        email,
        name,
        expiresAt,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        offerRemaining: Math.max(0, status.remaining - (priceTier === "promo" ? 1 : 0)),
        merchantTradeNo: tradeNo
      };
    });

    try {
      await sendSponsorActivationEmail(activation);
      await orderRef.update({
        activationEmailStatus: "sent",
        activationEmailSentAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Manual sponsor activation email failed", { tradeNo, error });
      await orderRef.update({
        activationEmailStatus: "error",
        activationEmailError: cleanText(error.message, 300)
      });
    }

    return activation;
  }
);
