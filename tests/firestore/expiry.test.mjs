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

// ── 付費文章閱讀範圍（開通日前 30 天起）──────────────────────────────
const DAY = 86400000;
const ago = (days) => Timestamp.fromMillis(Date.now() - days * DAY);
const EPOCH = Timestamp.fromMillis(0);
const WINDOW_EFFECTIVE_MS = Date.UTC(2026, 8, 30, 16);

async function seedWindowArticle(publishedAt) {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const article = { status: 'published', accessType: 'paid' };
    if (publishedAt !== undefined) article.publishedAt = publishedAt;
    await setDoc(doc(db, 'articles/article'), article);
    await setDoc(doc(db, 'paidArticleBodies/article'), { status: 'published', active: true });
  });
}

async function seedWindowEntitlement(fields) {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'memberEntitlements', email), {
    email, schemaVersion: 1, status: 'active', articleWindowPolicy: 'join-minus-30d-v1',
    sponsorArticleAccess: false, wellnessArticleAccess: false, wellnessVideoAccess: false,
    sponsorExpiresAt: past, wellnessExpiresAt: past, computedAt: Timestamp.fromMillis(Date.now() + DAY),
    ...fields
  }));
}

for (const [label, publishedDaysAgo, windowDaysAgo, allowed] of [
  ['article inside window (published after join-30d)', 20, 40, true],
  ['article published exactly on window start', 40, 40, true],
  ['article published before window start', 60, 40, false]
]) {
  test(`canonical sponsor window: ${label}`, async () => {
    await seed('sponsor', future, 'absent');
    const base = Date.now();
    await seedWindowArticle(Timestamp.fromMillis(base - publishedDaysAgo * DAY));
    await seedWindowEntitlement({ sponsorArticleAccess: true, sponsorExpiresAt: future, sponsorArticleWindowStartsAt: Timestamp.fromMillis(base - windowDaysAgo * DAY) });
    await (allowed ? assertSucceeds : assertFails)(getDoc(doc(client(), 'paidArticleBodies/article')));
  });
}

test('canonical window: pre-policy member (epoch window) keeps full access this term', async () => {
  await seed('sponsor', future, 'absent');
  await seedWindowArticle(ago(900));
  await seedWindowEntitlement({ sponsorArticleAccess: true, sponsorExpiresAt: future, sponsorArticleWindowStartsAt: EPOCH });
  await assertSucceeds(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('canonical window: policy present but window missing is denied', async () => {
  await seed('sponsor', future, 'absent');
  await seedWindowArticle(ago(1));
  await seedWindowEntitlement({ sponsorArticleAccess: true, sponsorExpiresAt: future });
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('canonical window: article without publishedAt is denied for window-limited member', async () => {
  await seed('sponsor', future, 'absent');
  await seedWindowArticle(undefined);
  await seedWindowEntitlement({ sponsorArticleAccess: true, sponsorExpiresAt: future, sponsorArticleWindowStartsAt: ago(40) });
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('canonical window: expired member cannot read even new articles', async () => {
  await seed('sponsor', past, 'absent');
  await seedWindowArticle(ago(1));
  await seedWindowEntitlement({ sponsorArticleAccess: true, sponsorExpiresAt: past, sponsorArticleWindowStartsAt: ago(40) });
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('canonical window: lingji/wellness track window applies the same way', async () => {
  await seed('lingji', future, 'absent');
  await seedWindowArticle(ago(60));
  await seedWindowEntitlement({ wellnessArticleAccess: true, wellnessVideoAccess: true, lingjiAccess: true, wellnessExpiresAt: future, wellnessArticleWindowStartsAt: ago(40) });
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
  await seedWindowArticle(ago(10));
  await assertSucceeds(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('canonical window: either active track may unlock the article', async () => {
  await seed('sponsor', future, 'absent');
  await seedWindowArticle(ago(60));
  await seedWindowEntitlement({
    sponsorArticleAccess: true, sponsorExpiresAt: future, sponsorArticleWindowStartsAt: ago(40),
    wellnessArticleAccess: true, wellnessExpiresAt: future, wellnessArticleWindowStartsAt: ago(90)
  });
  await assertSucceeds(getDoc(doc(client(), 'paidArticleBodies/article')));
});

for (const kind of ['sponsor', 'lingji']) {
  for (const [label, publishedDaysAgo, allowed] of [['inside', 35, true], ['outside', 45, false]]) {
    test(`fallback ${kind} record window (anchor 10 days ago): article ${label}`, async () => {
      await seed(kind, future, 'absent', { startsAt: ago(10), articleWindowStartsAt: ago(10) });
      await seedWindowArticle(ago(publishedDaysAgo));
      await (allowed ? assertSucceeds : assertFails)(getDoc(doc(client(), 'paidArticleBodies/article')));
    });
  }
}

test('fallback legacy member who started before the policy keeps full access this term', async () => {
  await seed('sponsor', future, 'absent', { startsAt: Timestamp.fromMillis(Date.UTC(2026, 0, 1)) });
  await seedWindowArticle(ago(900));
  await assertSucceeds(getDoc(doc(client(), 'paidArticleBodies/article')));
});

test('fallback member who started after the policy date without anchor is window-limited', {
  skip: Date.now() < WINDOW_EFFECTIVE_MS + DAY ? 'policy effective date not reached yet' : false
}, async () => {
  const startsAt = Timestamp.fromMillis(Math.max(WINDOW_EFFECTIVE_MS, Date.now() - 5 * DAY));
  await seed('sponsor', future, 'absent', { startsAt });
  await seedWindowArticle(Timestamp.fromMillis(startsAt.toMillis() - 40 * DAY));
  await assertFails(getDoc(doc(client(), 'paidArticleBodies/article')));
});
