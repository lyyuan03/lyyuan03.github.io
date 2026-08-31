import { constants, createCipheriv, createDecipheriv, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";

const PURPOSE = "lyyuan03/2026-jinmu-gmail-permissions/v1";
export function sealPlan(plan, publicKey, keyId) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${PURPOSE}:${keyId}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plan), "utf8"), cipher.final()]);
  const wrappedKey = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
  key.fill(0);
  return { version: 1, purpose: PURPOSE, keyId, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), wrappedKey: wrappedKey.toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function openPlan(envelope, privateKey, keyId) {
  if (envelope.version !== 1 || envelope.purpose !== PURPOSE || envelope.keyId !== keyId) throw new Error("Invalid import envelope");
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from(`${PURPOSE}:${keyId}`));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8"));
  } finally { key.fill(0); }
}
