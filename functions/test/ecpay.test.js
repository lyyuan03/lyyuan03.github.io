"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkoutEndpoint,
  createCheckMacValue,
  createMerchantTradeNo,
  formatTaipeiTradeDate,
  verifyCheckMacValue
} = require("../ecpay");

test("creates the official ECPay SHA256 example checksum", () => {
  const parameters = {
    MerchantID: "3002607",
    MerchantTradeNo: "ecpay20230312153023",
    MerchantTradeDate: "2023/03/12 15:30:23",
    PaymentType: "aio",
    TotalAmount: "30000",
    TradeDesc: "促銷方案",
    ItemName: "Apple iphone 15",
    ReturnURL: "https://www.ecpay.com.tw/receive.php",
    ChoosePayment: "ALL",
    EncryptType: "1"
  };
  assert.equal(
    createCheckMacValue(parameters, "pwFHCqoQZGmho4w6", "EkRm7iFT261dpevs"),
    "6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840"
  );
});

test("verifies callback checksum without including CheckMacValue itself", () => {
  const parameters = {
    MerchantID: "3002607",
    MerchantTradeNo: "LYY260730123456ABCDE",
    RtnCode: "1",
    TradeAmt: "6000"
  };
  parameters.CheckMacValue = createCheckMacValue(parameters, "key", "iv");
  assert.equal(verifyCheckMacValue(parameters, "key", "iv"), true);
  parameters.TradeAmt = "1";
  assert.equal(verifyCheckMacValue(parameters, "key", "iv"), false);
});

test("merchant trade number stays alphanumeric and within 20 characters", () => {
  const tradeNo = createMerchantTradeNo(
    new Date("2026-07-30T09:30:00.000Z"),
    Buffer.from("abcde123", "hex")
  );
  assert.match(tradeNo, /^[A-Z0-9]+$/);
  assert.equal(tradeNo.length, 20);
});

test("formats trade date in Asia/Taipei", () => {
  assert.equal(formatTaipeiTradeDate(new Date("2026-07-30T09:30:00.000Z")), "2026/07/30 17:30:00");
});

test("selects stage and production endpoints explicitly", () => {
  assert.match(checkoutEndpoint("stage"), /payment-stage\.ecpay\.com\.tw/);
  assert.match(checkoutEndpoint("production"), /payment\.ecpay\.com\.tw/);
});
