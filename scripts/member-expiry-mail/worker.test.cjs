'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { articleMembership, expiredMemberships, buildMail } = require('./worker.cjs');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-22T02:00:00.000Z');
const sponsor = (overrides = {}) => ({
  email: 'a@example.com', name: '小明', memberType: 'sponsor-member', articleAccess: true,
  status: 'active', paymentStatus: 'paid', expiresAt: new Date(now.getTime() - 2 * DAY).toISOString(), ...overrides
});

test('expired sponsor member inside the 7-day grace period gets one notice', () => {
  const result = expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor() }, now);
  assert.equal(result.length, 1);
  const { mail, key } = buildMail('a@example.com', result[0]);
  assert.equal(mail.to, 'a@example.com');
  assert.match(mail.text, /7|沿用原本的閱讀範圍/);
  assert.match(mail.text, /重新起算/);
  assert.equal(key, buildMail('a@example.com', result[0]).key);
});

test('the receipt key changes with the next term so a later expiry can be notified again', () => {
  const first = expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor() }, now)[0];
  const next = expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor({ expiresAt: new Date(now.getTime() - DAY).toISOString() }) }, now)[0];
  assert.notEqual(buildMail('a@example.com', first).key, buildMail('a@example.com', next).key);
});

test('no notice after the grace period, before expiry, or for disabled members', () => {
  const old = sponsor({ expiresAt: new Date(now.getTime() - 8 * DAY).toISOString() });
  const future = sponsor({ expiresAt: new Date(now.getTime() + DAY).toISOString() });
  assert.equal(expiredMemberships('a@example.com', { sponsorMemberAccess: old }, now).length, 0);
  assert.equal(expiredMemberships('a@example.com', { sponsorMemberAccess: future }, now).length, 0);
  assert.equal(expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor({ suspended: true }) }, now).length, 0);
  assert.equal(expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor({ revokedAt: '2026-11-01' }) }, now).length, 0);
});

test('a member whose other membership is still active is not notified', () => {
  const wellness = { email: 'a@example.com', memberType: 'wellness-channel', wellnessAccess: true, memberLevel: 'wellness',
    articleAccess: true, status: 'active', paymentStatus: 'paid', expiresAt: new Date(now.getTime() + 30 * DAY).toISOString() };
  assert.equal(expiredMemberships('a@example.com', { sponsorMemberAccess: sponsor(), memberAccess: wellness }, now).length, 0);
});

test('wellness members without article access are skipped; recipients must match the document id', () => {
  const wellness = { email: 'a@example.com', memberType: 'wellness-channel', wellnessAccess: true, memberLevel: 'wellness',
    articleAccess: false, status: 'active', paymentStatus: 'paid', expiresAt: new Date(now.getTime() - DAY).toISOString() };
  assert.equal(articleMembership('memberAccess', wellness, 'a@example.com'), null);
  assert.equal(articleMembership('sponsorMemberAccess', sponsor({ email: 'other@example.com' }), 'a@example.com'), null);
});
