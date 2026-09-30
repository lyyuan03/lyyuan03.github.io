"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("../member-entitlements-sync");

const now = new Date("2026-08-26T08:00:00.000Z");

function futureIso() {
  return "2026-09-26T08:00:00.000Z";
}

function pastIso() {
  return "2026-07-26T08:00:00.000Z";
}

test("canonical sponsor entitlement depends on active paid sponsor membership, not wellness membership", () => {
  const state = _test.sponsorState({
    email: "member@example.com",
    memberType: "sponsor-member",
    status: "active",
    paymentStatus: "paid",
    expiresAt: futureIso()
  }, "member@example.com", now);

  assert.equal(state.active, true);
  assert.equal(state.articleAccess, true);
});

test("expired sponsor membership never produces an active entitlement", () => {
  const state = _test.sponsorState({
    email: "member@example.com",
    memberType: "sponsor-member",
    status: "active",
    paymentStatus: "paid",
    expiresAt: pastIso()
  }, "member@example.com", now);

  assert.equal(state.active, false);
  assert.equal(state.articleAccess, false);
});

test("general wellness membership needs explicit article access but still keeps video access", () => {
  const state = _test.wellnessState({
    email: "member@example.com",
    memberType: "wellness-channel",
    memberLevel: "wellness",
    wellnessAccess: true,
    status: "active",
    paymentStatus: "paid",
    expiresAt: futureIso(),
    articleAccess: false
  }, "member@example.com", now);

  assert.equal(state.videoAccess, true);
  assert.equal(state.articleAccess, false);
  assert.equal(state.lingji, false);
});

test("Lingji membership always receives paid article entitlement while active", () => {
  const state = _test.wellnessState({
    email: "member@example.com",
    memberType: "wellness-channel",
    memberLevel: "lingji",
    wellnessAccess: true,
    status: "active",
    paymentStatus: "paid",
    expiresAt: futureIso(),
    articleAccess: false
  }, "member@example.com", now);

  assert.equal(state.videoAccess, true);
  assert.equal(state.articleAccess, true);
  assert.equal(state.lingji, true);
});

test("entitlement carries the paid-article reading window for active members only", () => {
  const anchor = "2026-10-10T00:00:00.000Z";
  const sponsor = _test.sponsorState({
    email: "member@example.com",
    memberType: "sponsor-member",
    status: "active",
    paymentStatus: "paid",
    articleWindowStartsAt: anchor,
    expiresAt: "2026-11-09T00:00:00.000Z"
  }, "member@example.com", new Date("2026-10-20T00:00:00.000Z"));
  assert.equal(sponsor.articleWindowStartsAt.toISOString(), "2026-09-10T00:00:00.000Z");

  const expired = _test.sponsorState({
    email: "member@example.com",
    memberType: "sponsor-member",
    status: "active",
    paymentStatus: "paid",
    articleWindowStartsAt: anchor,
    expiresAt: "2026-11-09T00:00:00.000Z"
  }, "member@example.com", new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(expired.articleWindowStartsAt, null);

  const legacyLingji = _test.wellnessState({
    email: "member@example.com",
    memberType: "wellness-channel",
    memberLevel: "lingji",
    wellnessAccess: true,
    status: "active",
    paymentStatus: "paid",
    startsAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2027-05-01T00:00:00.000Z"
  }, "member@example.com", new Date("2026-10-20T00:00:00.000Z"));
  assert.equal(legacyLingji.articleWindowStartsAt.getTime(), 0);
});
