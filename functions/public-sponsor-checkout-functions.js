"use strict";

const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
const SITE_URL = "https://lyyuan.tw";

const ecpayConfig = defineJsonSecret("ECPAY_CONFIG");
const smtpConfig = defineJsonSecret("SMTP_CONFIG");

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function cleanText(value = "", maximum = 100) {
  return String(value).replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, maximum);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
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

async function sendReservationEmail({ email, name, amount, months, paymentUrl, priceTier, promotionSequence, expiresAt }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  const expiry = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "long",
    timeStyle: "short"
  }).format(expiresAt);
  const offerLine = priceTier === "promo"
    ? `前200名優惠名額已保留${promotionSequence ? `（第 ${promotionSequence} 人次）` : ""}`
    : "本次適用一般方案價格";

  await transporter.sendMail({
    from,
    to: email,
    subject: `靈元院贊助閱讀｜${months}個月方案付款連結`,
    text: `${displayName}您好：\n\n${offerLine}\n會員期間：${months}個月\n應繳金額：新台幣 ${amount.toLocaleString("zh-TW")} 元\n付款期限：${expiry}\n\n請由以下專屬連結前往綠界安全付款：\n${paymentUrl}\n\n付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>
      <p><strong>${htmlEscape(offerLine)}</strong></p>
      <p>會員期間：<strong>${months}個月</strong><br>應繳金額：<strong>新台幣 ${amount.toLocaleString("zh-TW")} 元</strong><br>付款期限：<strong>${htmlEscape(expiry)}</strong></p>
      <p><a href="${htmlEscape(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#606330;color:#fff;text-decoration:none">前往綠界安全付款</a></p>
      <p>付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。</p>
      <p><a href="${SITE_URL}/articles.html">返回靈元院文選</a></p>
      <p>LYY靈元院行政團隊</p>`
  });
}

