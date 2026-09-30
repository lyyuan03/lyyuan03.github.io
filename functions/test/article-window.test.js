"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ARTICLE_WINDOW_EFFECTIVE_AT,
  addDays,
  sponsorPlanDays,
  articleWindowAnchor,
  articleWindowStart,
  nextArticleWindowAnchor
} = require("../article-window");

const DAY = 24 * 60 * 60 * 1000;
const afterPolicy = new Date("2026-10-15T02:00:00.000Z");

test("sponsor plans are counted in days: 1 month = 30 days, 3 months = 90 days", () => {
  assert.equal(sponsorPlanDays(1), 30);
  assert.equal(sponsorPlanDays(3), 90);
  assert.equal(sponsorPlanDays(12), null);
  assert.equal(addDays(afterPolicy, 30).getTime() - afterPolicy.getTime(), 30 * DAY);
});

test("reading window starts 30 days before the explicit anchor", () => {
  const start = articleWindowStart({ articleWindowStartsAt: afterPolicy.toISOString() });
  assert.equal(start.getTime(), afterPolicy.getTime() - 30 * DAY);
});

test("members who started after the policy date are limited even without an explicit anchor", () => {
  const start = articleWindowStart({ startsAt: afterPolicy.toISOString() });
  assert.equal(start.getTime(), afterPolicy.getTime() - 30 * DAY);
});

test("pre-policy members keep unrestricted access for the current term", () => {
  const record = { startsAt: "2026-06-01T00:00:00.000Z", expiresAt: "2026-12-01T00:00:00.000Z" };
  assert.equal(articleWindowAnchor(record), null);
  assert.equal(articleWindowStart(record).getTime(), 0);
  assert.equal(articleWindowStart({}).getTime(), 0);
  assert.ok(ARTICLE_WINDOW_EFFECTIVE_AT.toISOString() === "2026-09-30T16:00:00.000Z");
});

test("continuous renewal keeps the original anchor", () => {
  const anchor = new Date("2026-10-05T00:00:00.000Z");
  const member = { status: "active", articleWindowStartsAt: anchor.toISOString(), expiresAt: "2026-11-04T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, new Date("2026-11-01T00:00:00.000Z")).getTime(), anchor.getTime());
});

test("rejoining after expiry restarts the anchor on the new activation day", () => {
  const now = new Date("2026-12-10T00:00:00.000Z");
  const member = { status: "active", articleWindowStartsAt: "2026-10-05T00:00:00.000Z", expiresAt: "2026-11-04T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, now).getTime(), now.getTime());
});

test("a pre-policy member switches to the new rule when renewing", () => {
  const now = new Date("2026-10-20T00:00:00.000Z");
  const member = { status: "active", startsAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-10-31T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, now).getTime(), now.getTime());
});
