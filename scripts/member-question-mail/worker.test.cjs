'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { messages, deliver } = require('./worker.cjs');
const user = { email: 'member@example.org' };
const data = { uid: 'member', email: user.email, articleId: 'a&b', articleTitle: '文章\r\nInjected', question: '會員問題', reply: '管理者回覆' };
test('routes question to fixed admin and reply to matching Auth recipient; stable distinct keys', () => {
  const mail = messages('q1', data, user);
  assert.equal(mail.length, 2);
  assert.equal(mail[0].mail.to, 'lyyuan03@gmail.com');
  assert.equal(mail[1].mail.to, user.email);
  assert.match(mail[1].mail.text, /a%26b/);
  assert.doesNotMatch(mail[0].mail.subject, /[\r\n]/);
  assert.equal(mail[1].key, messages('q1', data, user)[1].key);
  assert.notEqual(mail[1].key, messages('q1', { ...data, reply: '修改回覆' }, user)[1].key);
});
test('cannot mail an arbitrary document address or disabled/deleted member', () => {
  assert.deepEqual(messages('q', { ...data, email: 'attacker@example.org' }, user), []);
  assert.deepEqual(messages('q', data, { ...user, disabled: true }), []);
  assert.deepEqual(messages('q', data, null), []);
});
test('legacy sent markers skip old mail; hash detects edits even during SMTP delivery', () => {
  const stamp = n => ({ toMillis: () => n });
  const sent = { ...data, adminNotifiedAt: stamp(20), memberNotifiedAt: stamp(20), repliedAt: stamp(10) };
  assert.equal(messages('q', sent, user).length, 0);
  assert.equal(messages('q', { ...sent, repliedAt: stamp(30) }, user).length, 1);
  assert.equal(messages('q', { ...sent, memberNotificationReplyHash: 'older-reply' }, user).length, 1);
  assert.equal(messages('q', { ...sent, memberNotificationReplyHash: messages('q', data, user)[1].replyHash }, user).length, 0);
});
function fixture() {
  const records = new Map();
  const receipt = { update: async fields => records.set('receipt', { ...records.get('receipt'), ...fields }) };
  const db = {
    collection: () => ({ doc: () => receipt }),
    runTransaction: async cb => cb({ get: async () => ({ exists: records.has('receipt') }), create: (_, fields) => records.set('receipt', fields) }),
    batch: () => ({ update: () => {}, commit: async () => records.set('committed', true) })
  };
  return { db, records, doc: { id: 'q', ref: {} }, from: 'sender@example.org', item: messages('q', data, user)[0], timestamp: () => 'time' };
}
test('persisted claim suppresses reruns', async () => {
  const f = fixture(); let count = 0;
  f.transport = { sendMail: async () => { count++; return { accepted: ['admin'], rejected: [] }; } };
  assert.equal(await deliver(f), true);
  assert.equal(await deliver(f), false);
  assert.equal(count, 1);
  assert.equal(f.records.get('committed'), true);
});
test('uncertain SMTP result is held for review and never retried automatically', async () => {
  const f = fixture(); let count = 0;
  f.transport = { sendMail: async () => { count++; throw new Error('private SMTP details'); } };
  await assert.rejects(deliver(f), /owner review/);
  assert.equal(f.records.get('receipt').status, 'review-required');
  assert.equal(await deliver(f), false);
  assert.equal(count, 1);
});
