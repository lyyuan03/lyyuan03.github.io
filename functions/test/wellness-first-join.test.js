"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  taipeiMonth, fallbackFirstJoinMonth, resolveFirstJoinMonth, videoPublishedMonth, videoVisibleForMonth
} = require("../wellness-first-join");

test("taipeiMonth uses UTC+8", () => {
  assert.equal(taipeiMonth("2026-09-30T16:30:00Z"), "2026-10");
  assert.equal(taipeiMonth("2026-09-30T15:59:00Z"), "2026-09");
});

test("joined any day in October can watch videos from 2026-10-01", () => {
  assert.equal(videoVisibleForMonth({ publishedAt: "2026-10-01T00:00:00+08:00" }, "2026-10"), true);
  assert.equal(videoVisibleForMonth({ publishedAt: "2026-09-30T00:00:00+08:00" }, "2026-10"), false);
  assert.equal(videoVisibleForMonth({ publishedMonth: "2027-01" }, "2026-10"), true);
  assert.equal(videoVisibleForMonth({ publishedAt: "" }, "2026-10"), false);
});

test("rejoin never moves first-join month later", () => {
  const rejoined = { firstJoinedAt: "2027-03-05T00:00:00Z", startsAt: "2027-03-05T00:00:00Z", wellnessFirstJoinMonth: "2027-03" };
  assert.equal(resolveFirstJoinMonth(rejoined, { wellnessFirstJoinMonth: "2026-10" }), "2026-10");
  assert.equal(resolveFirstJoinMonth({ wellnessFirstJoinMonth: "2026-10", startsAt: "2027-02-01T00:00:00Z" }, {}), "2026-10");
});

test("fallback uses earliest of firstJoinedAt/createdAt/startsAt/paidAt/expiry-plan", () => {
  assert.equal(fallbackFirstJoinMonth({
    startsAt: "2026-08-10T00:00:00Z", paidAt: "2026-08-10T00:00:00Z", createdAt: "2026-07-20T00:00:00Z"
  }), "2026-07");
  assert.equal(fallbackFirstJoinMonth({ expiresAt: "2027-01-15T00:00:00Z", planMonths: 6 }), "2026-07");
  assert.equal(fallbackFirstJoinMonth({}), null);
});

test("video month from Timestamp-like and string", () => {
  assert.equal(videoPublishedMonth({ publishedAt: { toDate: () => new Date("2026-10-31T17:00:00Z") } }), "2026-11");
  assert.equal(videoPublishedMonth({ publishedAt: "2026-10-31T00:00:00+08:00" }), "2026-10");
});
