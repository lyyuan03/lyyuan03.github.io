import { appendFile, readFile } from "node:fs/promises";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createRequire } from "node:module";
import { validateJinmuPermissionPlan } from "../jinmu-permission-plan.js";
import { openPlan } from "./jinmu-import-envelope.mjs";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const project = "lyyuan03-membership";
const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)), projectId: project });
const db = getFirestore(app);
const keyRef = db.doc("membershipSettings/jinmuPermissionImportTransport");
const receiptRef = db.doc("membershipSettings/jinmuPermissionImportReceipt");

async function infrastructure() {
  const { access_token: token } = await app.options.credential.getAccessToken();
  const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${project}/services/cloudfunctions.googleapis.com`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  let state = result.state;
  if (!response.ok) {
    // API disabled is positive evidence; other permission errors must not be treated as disabled.
    const functionsResponse = await fetch(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/-/functions`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    const functions = await functionsResponse.json();
    const disabled = functions.error?.details?.some((detail) => detail.reason === "SERVICE_DISABLED" && detail.metadata?.service === "cloudfunctions.googleapis.com");
    if (disabled) state = "DISABLED";
    else if (functionsResponse.ok) state = "ENABLED";
    else throw new Error(`Cannot verify Cloud Functions state (${response.status}/${functionsResponse.status}); no API enabled`);
  }
  if (!["ENABLED", "DISABLED"].includes(state)) throw new Error("Unexpected Cloud Functions state");
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `functions_enabled=${state === "ENABLED"}\n`);
  console.log(JSON.stringify({ stage: "existing-infrastructure", cloudFunctions: state, existingScheduledReconcile: "15-minute GitHub workflow; array preservation patched", newApisEnabled: false }));
}

async function prepare() {
  const receipt = await receiptRef.get();
  if (receipt.data()?.status === "verified") throw new Error("Import already completed; no new key generated");
  let data = (await keyRef.get()).data();
  if (!data || data.expiresAt.toMillis() < Date.now()) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    data = { keyId: randomUUID(), privateKey, publicKey, expiresAt: Timestamp.fromMillis(Date.now() + 86400000) };
    await keyRef.set(data);
  }
  // Only the PUBLIC key leaves the admin-only document. Never log plan or private key.
  console.log(`JINMU_IMPORT_PUBLIC_KEY=${JSON.stringify({ keyId: data.keyId, publicKey: data.publicKey })}`);
}

async function importPlan() {
  const raw = await readFile(new URL("../.github/private-imports/jinmu-permissions.enc.json", import.meta.url), "utf8");
  const envelopeHash = createHash("sha256").update(raw).digest("hex");
  const existingReceipt = (await receiptRef.get()).data();
  if (existingReceipt?.status === "verified" && existingReceipt.envelopeHash === envelopeHash) {
    console.log(JSON.stringify({ stage: "gmail-permission-import", status: "already-verified", importedEmails: existingReceipt.importedEmails, counts: existingReceipt.counts }));
    return;
  }
  const transport = (await keyRef.get()).data();
  if (!transport || transport.expiresAt.toMillis() < Date.now()) throw new Error("One-time import key unavailable or expired");
  const prepared = validateJinmuPermissionPlan(openPlan(JSON.parse(raw), transport.privateKey, transport.keyId));
  if (!prepared.records.length || prepared.records.length > 100) throw new Error("Unexpected import size");
  console.log(JSON.stringify({ stage: "gmail-import-preflight", emails: prepared.records.length, counts: prepared.counts, manualExcluded: prepared.manualCount, nonGmailIncluded: 0 }));
  const refs = prepared.records.map((row) => db.doc(`memberEntitlements/${row.email}`));
  // One transaction: no partial import; conflict retries preserve concurrent membership edits.
  const before = await db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...refs);
    snapshots.forEach((snapshot, index) => {
      const previous = snapshot.data();
      if (previous?.permissions !== undefined && !Array.isArray(previous.permissions)) throw new Error("Existing permissions are not an array; import stopped");
      const row = prepared.records[index];
      tx.set(refs[index], { permissions: FieldValue.arrayUnion(...row.permissions), eventPermissionsSource: "2026-jinmu-gmail-excel-audit", eventPermissionsUpdatedAt: FieldValue.serverTimestamp(), ...(snapshot.exists ? {} : { email: row.email }) }, { merge: true });
    });
    return snapshots.map((snapshot) => snapshot.data() || {});
  });
  const after = await db.getAll(...refs);
  after.forEach((snapshot, index) => {
    const actual = snapshot.data();
    const expectedPermissions = [...(before[index].permissions || []), ...prepared.records[index].permissions];
    if (!expectedPermissions.every((value) => actual.permissions.includes(value))) throw new Error("Permission readback mismatch");
    for (const [field, value] of Object.entries(before[index])) {
      if (["permissions", "eventPermissionsSource", "eventPermissionsUpdatedAt", "computedAt"].includes(field)) continue;
      if (!isDeepStrictEqual(actual[field], value)) throw new Error(`Existing membership field changed: ${field}`);
    }
  });
  const receipt = { status: "verified", envelopeHash, importedEmails: after.length, counts: prepared.counts, manualExcluded: prepared.manualCount, nonGmailIncluded: 0, existingFieldsPreserved: true, existingPermissionsPreserved: true, verifiedAt: FieldValue.serverTimestamp() };
  const batch = db.batch();
  batch.set(receiptRef, receipt);
  batch.delete(keyRef);
  await batch.commit();
  console.log(JSON.stringify({ stage: "gmail-permission-import", ...receipt, verifiedAt: "server timestamp", oneTimePrivateKeyDeleted: true }));
}

const action = process.argv[2];
if (action === "infrastructure") await infrastructure();
else if (action === "prepare") await prepare();
else if (action === "import") await importPlan();
else throw new Error("Expected infrastructure | prepare | import");
