import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const eventPermissions = new Set([
  "2026-jinmu-am",
  "2026-jinmu-pm",
  "2026-jinmu-build-patron",
  "2026-jinmu-build-supporter"
]);
const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)), projectId: "lyyuan03-membership" });
const db = getFirestore(app);

const counts = Object.fromEntries([...eventPermissions].map((permission) => [permission, 0]));
const affected = new Set();
let nonEventPermissionsBefore = 0;
let nonEventPermissionsAfter = 0;
let scannedDocuments = 0;

for (let pass = 1; pass <= 3; pass += 1) {
  const collection = await db.collection("memberEntitlements").get();
  scannedDocuments = collection.size;
  const candidates = collection.docs.filter((snapshot) => {
    const permissions = snapshot.data().permissions;
    if (permissions !== undefined && !Array.isArray(permissions)) throw new Error("Existing permissions field is not an array; reset stopped");
    return permissions?.some((permission) => eventPermissions.has(permission));
  });
  if (!candidates.length) break;
  if (candidates.length > 400) throw new Error("Unexpected reset size; no partial batch was written");
  const batch = db.batch();
  for (const snapshot of candidates) {
    const before = snapshot.data().permissions || [];
    const retained = before.filter((permission) => !eventPermissions.has(permission));
    before.filter((permission) => eventPermissions.has(permission)).forEach((permission) => { counts[permission] += 1; });
    nonEventPermissionsBefore += retained.length;
    affected.add(snapshot.id);
    batch.set(snapshot.ref, {
      permissions: retained,
      eventPermissionsSource: FieldValue.delete(),
      eventPermissionsUpdatedAt: FieldValue.delete(),
      eventRegistrationName: FieldValue.delete(),
      eventRegistrationNameConfirmedAt: FieldValue.delete()
    }, { merge: true });
  }
  await batch.commit();
}

const readback = await db.collection("memberEntitlements").get();
const remaining = [];
for (const snapshot of readback.docs) {
  const permissions = snapshot.data().permissions;
  if (permissions !== undefined && !Array.isArray(permissions)) throw new Error("Permissions readback is not an array");
  if (permissions?.some((permission) => eventPermissions.has(permission))) remaining.push(snapshot.id);
  nonEventPermissionsAfter += (permissions || []).filter((permission) => !eventPermissions.has(permission)).length;
}
if (remaining.length) throw new Error("Event permissions remain after reset");
if (nonEventPermissionsAfter < nonEventPermissionsBefore) throw new Error("An unrelated permission was removed");

const affectedSetHash = createHash("sha256").update([...affected].sort().join("\n")).digest("hex");
const batch = db.batch();
for (const path of [
  "membershipSettings/jinmuPermissionImportReceipt",
  "membershipSettings/jinmuPermissionImportTransport",
  "membershipSettings/jinmuNameConfirmationReceipt",
  "membershipSettings/jinmuNameConfirmationTransport"
]) batch.delete(db.doc(path));
batch.set(db.doc("membershipSettings/jinmuPermissionManualMode"), {
  status: "active",
  mode: "manual-only",
  automaticEventGrantsRevoked: affected.size,
  eventPermissionCountsBefore: counts,
  affectedSetHash,
  remainingAutomaticEventGrants: 0,
  unrelatedPermissionsPreserved: true,
  verifiedAt: FieldValue.serverTimestamp()
});
await batch.commit();

console.log(JSON.stringify({
  stage: "jinmu-manual-permission-reset",
  status: "verified",
  scannedDocuments,
  revokedEmails: affected.size,
  removedPermissionCounts: counts,
  remainingEventPermissions: 0,
  unrelatedPermissionsPreserved: true,
  oldAutomaticImportReceiptsDeleted: true,
  managementMode: "manual-only"
}));
