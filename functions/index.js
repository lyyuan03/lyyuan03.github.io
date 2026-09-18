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
const { sponsorPlanAmount } = require("./membership-plans");

initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const DEFAULT_PRICE = 6000;
const DEFAULT_MONTHS = 4;
const ARTICLE_BENEFIT_THRESHOLD = 15000;
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
  return Boolean(
    request.auth
    && request.auth.token
    && request.auth.token.email_verified === true
    && ADMIN_EMAILS.has(normalizeEmail(request.auth.token.email))
  );
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
    "&": "&",
    "<": "<",
    ">": ">",
    '"': """,
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
    text: `${displayName}您好：\n\n感謝您申請靈元院養生療癒頻道會員。\n\n會員期間：${months}個月\n應繳金額：新台幣 ${amount.toLocaleString("zh-TW")} 元\n\n請由以下專屬連結前往綠界安全付款：\n${paymentUrl}\n\n付款成功後，系統會自動開通會員資格，不需要再回覆帳號。\n請使用本信收件 Gmail 登入靈元院官網。\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>\n      <p>感謝您申請靈元院養生療癒頻道會員。</p>\n      <p>會員期間：<strong>${months}個月</strong><br>應繳金額：<strong>新台幣 ${amount.toLocaleString("zh-TW")} 元</strong></p>\n      <p><a href="${htmlEscape(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#606330;color:#fff;text-decoration:none">前往綠界安全付款</a></p>\n      <p>付款成功後，系統會自動開通會員資格，不需要再回覆帳號。請使用本信收件 Gmail 登入靈元院官網。</p>\n      <p>LYY靈元院行政團隊</p>`
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
    text: `${displayName}您好：\n\n您的款項已確認，靈元院養生療癒頻道會員資格已自動開通。\n本次會期至：${expiry}\n\n請使用本信收件 Gmail 登入靈元院官網，即可使用會員閱讀權限。\n${SITE_URL}/articles.html\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>\n      <p>您的款項已確認，靈元院養生療癒頻道會員資格已自動開通。</p>\n      <p>本次會期至：<strong>${htmlEscape(expiry)}</strong></p>\n      <p><a href="${SITE_URL}/articles.html">登入靈元院官網</a></p>\n      <p>LYY靈元院行政團隊</p>`
  });
}

async function sendSponsorPaymentEmail({ email, name, amount, months, paymentUrl }) {
  const { transporter, from } = mailTransport();
  const displayName = name || "會員";
  await transporter.sendMail({
    from,
    to: email,
    subject: `靈元院一般會員｜${months}個月方案繳費通知`,
    text: `${displayName}您好：\n\n感謝您申請靈元院一般會員。\n\n會員期間：${months}個月\n應繳金額：新台幣 ${amount.toLocaleString("zh-TW")} 元\n\n請由以下專屬連結前往綠界安全付款：\n${paymentUrl}\n\n付款成功後，系統會自動開通會員資格，不需要再回覆帳號。\n請使用本信收件 Gmail 登入靈元院官網。\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>\n      <p>感謝您申請靈元院一般會員。</p>\n      <p>會員期間：<strong>${months}個月</strong><br>應繳金額：<strong>新台幣 ${amount.toLocaleString("zh-TW")} 元</strong></p>\n      <p><a href="${htmlEscape(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#606330;color:#fff;text-decoration:none">前往綠界安全付款</a></p>\n      <p>付款成功後，系統會自動開通會員資格，不需要再回覆帳號。請使用本信收件 Gmail 登入靈元院官網。</p>\n      <p>LYY靈元院行政團隊</p>`
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
    subject: "靈元院一般會員｜會員資格已開通",
    text: `${displayName}您好：\n\n您的款項已確認，靈元院一般會員資格已自動開通。\n本次會期至：${expiry}\n\n請使用本信收件 Gmail 登入靈元院官網。\n${SITE_URL}/articles.html\n\nLYY靈元院行政團隊`,
    html: `<p>${htmlEscape(displayName)}您好：</p>\n      <p>您的款項已確認，靈元院一般會員資格已自動開通。</p>\n      <p>本次會期至：<strong>${htmlEscape(expiry)}</strong></p>\n      <p><a href="${SITE_URL}/articles.html">登入靈元院官網</a></p>\n      <p>LYY靈元院行政團隊</p>`
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
