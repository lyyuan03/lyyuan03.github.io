"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ARTICLE_WINDOW_EFFECTIVE_AT,
  addDays,
  sponsorPlanDays,
  articleWindowAnchor,
  articleWindowStart,
  isContinuousMembership,
  nextArticleWindowAnchor,
  ARTICLE_WINDOW_GRACE_DAYS
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

test("rejoining within the 7-day grace period keeps the original anchor", () => {
  const anchor = new Date("2026-10-05T00:00:00.000Z");
  const member = { status: "active", articleWindowStartsAt: anchor.toISOString(), expiresAt: "2026-11-04T00:00:00.000Z" };
  assert.equal(ARTICLE_WINDOW_GRACE_DAYS, 7);
  assert.equal(nextArticleWindowAnchor(member, new Date("2026-11-11T00:00:00.000Z")).getTime(), anchor.getTime());
});

test("rejoining after the grace period restarts the anchor on the new activation day", () => {
  const now = new Date("2026-11-11T00:00:01.000Z");
  const member = { status: "active", articleWindowStartsAt: "2026-10-05T00:00:00.000Z", expiresAt: "2026-11-04T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, now).getTime(), now.getTime());
});

test("a pre-policy member who keeps renewing stays unrestricted (1970 marker)", () => {
  const member = { status: "active", startsAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-10-31T00:00:00.000Z" };
  const anchor = nextArticleWindowAnchor(member, new Date("2026-10-20T00:00:00.000Z"));
  assert.equal(anchor.getTime(), 0);
  assert.equal(articleWindowStart({ articleWindowStartsAt: anchor }).getTime(), 0);
  // 標記在下次續約時繼續沿用
  const renewed = { status: "active", startsAt: "2026-10-20T00:00:00.000Z", articleWindowStartsAt: anchor, expiresAt: "2026-11-30T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(renewed, new Date("2026-11-20T00:00:00.000Z")).getTime(), 0);
});

test("a pre-policy member within the grace period stays unrestricted", () => {
  const member = { status: "active", startsAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-10-31T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, new Date("2026-11-07T00:00:00.000Z")).getTime(), 0);
});

test("a pre-policy member who lapses beyond the grace period is restarted like a new member", () => {
  const now = new Date("2026-12-01T00:00:00.000Z");
  const member = { status: "active", startsAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-10-31T00:00:00.000Z" };
  assert.equal(nextArticleWindowAnchor(member, now).getTime(), now.getTime());
  assert.equal(articleWindowStart({ articleWindowStartsAt: now }).getTime(), now.getTime() - 30 * DAY);
});

test("suspended, disabled or revoked members never get continuity", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");
  const base = { status: "active", articleWindowStartsAt: "2026-10-05T00:00:00.000Z", expiresAt: "2026-11-04T00:00:00.000Z" };
  assert.equal(isContinuousMembership(base, now), true);
  assert.equal(isContinuousMembership({ ...base, suspended: true }, now), false);
  assert.equal(isContinuousMembership({ ...base, disabled: true }, now), false);
  assert.equal(isContinuousMembership({ ...base, revokedAt: "2026-10-20T00:00:00.000Z" }, now), false);
  assert.equal(nextArticleWindowAnchor({ ...base, suspended: true }, now).getTime(), now.getTime());
});
