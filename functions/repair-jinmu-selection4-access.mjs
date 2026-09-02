import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldPath, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT private key missing");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "lyyuan03-membership"
});
const db = getFirestore(app);

const CANONICAL_PERMISSION = "2026-jinmu-build-supporter";
const LEGACY_EVENT_IDS = [
  CANONICAL_PERMISSION,
  "丙午無極瑤池金母聖誕-專屬文選4-建院所有燈別"
];

const participants = new Map();

for (const eventId of LEGACY_EVENT_IDS) {
  const snapshot = await db.collection("memberAccess")
    .where(new FieldPath("eventAccess", eventId, "status"), "==", "active")
    .get();

  for (const memberDoc of snapshot.docs) {
    const email = String(memberDoc.data()?.email || memberDoc.id).trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email)) continue;
    participants.set(email, true);
  }
}

if (!participants.size) {
  throw new Error("No active Selection 4 participants were found; no permissions changed");
}

const emails = [...participants.keys()];
let written = 0;
for (let offset = 0; offset < emails.length; offset += 200) {
  const batch = db.batch();
  for (const email of emails.slice(offset, offset + 200)) {
    batch.set(db.doc(`memberEntitlements/${email}`), {
      email,
      permissions: FieldValue.arrayUnion(CANONICAL_PERMISSION),
      activityManagedPermissions: FieldValue.arrayUnion(CANONICAL_PERMISSION),
      selection4AccessRepairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
  written += Math.min(200, emails.length - offset);
}

const entitlementRefs = emails.map((email) => db.doc(`memberEntitlements/${email}`));
const verifiedSnapshots = await db.getAll(...entitlementRefs);
let verifiedCount = 0;
let blockedCount = 0;

for (const snapshot of verifiedSnapshots) {
  const data = snapshot.data() || {};
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  if (permissions.includes(CANONICAL_PERMISSION)) verifiedCount += 1;
  if (data.disabled === true || data.suspended === true || data.status === "disabled") {
    blockedCount += 1;
  }
}

if (verifiedCount !== emails.length) {
  throw new Error(`Selection 4 permission verification failed: ${verifiedCount}/${emails.length}`);
}
if (blockedCount > 0) {
  throw new Error(`Selection 4 permissions exist, but ${blockedCount} participant entitlement records are disabled or suspended`);
}

console.log(JSON.stringify({
  status: "repaired-and-verified",
  permission: CANONICAL_PERMISSION,
  participantCount: emails.length,
  entitlementWrites: written,
  verifiedCount,
  blockedCount,
  emailsLogged: false
}));
