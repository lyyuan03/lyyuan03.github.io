"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSponsorOfferSettings,
  sponsorPlanAmount
} = require("../membership-plans");

test("supports the approved promotional and regular sponsor plans", () => {
  assert.equal(sponsorPlanAmount(1, "promo"), 150);
  assert.equal(sponsorPlanAmount(3, "promo"), 400);
  assert.equal(sponsorPlanAmount(1, "regular"), 180);
  assert.equal(sponsorPlanAmount(3, "regular"), 500);
  assert.equal(sponsorPlanAmount(12, "promo"), null);
  assert.equal(sponsorPlanAmount("custom", "regular"), null);
});

test("allows the admin settings document to override plan values safely", () => {
  const settings = normalizeSponsorOfferSettings({
    sponsorPromoLimit: 250,
    sponsorPromoPrice1: 130,
    sponsorPromoPrice3: 320,
    sponsorRegularPrice1: 160,
    sponsorRegularPrice3: 420,
    paymentDays: 5,
    sponsorReservationHours: 36
  });

  assert.deepEqual(settings, {
    promoLimit: 250,
    promoPrice1: 130,
    promoPrice3: 320,
    regularPrice1: 160,
    regularPrice3: 420,
    paymentDays: 5,
    reservationHours: 36
  });
  assert.equal(sponsorPlanAmount(3, "regular", settings), 420);
});

test("uses a 24-hour reservation window when no override is provided", () => {
  const settings = normalizeSponsorOfferSettings({});
  assert.equal(settings.reservationHours, 24);
});