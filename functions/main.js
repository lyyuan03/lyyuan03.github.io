"use strict";

const membershipFunctions = require("./index");
const sponsorOfferFunctions = require("./sponsor-offer-functions");
const publicSponsorCheckoutFunctions = require("./public-sponsor-checkout-functions");
const publicSponsorCheckoutV2Functions = require("./public-sponsor-checkout-v2-functions");
const paidArticleFunctions = require("./paid-article-functions");
const memberOfferFunctions = require("./member-offers-functions");
const articleNotifyFunctions = require("./article-notify-functions");

module.exports = {
  ...membershipFunctions,
  ...sponsorOfferFunctions,
  ...publicSponsorCheckoutFunctions,
  ...memberOfferFunctions,
  ...articleNotifyFunctions,
  ...paidArticleFunctions,
  // 最後覆寫舊的公開贊助付款函式：改走綠界自動 callback 開通，並回報自動開通狀態。
  ...publicSponsorCheckoutV2Functions
};
