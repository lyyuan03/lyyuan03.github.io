import { readFile } from "node:fs/promises";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { validateJinmuPermissionPlan } from "../jinmu-permission-plan.js";
import { openPlan } from "./jinmu-import-envelope.mjs";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)), projectId: "lyyuan03-membership" });
const db = getFirestore(app);
const keyRef = db.doc("membershipSettings/jinmuNameConfirmationTransport");
const receiptRef = db.doc("membershipSettings/jinmuNameConfirmationReceipt");
const allowed = ["2026-jinmu-am", "2026-jinmu-pm", "2026-jinmu-build-supporter"];
const denied = "2026-jinmu-build-patron";
const changedFields = new Set(["email", "permissions", "eventRegistrationName", "eventRegistrationNameConfirmedAt", "eventPermissionsSource", "eventPermissionsUpdatedAt", "computedAt"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function protectedFields(data, keys) {
  return Object.fromEntries(keys.map((key) => [key, data[key]]));
}
function requireReadable(data) {
  if (data.disabled === true || data.suspended === true || data.status === "disabled") throw new Error("Account is disabled; existing account restrictions were not changed");
}

async function prepare() {
  if ((await receiptRef.get()).exists) throw new Error("Confirmation already applied; no new key generated");
  let data = (await keyRef.get()).data();
  if (!data || data.expiresAt.toMillis() < Date.now()) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    data = { keyId: randomUUID(), privateKey, publicKey, expiresAt: Timestamp.fromMillis(Date.now() + 86400000) };
    await keyRef.set(data);
  }
  // The identity and private key never leave admin-only storage in plaintext.
  console.log(`JINMU_NAME_PUBLIC_KEY=${JSON.stringify({ keyId: data.keyId, publicKey: data.publicKey })}`);
}

async function verify(receipt, envelopeHash) {
  if (receipt.envelopeHash !== envelopeHash) throw new Error("One-time confirmation already used for another envelope");
  const actual = (await db.doc(`memberEntitlements/${receipt.email}`).get()).data();
  if (!actual || actual.email !== receipt.email || !Array.isArray(actual.permissions)) throw new Error("Confirmed Gmail readback failed");
  requireReadable(actual);
  if (![...receipt.beforePermissions, ...allowed].every((permission) => actual.permissions.includes(permission)) || actual.permissions.includes(denied)) throw new Error("Confirmed article permissions do not match");
  if (actual.eventRegistrationName !== receipt.correctedName) throw new Error("Confirmed event registration name does not match");
  if (digest(protectedFields(actual, receipt.protectedFieldNames)) !== receipt.protectedFieldsHash) throw new Error("An unrelated membership field changed; review required");
  const batch = db.batch();
  batch.set(receiptRef, { status: "verified", verifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.delete(keyRef);
  await batch.commit();
  console.log(JSON.stringify({ stage: "single-gmail-name-confirmation", status: "verified", changedGmails: 1, allowedArticles: [1, 2, 4], deniedArticles: [3], eventRegistrationNameConfirmed: true, otherMembershipFieldsPreserved: true, existingPermissionsPreserved: true, oneTimePrivateKeyDeleted: true }));
}

async function importConfirmation() {
  const raw = await readFile(new URL("../.github/private-imports/jinmu-name-confirmation.enc.json", import.meta.url), "utf8");
  const envelopeHash = createHash("sha256").update(raw).digest("hex");
  const existing = (await receiptRef.get()).data();
  if (existing) return verify(existing, envelopeHash);
  const transport = (await keyRef.get()).data();
  if (!transport || transport.expiresAt.toMillis() < Date.now()) throw new Error("One-time confirmation key unavailable or expired");
  const plan = openPlan(JSON.parse(raw), transport.privateKey, transport.keyId);
  const prepared = validateJinmuPermissionPlan(plan);
  if (plan.records.length !== 1 || prepared.records.length !== 1 || prepared.manualCount !== 0) throw new Error("This confirmation must contain exactly one approved Gmail");
  const row = prepared.records[0];
  const correctedName = String(plan.records[0].names || "").trim();
  if (!correctedName || correctedName.length > 100 || plan.confirmation !== "owner-confirmed-registration-name") throw new Error("Missing owner name confirmation");
  if (row.permissions.length !== allowed.length || !allowed.every((permission) => row.permissions.includes(permission))) throw new Error("Only articles 1, 2 and 4 are authorized by this confirmation");
  const target = db.doc(`memberEntitlements/${row.email}`);
  const receipt = await db.runTransaction(async (tx) => {
    const receiptSnapshot = await tx.get(receiptRef);
    if (receiptSnapshot.exists) return receiptSnapshot.data();
    const snapshot = await tx.get(target);
    const before = snapshot.data() || {};
    if (before.email !== undefined && before.email !== row.email) throw new Error("Existing Gmail identity mismatch");
    if (before.permissions !== undefined && !Array.isArray(before.permissions)) throw new Error("Existing permissions are not an array");
    if (before.permissions?.includes(denied)) throw new Error("Existing patron permission conflicts with this confirmation; no mutation performed");
    requireReadable(before);
    const protectedFieldNames = Object.keys(before).filter((key) => !changedFields.has(key));
    const pending = { status: "applied", envelopeHash, email: row.email, correctedName, sourceRows: String(plan.records[0].sourceRows || ""), beforePermissions: before.permissions || [], protectedFieldNames, protectedFieldsHash: digest(protectedFields(before, protectedFieldNames)), appliedAt: FieldValue.serverTimestamp() };
    tx.set(target, { email: row.email, permissions: FieldValue.arrayUnion(...allowed), eventRegistrationName: correctedName, eventRegistrationNameConfirmedAt: FieldValue.serverTimestamp(), eventPermissionsSource: "2026-jinmu-gmail-excel-audit", eventPermissionsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(receiptRef, pending);
    return pending;
  });
  await verify(receipt, envelopeHash);
}

try {
  if (process.argv[2] === "prepare") await prepare();
  else if (process.argv[2] === "import") await importConfirmation();
  else throw new Error("Expected prepare | import");
} catch {
  // Public Actions logs must not contain an identity, decrypted data or credentials.
  console.error("Name confirmation failed; inspect the private admin-only receipt. No identity or credentials logged.");
  process.exitCode = 1;
}
