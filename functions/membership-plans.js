"use strict";

const SPONSOR_PROMO_LIMIT = 200;

const SPONSOR_PROMO_PLANS = Object.freeze({
  1: 120,
  3: 300
});

const SPONSOR_REGULAR_PLANS = Object.freeze({
  1: 150,
  3: 400
});

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeSponsorOfferSettings(settings = {}) {
  return {
    promoLimit: positiveInteger(settings.sponsorPromoLimit, SPONSOR_PROMO_LIMIT),
    promoPrice1: positiveInteger(settings.sponsorPromoPrice1 ?? settings.price1, SPONSOR_PROMO_PLANS[1]),
    promoPrice3: positiveInteger(settings.sponsorPromoPrice3 ?? settings.price3, SPONSOR_PROMO_PLANS[3]),
    regularPrice1: positiveInteger(settings.sponsorRegularPrice1, SPONSOR_REGULAR_PLANS[1]),
    regularPrice3: positiveInteger(settings.sponsorRegularPrice3, SPONSOR_REGULAR_PLANS[3]),
    paymentDays: positiveInteger(settings.paymentDays, 3),
    reservationHours: positiveInteger(settings.sponsorReservationHours, 24)
  };
}

function sponsorPlanAmount(months, tier = "promo", settings = {}) {
  const normalized = normalizeSponsorOfferSettings(settings);
  const planMonths = Number(months);
  if (![1, 3].includes(planMonths)) return null;
  if (tier === "regular") {
    return planMonths === 3 ? normalized.regularPrice3 : normalized.regularPrice1;
  }
  return planMonths === 3 ? normalized.promoPrice3 : normalized.promoPrice1;
}

module.exports = {
  SPONSOR_PROMO_LIMIT,
  SPONSOR_PROMO_PLANS,
  SPONSOR_REGULAR_PLANS,
  normalizeSponsorOfferSettings,
  sponsorPlanAmount
};
