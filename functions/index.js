"use strict";

const crypto = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineJsonSecret } = require("firebase-functions/params");
const {
  checkoutEndpoint,
  createCheckMacValue,
  createMerchantTradeNo,
  formatTaipeiTradeDate,
  verifyCheckMacValue
} = require("./ecpay");

initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const DEFAULT_PRICE = 6000;
const DEFAULT_MONTHS = 4;
const SITE_URL = "https://lyyuan.tw";
const FUNCTIONS_BASE_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net";

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

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
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

async function sendPaymentEmail({ email, name, amount, months, paymentUrl }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  await transporter.sendMail({
    from,
    to: email,
    subject: `靈元院養生療癒頻道｜${months}個月方案繳費通知`,
    text: `${displayName}您好：

感謝您申請靈元院養生療癒頻道會員。

會員期間：${months}個月
應繳金額：新台幣 ${amount.toLocaleString("zh-TW")} 元

請由以下專屬連結前往綠界安全付款：
${paymentUrl}

付款成功後，系統會自動開通會員資格，不需要再回覆帳號。
請使用本信收件 Gmail 登入靈元院官網。

LYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>
      <p>感謝您申請靈元院養生療癒頻道會員。</p>
      <p>會員期間：<strong>${months}個月</strong><br>應繳金額：<strong>新台幣 ${amount.toLocaleString("zh-TW")} 元</strong></p>
      <p><a href="${htmlEscape(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#606330;color:#fff;text-decoration:none">前往綠界安全付款</a></p>
      <p>付款成功後，系統會自動開通會員資格，不需要再回覆帳號。請使用本信收件 Gmail 登入靈元院官網。</p>
      <p>LYY靈元院行政團隊</p>`
  });
}

async function sendActivationEmail({ email, name, expiresAt }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  const expiry = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "long"
  }).format(expiresAt);
  await transporter.sendMail({
    from,
    to: email,
    subject: "靈元院養生療癒頻道｜會員資格已開通",
    text: `${displayName}您好：

您的款項已確認，靈元院養生療癒頻道會員資格已自動開通。
本次會期至：${expiry}

請使用本信收件 Gmail 登入靈元院官網，即可使用會員閱讀權限。
${SITE_URL}/articles.html

LYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>
      <p>您的款項已確認，靈元院養生療癒頻道會員資格已自動開通。</p>
      <p>本次會期至：<strong>${htmlEscape(expiry)}</strong></p>
      <p><a href="${SITE_URL}/articles.html">登入靈元院官網</a></p>
      <p>LYY靈元院行政團隊</p>`
  });
}

exports.membershipBackendStatus = onRequest(
  {
    region: REGION,
    secrets: [ecpayConfig, smtpConfig],
    cors: [/^https:\/\/(www\.)?lyyuan\.tw$/]
  },
  (request, response) => {
    if (request.method !== "GET") {
      response.status(405).json({ ready: false });
      return;
    }
    const payment = ecpayConfig.value();
    const mail = smtpConfig.value();
    const ready = Boolean(
      payment.merchantId && payment.hashKey && payment.hashIV
      && mail.host && mail.user && mail.pass
    );
    response.set("Cache-Control", "no-store");
    response.status(ready ? 200 : 503).json({
      ready,
      environment: payment.environment === "production" ? "production" : "stage"
    });
  }
);

