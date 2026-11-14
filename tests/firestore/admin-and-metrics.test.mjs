import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-admin-metrics',
    firestore: {
      rules: await readFile(process.env.TEST_RULES_PATH || new URL('../../firestore.rules', import.meta.url), 'utf8')
    }
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const metricPayload = {
  articleId: 'demo-article',
  views: 1,
  shares: 0,
  copies: 0,
  updatedAt: undefined
};

test('anonymous cannot create articleMetrics', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'articleMetrics/demo-article'), {
    articleId: 'demo-article',
    views: 1,
    shares: 0,
    copies: 0
  }));
});

test('signed-in unverified admin cannot write paidArticleBodies', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'paidArticleBodies/article'), {
      status: 'published',
      active: true,
      content: 'secret'
    });
  });
  const unverifiedAdmin = env.authenticatedContext('admin-unverified', {
    email: 'lyyuan03@gmail.com',
    email_verified: false
  });
  await assertFails(setDoc(doc(unverifiedAdmin.firestore(), 'paidArticleBodies/article'), {
    status: 'published',
    active: true,
    content: 'hijack'
  }));
});

test('verified admin can write paidArticleBodies', async () => {
  const admin = env.authenticatedContext('admin', {
    email: 'lyyuan03@gmail.com',
    email_verified: true
  });
  await assertSucceeds(setDoc(doc(admin.firestore(), 'paidArticleBodies/article'), {
    status: 'published',
    active: true,
    content: 'ok'
  }));
});

test('signed-in user can create a one-unit metric doc', async () => {
  const user = env.authenticatedContext('member', {
    email: 'reader@gmail.com',
    email_verified: true
  });
  // updatedAt must equal request.time — rules-unit-testing accepts serverTimestamp-like via FieldValue?
  // Existing expiry tests don't cover metrics. Use firestore Timestamp from client may fail == request.time.
  // Skip precise create if time equality is strict; use assertFails/Succeeds patterns from Firebase docs:
  // For request.time equality, @firebase/rules-unit-testing often needs:
  const { serverTimestamp } = await import('firebase/firestore');
  await assertSucceeds(setDoc(doc(user.firestore(), 'articleMetrics/demo-article'), {
    articleId: 'demo-article',
    views: 1,
    shares: 0,
    copies: 0,
    updatedAt: serverTimestamp()
  }));
});
