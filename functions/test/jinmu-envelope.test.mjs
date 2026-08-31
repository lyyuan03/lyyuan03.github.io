import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { sealPlan, openPlan } from "../jinmu-import-envelope.mjs";
test("one-time permission transport hides Emails and rejects tampering", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const plan = { records: [{ email: "fixture@gmail.com", permissions: ["2026-jinmu-am"] }] };
  const envelope = sealPlan(plan, publicKey, "test-key");
  assert.equal(JSON.stringify(envelope).includes("gmail.com"), false);
  assert.deepEqual(openPlan(envelope, privateKey, "test-key"), plan);
  assert.throws(() => openPlan(envelope, privateKey, "wrong-key"));
  assert.throws(() => openPlan({ ...envelope, tag: Buffer.alloc(16).toString("base64") }, privateKey, "test-key"));
});
