import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const rules = read("firestore.rules");
const loader = read("paid-article-secure-loader.js");
const core = read("articles-core-20260810-v6.js");

function functionBlock(source, name, nextName) {
  const startToken = `function ${name}()`;
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Missing function ${name}.`);
  const end = nextName ? source.indexOf(`function ${nextName}()`, start + startToken.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

const policy = Object.freeze({
  lingji: true,
  wellnessWithArticleAccess: true,
  wellnessWithoutArticleAccess: false,
  sponsor: true
});

assert.deepEqual(policy, {
  lingji: true,
  wellnessWithArticleAccess: true,
  wellnessWithoutArticleAccess: false,
  sponsor: true
}, "Paid article policy itself must not change.");

const wellnessPaidBlock = functionBlock(rules, "hasWellnessPaidArticleAccess", "canReadPaidArticles");
const canReadBlock = functionBlock(rules, "canReadPaidArticles");
const lingjiBlock = functionBlock(rules, "isLingjiMember", "hasDirectSponsorArticleAccess");

// Firestore is the final authority. General wellness membership alone MUST NOT grant access.
assert.ok(wellnessPaidBlock.includes("isActiveWellnessMember()"), "Paid wellness access must require an active wellness membership.");
assert.ok(wellnessPaidBlock.includes('memberLevel == "lingji"'), "Current Lingji members must be allowed.");
assert.ok(wellnessPaidBlock.includes('keys().hasAny(["articleAccess"])'), "General wellness paid access must require an explicit articleAccess field.");
assert.ok(wellnessPaidBlock.includes("articleAccess == true"), "General wellness paid access must require articleAccess == true.");
assert.ok(canReadBlock.includes("isAdmin()"), "Admin access must remain available.");
assert.ok(canReadBlock.includes("hasDirectSponsorArticleAccess()"), "Sponsor article members must remain allowed.");
assert.ok(canReadBlock.includes("hasWellnessPaidArticleAccess()"), "Wellness paid access must remain routed through the locked helper.");
assert.ok(!canReadBlock.includes("isActiveWellnessMember()"), "LOCK VIOLATION: ordinary active wellness members must not automatically read paid articles.");
assert.ok(!canReadBlock.includes("isRecordedActiveMember()"), "LOCK VIOLATION: historical/recorded membership must not grant paid access.");
assert.ok(!lingjiBlock.includes("annualSpend"), "LOCK VIOLATION: annual spend progress must not become current Lingji paid access.");

// Frontend must mirror the server policy, never invent a broader rule.
assert.ok(loader.includes('wellness.memberLevel === "lingji" || wellness.articleAccess === true'),
  "Secure loader must allow Lingji or explicit wellness articleAccess only.");
assert.ok(loader.includes("activeSponsorMember(sponsor, email)"),
  "Secure loader must allow active sponsor article members.");
assert.ok(!/wellnessAccess\s*===\s*true[\s\S]{0,120}return true/.test(loader),
  "LOCK VIOLATION: wellnessAccess alone must never unlock paid articles.");
assert.ok(core.includes('data-paid-body-state="locked"'),
  "Paid articles must render locked before secure authorization completes.");

function mayRead({ kind, level = "", articleAccess = false }) {
  if (kind === "sponsor") return true;
  if (kind !== "wellness") return false;
  if (level === "lingji") return true;
  return level === "wellness" && articleAccess === true;
}

const cases = [
  [{ kind: "wellness", level: "lingji", articleAccess: false }, true, "Lingji"],
  [{ kind: "wellness", level: "wellness", articleAccess: true }, true, "General wellness + paid access"],
  [{ kind: "wellness", level: "wellness", articleAccess: false }, false, "General wellness without paid access"],
  [{ kind: "sponsor", articleAccess: true }, true, "Sponsor article member"],
  [{ kind: "none" }, false, "Non-member"]
];
for (const [state, expected, label] of cases) {
  assert.equal(mayRead(state), expected, `${label} policy changed unexpectedly.`);
}

console.log("PAID ARTICLE ACCESS POLICY LOCK: PASS");
