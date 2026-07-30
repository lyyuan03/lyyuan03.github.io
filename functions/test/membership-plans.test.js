"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sponsorPlanAmount } = require("../membership-plans");

test("supports only the two approved general membership plans", () => {
  assert.equal(sponsorPlanAmount(1), 120);
  assert.equal(sponsorPlanAmount(3), 300);
  assert.equal(sponsorPlanAmount(12), null);
  assert.equal(sponsorPlanAmount("custom"), null);
});
