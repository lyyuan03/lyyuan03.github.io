"use strict";

const crypto = require("node:crypto");

const ECPAY_ENDPOINTS = {
  production: "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
  stage: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
};

function ecpayUrlEncode(value) {
  return encodeURIComponent(value)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2a/g, "*")
    .replace(/%2d/g, "-")
    .replace(/%2e/g, ".")
    .replace(/%5f/g, "_");
}

function createCheckMacValue(parameters, hashKey, hashIV) {
  const entries = Object.entries(parameters)
    .filter(([key]) => key.toLowerCase() !== "checkmacvalue")
    .sort(([left], [right]) => left.toLowerCase().localeCompare(right.toLowerCase()));
  const query = entries.map(([key, value]) => `${key}=${value ?? ""}`).join("&");
  const encoded = ecpayUrlEncode(`HashKey=${hashKey}&${query}&HashIV=${hashIV}`);
  return crypto.createHash("sha256").update(encoded).digest("hex").toUpperCase();
}

function verifyCheckMacValue(parameters, hashKey, hashIV) {
  const received = String(parameters.CheckMacValue || "").toUpperCase();
  const expected = createCheckMacValue(parameters, hashKey, hashIV);
  if (!received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function checkoutEndpoint(environment) {
  return environment === "production" ? ECPAY_ENDPOINTS.production : ECPAY_ENDPOINTS.stage;
}

function formatTaipeiTradeDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function createMerchantTradeNo(date = new Date(), randomBytes = crypto.randomBytes(4)) {
  const stamp = date.toISOString().replace(/\D/g, "").slice(2, 14);
  const suffix = randomBytes.toString("hex").slice(0, 5).toUpperCase();
  return `LYY${stamp}${suffix}`;
}

module.exports = {
  checkoutEndpoint,
  createCheckMacValue,
  createMerchantTradeNo,
  formatTaipeiTradeDate,
  verifyCheckMacValue
};