async function readOfferStatus(transaction, excludedOrderNo = "") {
  const settingsRef = db.doc("membershipSettings/default");
  const ordersQuery = db.collection("membershipOrders").where("memberType", "==", "sponsor-member");
  const membersQuery = db.collection("memberAccess").where("memberType", "==", "sponsor-member");

  const [settingsSnapshot, ordersSnapshot, membersSnapshot] = await Promise.all([
    transaction.get(settingsRef),
    transaction.get(ordersQuery),
    transaction.get(membersQuery)
  ]);
  const settings = normalizeSponsorOfferSettings(settingsSnapshot.data() || {});
  const now = Date.now();

  let paidCount = 0;
  let pendingCount = 0;
  ordersSnapshot.docs.forEach((item) => {
    if (item.id === excludedOrderNo) return;
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
  return {
    settings,
    occupiedCount,
    remaining: Math.max(0, settings.promoLimit - occupiedCount),
    promotionAvailable: occupiedCount < settings.promoLimit
  };
}

function paymentUrlFor(tradeNo, paymentToken) {
  return `${FUNCTIONS_BASE_URL}/membershipPayment?order=${encodeURIComponent(tradeNo)}&token=${encodeURIComponent(paymentToken)}`;
}

exports.createPublicSponsorCheckout = onCall(
  {
    region: REGION,
    secrets: [ecpayConfig, smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    const email = normalizeEmail(request.auth?.token?.email);
    const uid = cleanText(request.auth?.uid, 128);
    const name = cleanText(request.data?.name || request.auth?.token?.name || "", 60);
    const planMonths = Number(request.data?.planMonths);

    if (!request.auth || !email || !email.includes("@")) {
      throw new HttpsError("unauthenticated", "請先使用將來閱讀文章的 Email 登入會員帳號。");
    }
    if (request.auth.token.email_verified === false) {
      throw new HttpsError("failed-precondition", "請先完成 Email 驗證後再建立付款訂單。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "目前僅提供一個月或三個月方案。");
    }

    const config = ecpayConfig.value();
    if (!config.merchantId || !config.hashKey || !config.hashIV) {
      throw new HttpsError("failed-precondition", "綠界金流尚未完成安全設定。");
    }

    const memberRef = db.doc(`memberAccess/${email}`);
    const newTradeNo = createMerchantTradeNo();
    const newPaymentToken = crypto.randomBytes(24).toString("base64url");
    const newOrderRef = db.doc(`membershipOrders/${newTradeNo}`);

    const checkout = await db.runTransaction(async (transaction) => {
      const memberSnapshot = await transaction.get(memberRef);
      const member = memberSnapshot.data() || {};
      const existingOrderNo = cleanText(member.pendingOrderNo, 20);
      let existingOrderSnapshot = null;
      let existingOrder = null;

      if (existingOrderNo) {
        existingOrderSnapshot = await transaction.get(db.doc(`membershipOrders/${existingOrderNo}`));
        existingOrder = existingOrderSnapshot.exists ? existingOrderSnapshot.data() : null;
      }

      const existingIsReusable = Boolean(
        existingOrder
        && existingOrder.memberType === "sponsor-member"
        && existingOrder.email === email
        && existingOrder.status === "pending"
        && millis(existingOrder.paymentLinkExpiresAt) > Date.now()
        && Number(existingOrder.planMonths) === planMonths
        && existingOrder.paymentAccessToken
      );

      if (existingIsReusable) {
        const status = await readOfferStatus(transaction);
        return {
          merchantTradeNo: existingOrderNo,
          paymentToken: existingOrder.paymentAccessToken,
          amount: Number(existingOrder.amount),
          planMonths: Number(existingOrder.planMonths),
          priceTier: existingOrder.priceTier || "regular",
          promotionSequence: existingOrder.promotionSequence || null,
          paymentLinkExpiresAt: existingOrder.paymentLinkExpiresAt,
          offerRemaining: status.remaining,
          reused: true
        };
      }

      const excludeExistingOrder = existingOrder
        && existingOrder.status === "pending"
        && millis(existingOrder.paymentLinkExpiresAt) > Date.now()
        ? existingOrderNo
        : "";
      const status = await readOfferStatus(transaction, excludeExistingOrder);
      const priceTier = status.promotionAvailable ? "promo" : "regular";
      const amount = sponsorPlanAmount(planMonths, priceTier, status.settings);
      const now = Timestamp.now();
      const paymentLinkExpiresAt = Timestamp.fromMillis(
        now.toMillis() + status.settings.paymentDays * 24 * 60 * 60 * 1000
      );
      const promotionSequence = priceTier === "promo" ? status.occupiedCount + 1 : null;
      const existingExpiry = dateValue(member.expiresAt);
      const preserveActiveMembership = member.status === "active"
        && existingExpiry
        && existingExpiry > now.toDate();

      if (existingOrderSnapshot?.exists && existingOrder?.status === "pending") {
        transaction.update(existingOrderSnapshot.ref, {
          status: millis(existingOrder.paymentLinkExpiresAt) > Date.now() ? "cancelled" : "expired",
          replacedByOrderNo: newTradeNo,
          updatedAt: now
        });
      }

      transaction.create(newOrderRef, {
        merchantTradeNo: newTradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "pending",
        paymentTokenHash: tokenHash(newPaymentToken),
        paymentAccessToken: newPaymentToken,
        paymentLinkExpiresAt,
        ecpayEnvironment: config.environment === "production" ? "production" : "stage",
        createdBy: `self-service:${uid || email}`,
        createdAt: now,
        updatedAt: now
      });

      const pendingMember = {
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        pendingPlanMonths: planMonths,
        pendingAmount: amount,
        pendingPriceTier: priceTier,
        pendingPromotionSequence: promotionSequence,
        pendingOrderNo: newTradeNo,
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
        merchantTradeNo: newTradeNo,
        paymentToken: newPaymentToken,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        paymentLinkExpiresAt,
        offerRemaining: Math.max(0, status.remaining - (priceTier === "promo" ? 1 : 0)),
        reused: false
      };
    });

    const paymentUrl = paymentUrlFor(checkout.merchantTradeNo, checkout.paymentToken);
    let emailSent = false;
    if (!checkout.reused) {
      try {
        await sendReservationEmail({
          email,
          name,
          amount: checkout.amount,
          months: checkout.planMonths,
          paymentUrl,
          priceTier: checkout.priceTier,
          promotionSequence: checkout.promotionSequence,
          expiresAt: checkout.paymentLinkExpiresAt.toDate()
        });
        emailSent = true;
        await db.doc(`membershipOrders/${checkout.merchantTradeNo}`).update({
          emailStatus: "sent",
          emailSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Public sponsor reservation email failed", {
          tradeNo: checkout.merchantTradeNo,
          error
        });
        await db.doc(`membershipOrders/${checkout.merchantTradeNo}`).update({
          emailStatus: "error",
          emailError: cleanText(error.message, 300),
          updatedAt: FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }

    return {
      merchantTradeNo: checkout.merchantTradeNo,
      paymentUrl,
      amount: checkout.amount,
      planMonths: checkout.planMonths,
      priceTier: checkout.priceTier,
      promotionSequence: checkout.promotionSequence,
      offerRemaining: checkout.offerRemaining,
      paymentDeadline: checkout.paymentLinkExpiresAt.toDate().toISOString(),
      reused: checkout.reused,
      emailSent
    };
  }
);

exports.expireSponsorCheckoutReservations = onSchedule(
  {
    region: REGION,
    schedule: "every 60 minutes",
    timeZone: "Asia/Taipei"
  },
  async () => {
    const snapshot = await db.collection("membershipOrders").where("status", "==", "pending").get();
    const expiredOrders = snapshot.docs.filter((item) => {
      const order = item.data();
      return order.memberType === "sponsor-member" && millis(order.paymentLinkExpiresAt) <= Date.now();
    });

    for (let start = 0; start < expiredOrders.length; start += 200) {
      const chunk = expiredOrders.slice(start, start + 200);
      const memberSnapshots = await Promise.all(chunk.map((item) => {
        const email = normalizeEmail(item.data().email);
        return email ? db.doc(`memberAccess/${email}`).get() : Promise.resolve(null);
      }));
      const batch = db.batch();
      const expiredAt = Timestamp.now();

      chunk.forEach((item, index) => {
        batch.update(item.ref, {
          status: "expired",
          expiredAt,
          updatedAt: expiredAt
        });
        const memberSnapshot = memberSnapshots[index];
        if (!memberSnapshot?.exists || memberSnapshot.data().pendingOrderNo !== item.id) return;
        batch.set(memberSnapshot.ref, {
          pendingOrderNo: FieldValue.delete(),
          pendingPlanMonths: FieldValue.delete(),
          pendingAmount: FieldValue.delete(),
          pendingPriceTier: FieldValue.delete(),
          pendingPromotionSequence: FieldValue.delete(),
          updatedAt: expiredAt
        }, { merge: true });
      });

      await batch.commit();
    }

    console.log(`Expired ${expiredOrders.length} sponsor checkout reservation(s).`);
  }
);
