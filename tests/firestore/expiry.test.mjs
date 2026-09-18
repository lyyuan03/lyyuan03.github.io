import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

const email = 'expiry-test@gmail.com';
const past = Timestamp.fromMillis(Date.now() - 86400000);
const future = Timestamp.fromMillis(Date.now() + 86400000);
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-membership-expiry',
    firestore: { rules: await readFile(process.env.TEST_RULES_PATH || new URL('../../firestore.rules', import.meta.url), 'utf8') }
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());
const client = () => env.authenticatedContext('member', { email, email_verified: true }).firestore();

async function seed(kind, expiresAt, entitlement = 'absent', extra = {}) {
  const wellness = kind !== 'sponsor';
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const member = {
      email, memberType: wellness ? 'wellness-channel' : 'sponsor-member',
      status: 'active', paymentStatus: 'paid', articleAccess: true,
      wellnessAccess: wellness, memberLevel: kind === 'lingji' ? 'lingji' : 'wellness',
      accessScope: 'sponsor-paid-articles', accessVersion: 2,
      updatedAt: Timestamp.now(), ...extra
    };
    if (expiresAt !== undefined) member.expiresAt = expiresAt;
    await setDoc(doc(db, wellness ? 'memberAccess' : 'sponsorMemberAccess', email), member);
    await setDoc(doc(db, 'paidArticleBodies/article'), { status: 'published', active: true });
    await setDoc(doc(db, 'memberVideos/wellness'), { status: 'published', accessLevel: 'wellness' });
    await setDoc(doc(db, 'memberVideos/lingji'), { status: 'published', accessLevel: 'lingji' });
    if (entitlement !== 'absent') {
      await setDoc(doc(db, 'memberEntitlements', email), {
        email, schemaVersion: 1, status: 'inactive',
        sponsorArticleAccess: false, wellnessArticleAccess: false, wellnessVideoAccess: false,
        sponsorExpiresAt: past, wellnessExpiresAt: past,
        ...(entitlement === 'incomplete' ? {} : { computedAt: past })
      });
    }
  });
}

for (const kind of ['sponsor', 'wellness', 'lingji']) {
  for (const fallback of ['absent', 'stale', 'incomplete']) {
    for (const [label, expiry, allowed] of [
      ['expired string', past.toDate().toISOString(), false],
      ['future string', future.toDate().toISOString(), false],
      ['malformed string', 'not-a-date', false],
      ['expired Timestamp', past, false],
      ['future Timestamp', future, true],
      ['missing', undefined, false], ['null', null, false], ['number', future.toMillis(), false]
    ]) {
      test(`${kind}, ${fallback} entitlement, ${label}`, async () => {
        await seed(kind, expiry, fallback);
        const check = allowed ? assertSucceeds : assertFails;
        await check(getDoc(doc(client(), 'paidArticleBodies/article')));
        if (kind !== 'sponsor') {
          await check(getDoc(doc(client(), 'memberVideos/wellness')));
          await (allowed && kind === 'lingji' ? assertSucceeds : assertFails)(getDoc(doc(client(), 'memberVideos/lingji')));
        }
      });
    }
  }
}
for (const extra of [{ articleAccess: false }, { status: 'pending' }, { paymentStatus: 'pending' }, { disabled: true }, { suspended: true }, { revokedAt: past }]) {
  test(`valid sponsor expiry does not bypass ${JSON.stringify(extra)}`, async () => {
    await seed('sponsor', future, 'absent', extra);
    await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
  });
}
test('ordinary wellness membership allows video but not paid article', async () => {
  await seed('wellness', future, 'absent', { articleAccess: false });
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
  await assertSucceeds(getDoc(doc(client(), 'memberVideos/wellness')));
});
test('anonymous and unverified users cannot use valid legacy membership', async () => {
  await seed('sponsor', future);
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('unverified', { email, email_verified: false })]) {
    await assertFails(getDoc(doc(ctx.firestore(), 'paidArticleBodies/article')));
  }
});
test('valid canonical entitlement remains independent of legacy string', async () => {
  await seed('sponsor', past.toDate().toISOString());
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'memberEntitlements', email), {
    email, schemaVersion: 1, status: 'active', sponsorArticleAccess: true, sponsorExpiresAt: future,
    wellnessArticleAccess: false, wellnessExpiresAt: past, computedAt: Timestamp.now()
  }));
  await assertSucceeds(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('expired canonical entitlement cannot rescue an expired legacy string', async () => {
  await seed('sponsor', past.toDate().toISOString(), 'stale');
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'memberEntitlements', email), {
    email, schemaVersion: 1, status: 'active', sponsorArticleAccess: true, sponsorExpiresAt: past,
    wellnessArticleAccess: false, wellnessExpiresAt: past, computedAt: Timestamp.now()
  }));
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
});
test('verified admin still reads the published private body', async () => {
  await seed('sponsor', past);
  const admin = env.authenticatedContext('admin', { email: 'lyyuan03@gmail.com', email_verified: true });
  await assertSucceeds(getDoc(doc(admin.firestore(), 'paidArticleBodies/article')));
});

test('migration backups are inaccessible to all website clients', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'securityMigrationBackups/expiry-test/changes/00000000'), { payload: 'private' }));
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('member', { email, email_verified: true }), env.authenticatedContext('admin', { email: 'lyyuan03@gmail.com', email_verified: true })]) {
    await assertFails(getDoc(doc(ctx.firestore(), 'securityMigrationBackups/expiry-test/changes/00000000')));
  }
});
