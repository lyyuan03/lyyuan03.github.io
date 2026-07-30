"use strict";

const SPONSOR_PLANS = Object.freeze({
  1: 120,
  3: 300
});

function sponsorPlanAmount(months) {
  return SPONSOR_PLANS[Number(months)] || null;
}

module.exports = {
  SPONSOR_PLANS,
  sponsorPlanAmount
};