exports.createMembershipCheckout = onCall(
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
    const memberLevel = request.data?.memberLevel === "lingji" ? "lingji" : "wellness";
    const articleAccess = memberLevel === "lingji" || request.data?.articleAccess !== false;
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "請填寫有效的會員 Gmail。");
    }

    const settingsSnapshot = await db.doc("membershipSettings/default").get();
    const settings = settingsSnapshot.data() || {};
    const amount = Number(settings.wellnessPrice || DEFAULT_PRICE);
    const planMonths = Number(settings.wellnessMonths || DEFAULT_MONTHS);
    if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(planMonths) || planMonths <= 0) {
      throw new HttpsError("failed-precondition", "養生療癒會員方案金額或會期設定不正確。");
    }

    const config = ecpayConfig.value();
    const tradeNo = createMerchantTradeNo();
    const paymentToken = crypto.randomBytes(24).toString("base64url");
    const paymentUrl = `${FUNCTIONS_BASE_URL}/membershipPayment?order=${encodeURIComponent(tradeNo)}&token=${encodeURIComponent(paymentToken)}`;
    const orderRef = db.doc(`membershipOrders/${tradeNo}`);
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 3 * 24 * 60 * 60 * 1000);

    await orderRef.create({
      merchantTradeNo: tradeNo,
      email,
      name,
      memberLevel,
      articleAccess,
      memberType: "wellness-channel",
      amount,
      planMonths,
      status: "pending",
      paymentTokenHash: tokenHash(paymentToken),
      paymentLinkExpiresAt: expiresAt,
      ecpayEnvironment: config.environment === "production" ? "production" : "stage",
      createdBy: normalizeEmail(request.auth.token.email),
      createdAt: now,
      updatedAt: now
    });

    await db.doc(`memberAccess/${email}`).set({
      email,
      name,
      memberType: "wellness-channel",
      memberLevel,
      wellnessLevel: memberLevel,
      articleAccess,
      planMonths,
      amount,
      paymentStatus: "pending",
      status: "pending",
      pendingOrderNo: tradeNo,
      updatedAt: now
    }, { merge: true });

    try {
      await sendPaymentEmail({ email, name, amount, months: planMonths, paymentUrl });
      await orderRef.update({
        emailStatus: "sent",
        emailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Payment email failed", { tradeNo, error });
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
      amount,
      planMonths,
      emailSent: true
    };
  }
);

exports.membershipPayment = onRequest(
  {
    region: REGION,
    secrets: [ecpayConfig]
  },
  async (request, response) => {
    if (request.method !== "GET") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const tradeNo = cleanText(request.query.order, 20);
    const token = String(request.query.token || "");
    const orderSnapshot = await db.doc(`membershipOrders/${tradeNo}`).get();
    if (!orderSnapshot.exists) {
      response.status(404).send("找不到此付款訂單。");
      return;
    }

    const order = orderSnapshot.data();
    const expired = order.paymentLinkExpiresAt?.toMillis?.() <= Date.now();
    if (order.status !== "pending" || expired || !safeEqual(order.paymentTokenHash, tokenHash(token))) {
      response.status(410).send("此付款連結已失效或已完成付款。");
      return;
    }

    const config = ecpayConfig.value();
    const parameters = {
      MerchantID: config.merchantId,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: formatTaipeiTradeDate(),
      PaymentType: "aio",
      TotalAmount: String(order.amount),
      TradeDesc: "靈元院養生療癒頻道會員",
      ItemName: `靈元院養生療癒頻道會員${order.planMonths}個月`,
      ReturnURL: `${FUNCTIONS_BASE_URL}/ecpayMembershipCallback`,
      ChoosePayment: "ALL",
      EncryptType: "1",
      ClientBackURL: `${SITE_URL}/articles.html?payment=complete`
    };
    parameters.CheckMacValue = createCheckMacValue(parameters, config.hashKey, config.hashIV);

    const fields = Object.entries(parameters)
      .map(([key, value]) => `<input type="hidden" name="${htmlEscape(key)}" value="${htmlEscape(value)}">`)
      .join("");
    response.set("Cache-Control", "no-store");
    response.status(200).type("html").send(`<!doctype html>
      <html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>前往綠界安全付款｜靈元院</title></head>
      <body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#071106;color:#f5f0e8;font-family:sans-serif">
      <div style="text-align:center;padding:28px"><p>正在前往綠界安全付款頁面…</p>
      <form id="ecpay-form" method="post" action="${checkoutEndpoint(config.environment)}">${fields}
      <button type="submit" style="padding:12px 20px">若未自動前往，請按此繼續</button></form></div>
      <script>document.getElementById("ecpay-form").submit();</script></body></html>`);
  }
);

