import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private key missing");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "lyyuan03-membership"
});
const db = getFirestore(app);

const TARGET_NAME_PATTERN = /專屬文選\s*[4４].*建院.*所有燈別/i;
const FALLBACK_EVENT_ID = "2026-jinmu-build-supporter";

function withoutKey(object, key) {
  const next = { ...(object || {}) };
  delete next[key];
  return next;
}

function withoutKeys(object, keys) {
  const next = { ...(object || {}) };
  for (const key of keys) delete next[key];
  return next;
}

async function writeInBatches(writes, size = 400) {
  let committed = 0;
  for (let offset = 0; offset < writes.length; offset += size) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + size)) {
      batch.update(write.ref, write.data);
    }
    await batch.commit();
    committed += Math.min(size, writes.length - offset);
  }
  return committed;
}

const eventManagementRef = db.doc("membershipSettings/eventManagement");
const eventManagementSnapshot = await eventManagementRef.get();
if (!eventManagementSnapshot.exists) throw new Error("eventManagement settings not found");

const events = Array.isArray(eventManagementSnapshot.data()?.events)
  ? eventManagementSnapshot.data().events
  : [];

let matches = events.filter((event) => TARGET_NAME_PATTERN.test(String(event?.name || "")));
if (!matches.length) {
  const fallback = events.find((event) => event?.id === FALLBACK_EVENT_ID);
  if (fallback) matches = [fallback];
}
if (matches.length !== 1) {
  throw new Error(`Expected exactly one 專屬文選4 target event, found ${matches.length}`);
}

const targetEvent = matches[0];
const targetEventId = String(targetEvent.id || "").trim();
if (!targetEventId) throw new Error("Target event id is empty");

const [memberAccessSnapshot, entitlementsSnapshot, articlesSnapshot, magicSnapshot] = await Promise.all([
  db.collection("memberAccess").get(),
  db.collection("memberEntitlements").get(),
  db.collection("articles").get(),
  db.doc("membershipSettings/eventMagicLinkSecrets").get()
]);

const eventArticles = articlesSnapshot.docs.filter((articleDoc) => {
  const article = articleDoc.data() || {};
  return article.accessType === "event" && article.eventId === targetEventId;
});
const eventArticleIds = eventArticles.map((articleDoc) => articleDoc.id);
const eventArticleIdSet = new Set(eventArticleIds);

const memberWrites = [];
let membersWithEventAccess = 0;
let membersWithEventKeys = 0;

for (const memberDoc of memberAccessSnapshot.docs) {
  const current = memberDoc.data() || {};
  const eventAccess = current.eventAccess || {};
  const eventArticleKeys = current.eventArticleKeys || {};
  const hasEventAccess = Object.prototype.hasOwnProperty.call(eventAccess, targetEventId);
  const hasEventKeys = Object.keys(eventArticleKeys).some((articleId) => eventArticleIdSet.has(articleId));
  if (!hasEventAccess && !hasEventKeys) continue;

  if (hasEventAccess) membersWithEventAccess += 1;
  if (hasEventKeys) membersWithEventKeys += 1;

  memberWrites.push({
    ref: memberDoc.ref,
    data: {
      eventAccess: withoutKey(eventAccess, targetEventId),
      eventArticleKeys: withoutKeys(eventArticleKeys, eventArticleIds),
      updatedAt: FieldValue.serverTimestamp()
    }
  });
}

const entitlementWrites = [];
let entitlementPermissionsRemoved = 0;

for (const entitlementDoc of entitlementsSnapshot.docs) {
  const current = entitlementDoc.data() || {};
  const permissions = Array.isArray(current.permissions) ? current.permissions : [];
  const activityManagedPermissions = Array.isArray(current.activityManagedPermissions)
    ? current.activityManagedPermissions
    : [];

  const nextPermissions = permissions.filter((permission) => permission !== targetEventId);
  const nextManagedPermissions = activityManagedPermissions.filter((permission) => permission !== targetEventId);

  if (
    nextPermissions.length === permissions.length &&
    nextManagedPermissions.length === activityManagedPermissions.length
  ) continue;

  entitlementPermissionsRemoved += 1;
  entitlementWrites.push({
    ref: entitlementDoc.ref,
    data: {
      permissions: nextPermissions,
      activityManagedPermissions: nextManagedPermissions,
      activityManagementSyncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }
  });
}

