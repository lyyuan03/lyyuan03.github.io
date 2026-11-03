import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

const memberEmail = 'paid-member@gmail.com';
const otherEmail = 'other-member@gmail.com';
const freeEmail = 'free-user@gmail.com';
const future = Timestamp.fromMillis(Date.now() + 86400000 * 30);
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-member-questions',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') }
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const email of [memberEmail, otherEmail]) {
      await setDoc(doc(db, 'sponsorMemberAccess', email), {
        email, memberType: 'sponsor-member', status: 'active', paymentStatus: 'paid', articleAccess: true,
        accessScope: 'sponsor-paid-articles', accessVersion: 2, expiresAt: future, updatedAt: Timestamp.now()
      });
    }
    await setDoc(doc(db, 'articles/paid-article'), { status: 'published', accessType: 'paid', publishedAt: Timestamp.now() });
    await setDoc(doc(db, 'memberQuestions/other-q'), { uid: 'other', email: otherEmail, articleId: 'paid-article', articleTitle: 't', question: '別人的提問內容', status: 'open', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  });
});
const as = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const admin = () => as('admin', 'lyyuan03@gmail.com');
const payload = (uid, email, extra = {}) => ({ uid, email, articleId: 'paid-article', articleTitle: '標題', question: '這是一個測試提問', status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

test('paid member can create own question', async () => {
  await assertSucceeds(setDoc(doc(as('member', memberEmail), 'memberQuestions/q1'), payload('member', memberEmail)));
  let stored = null;
  await env.withSecurityRulesDisabled(async (ctx) => { stored = (await getDoc(doc(ctx.firestore(), 'memberQuestions/q1'))).data(); });
  if (!stored || stored.uid !== 'member') throw new Error('question was not stored');
});
test('non-paid user cannot create', async () => {
  await assertFails(setDoc(doc(as('free', freeEmail), 'memberQuestions/q1'), payload('free', freeEmail)));
});
test('signed-out cannot create or read', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'memberQuestions/q1'), payload('x', 'x@gmail.com')));
  await assertFails(getDoc(doc(db, 'memberQuestions/other-q')));
});
test('member cannot spoof uid/email or pre-fill reply', async () => {
  const db = as('member', memberEmail);
  await assertFails(setDoc(doc(db, 'memberQuestions/q1'), payload('other', memberEmail)));
  await assertFails(setDoc(doc(db, 'memberQuestions/q2'), payload('member', otherEmail)));
  await assertFails(setDoc(doc(db, 'memberQuestions/q3'), payload('member', memberEmail, { reply: '自己回覆' })));
  await assertFails(setDoc(doc(db, 'memberQuestions/q4'), payload('member', memberEmail, { status: 'answered' })));
  await assertFails(setDoc(doc(db, 'memberQuestions/q5'), payload('member', memberEmail, { question: '短' })));
});
test('member cannot read others, can list own only', async () => {
  const db = as('member', memberEmail);
  await assertFails(getDoc(doc(db, 'memberQuestions/other-q')));
  await assertFails(getDocs(collection(db, 'memberQuestions')));
  await assertSucceeds(getDocs(query(collection(db, 'memberQuestions'), where('uid', '==', 'member'))));
});
test('member cannot update or reply', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'memberQuestions/mine'), { uid: 'member', email: memberEmail, articleId: 'paid-article', articleTitle: 't', question: '我的提問內容', status: 'open', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(as('member', memberEmail), 'memberQuestions/mine')));
  await assertFails(updateDoc(doc(as('member', memberEmail), 'memberQuestions/mine'), { reply: 'x', status: 'answered' }));
});
test('admin reads all and replies, but cannot change question', async () => {
  await assertSucceeds(getDocs(collection(admin(), 'memberQuestions')));
  await assertSucceeds(updateDoc(doc(admin(), 'memberQuestions/other-q'), { reply: '回覆', replyBy: 'lyyuan03@gmail.com', repliedAt: serverTimestamp(), status: 'answered', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(admin(), 'memberQuestions/other-q'), { question: '改內容' }));
});
test('member with canonical entitlement record can create (rules stay under expression limit)', async () => {
  const email = 'entitled@gmail.com';
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'memberEntitlements', email), {
      email, schemaVersion: 1, status: 'active', sponsorArticleAccess: true, sponsorExpiresAt: future,
      wellnessArticleAccess: false, wellnessVideoAccess: false, computedAt: Timestamp.now(),
      articleWindowPolicy: 'v1', sponsorArticleWindowStartsAt: Timestamp.fromMillis(0)
    });
  });
  await assertSucceeds(setDoc(doc(as('entitled', email), 'memberQuestions/e1'), payload('entitled', email)));
});