exports.ecpayMembershipCallback = onRequest(
  {
    region: REGION,
    secrets: [ecpayConfig, smtpConfig]
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("0|Method Not Allowed");
      return;
    }

    const parameters = { ...(request.body || {}) };
    const config = ecpayConfig.value();
    if (!verifyCheckMacValue(parameters, config.hashKey, config.hashIV)) {
      console.error("Invalid ECPay CheckMacValue", { tradeNo: parameters.MerchantTradeNo });
      response.status(400).send("0|CheckMacValue Error");
      return;
    }
    if (parameters.MerchantID !== config.merchantId || String(parameters.RtnCode) !== "1") {
      response.status(200).send("1|OK");
      return;
    }
    if (config.environment === "production" && String(parameters.SimulatePaid || "0") === "1") {
      console.warn("Ignored simulated production payment", { tradeNo: parameters.MerchantTradeNo });
      response.status(200).send("1|OK");
      return;
    }

    const tradeNo = cleanText(parameters.MerchantTradeNo, 20);
    const orderRef = db.doc(`membershipOrders/${tradeNo}`);
    let activation = null;

    try {
      activation = await db.runTransaction(async (transaction) => {
        const orderSnapshot = await transaction.get(orderRef);
        if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
        const order = orderSnapshot.data();
        if (Number(parameters.TradeAmt) !== Number(order.amount)) throw new Error("AMOUNT_MISMATCH");
        if (order.status === "paid") return null;

        const memberRef = db.doc(`memberAccess/${order.email}`);
        const memberSnapshot = await transaction.get(memberRef);
        const member = memberSnapshot.data() || {};
        const now = new Date();
        const existingExpiry = member.expiresAt?.toDate?.()
          || (member.expiresAt ? new Date(member.expiresAt) : null);
        const startAt = existingExpiry && existingExpiry > now ? existingExpiry : now;
        const expiresAt = addMonths(startAt, Number(order.planMonths));
        const nowTimestamp = Timestamp.fromDate(now);
        const expiryTimestamp = Timestamp.fromDate(expiresAt);

        transaction.set(memberRef, {
          email: order.email,
          name: order.name,
          memberType: "wellness-channel",
          memberLevel: order.memberLevel,
          wellnessLevel: order.memberLevel,
          articleAccess: order.memberLevel === "lingji" || order.articleAccess === true,
          planMonths: order.planMonths,
          amount: order.amount,
          paymentStatus: "paid",
          status: "active",
          firstJoinedAt: member.firstJoinedAt || nowTimestamp,
          startsAt: nowTimestamp,
          expiresAt: expiryTimestamp,
          paidAt: nowTimestamp,
          lastOrderNo: tradeNo,
          pendingOrderNo: FieldValue.delete(),
          updatedAt: nowTimestamp
        }, { merge: true });
        transaction.update(orderRef, {
          status: "paid",
          paidAt: nowTimestamp,
          ecpayTradeNo: cleanText(parameters.TradeNo, 30),
          paymentType: cleanText(parameters.PaymentType, 40),
          rtnMessage: cleanText(parameters.RtnMsg, 200),
          callbackReceivedAt: nowTimestamp,
          updatedAt: nowTimestamp
        });
        return { email: order.email, name: order.name, expiresAt };
      });
    } catch (error) {
      console.error("ECPay membership callback failed", { tradeNo, error: error.message });
      response.status(500).send("0|Processing Error");
      return;
    }

    if (activation) {
      try {
        await sendActivationEmail(activation);
        await orderRef.update({
          activationEmailStatus: "sent",
          activationEmailSentAt: FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Activation email failed", { tradeNo, error });
        await orderRef.update({
          activationEmailStatus: "error",
          activationEmailError: cleanText(error.message, 300)
        });
      }
    }

    response.status(200).send("1|OK");
  }
);