const articleWrites = eventArticles.map((articleDoc) => ({
  ref: articleDoc.ref,
  data: {
    magicLinkAccess: {},
    updatedAt: FieldValue.serverTimestamp()
  }
}));

let magicLinkRecordsRemoved = 0;
let nextLinks = {};
if (magicSnapshot.exists) {
  const currentLinks = magicSnapshot.data()?.links || {};
  nextLinks = { ...currentLinks };
  const eventLinks = currentLinks[targetEventId] || {};
  magicLinkRecordsRemoved = Object.keys(eventLinks).length;
  delete nextLinks[targetEventId];
}

console.log(JSON.stringify({
  phase: "before",
  targetEventId,
  targetEventName: targetEvent.name,
  eventArticleCount: eventArticleIds.length,
  memberDocumentsToClean: memberWrites.length,
  membersWithEventAccess,
  membersWithEventKeys,
  entitlementDocumentsToClean: entitlementWrites.length,
  magicLinkRecordsToRemove: magicLinkRecordsRemoved
}));

await writeInBatches(memberWrites);
await writeInBatches(entitlementWrites);
await writeInBatches(articleWrites);

if (magicSnapshot.exists) {
  await magicSnapshot.ref.update({
    links: nextLinks,
    updatedAt: FieldValue.serverTimestamp()
  });
}

const [verifyMembers, verifyEntitlements, verifyArticles, verifyMagic] = await Promise.all([
  db.collection("memberAccess").get(),
  db.collection("memberEntitlements").get(),
  db.collection("articles").get(),
  db.doc("membershipSettings/eventMagicLinkSecrets").get()
]);

const remainingMemberAccess = verifyMembers.docs.filter((memberDoc) => {
  const current = memberDoc.data() || {};
  return Object.prototype.hasOwnProperty.call(current.eventAccess || {}, targetEventId);
}).length;

const remainingEventKeys = verifyMembers.docs.filter((memberDoc) => {
  const keys = memberDoc.data()?.eventArticleKeys || {};
  return Object.keys(keys).some((articleId) => eventArticleIdSet.has(articleId));
}).length;

const remainingEntitlements = verifyEntitlements.docs.filter((entitlementDoc) => {
  const current = entitlementDoc.data() || {};
  return (Array.isArray(current.permissions) && current.permissions.includes(targetEventId)) ||
    (Array.isArray(current.activityManagedPermissions) && current.activityManagedPermissions.includes(targetEventId));
}).length;

const remainingMagicLinks = Object.keys(verifyMagic.data()?.links?.[targetEventId] || {}).length;

const remainingArticleMagicAccess = verifyArticles.docs.filter((articleDoc) => {
  const article = articleDoc.data() || {};
  return article.accessType === "event" &&
    article.eventId === targetEventId &&
    Object.keys(article.magicLinkAccess || {}).length > 0;
}).length;

const verification = {
  phase: "verify",
  targetEventId,
  remainingMemberAccess,
  remainingEventKeys,
  remainingEntitlements,
  remainingMagicLinks,
  remainingArticleMagicAccess
};

console.log(JSON.stringify(verification));

if (Object.values({
  remainingMemberAccess,
  remainingEventKeys,
  remainingEntitlements,
  remainingMagicLinks,
  remainingArticleMagicAccess
}).some((count) => count !== 0)) {
  throw new Error(`Cleanup verification failed: ${JSON.stringify(verification)}`);
}

console.log(JSON.stringify({
  phase: "done",
  status: "cleared",
  targetEventId,
  targetEventName: targetEvent.name,
  removedParticipantAccessCount: membersWithEventAccess,
  removedMemberKeyDocumentCount: membersWithEventKeys,
  removedEntitlementDocumentCount: entitlementPermissionsRemoved,
  removedMagicLinkRecordCount: magicLinkRecordsRemoved
}));
