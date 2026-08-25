import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const rules = read("firestore.rules");
const loader = read("paid-article-secure-loader.js");
const core = read("articles-core-20260810-v6.js");

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

// Firestore is the final authority. General wellness membership alone MUST NOT grant access.
assert.match(rules, /function hasWellnessPaidArticleAccess\(\)\s*\{[\s\S]*?isActiveWellnessMember\(\)[\s\S]*?memberLevel == "lingji"[\s\S]*?articleAccess == true[\s\S]*?\};/,
  "Firestore wellness paid-access rule no longer matches the locked policy.");
assert.match(rules, /function canReadPaidArticles\(\)\s*\{[\s\S]*?isAdmin\(\)[\s\S]*?hasDirectSponsorArticleAccess\(\)[\s\S]*?hasWellnessPaidArticleAccess\(\)[\s\S]*?\};/,
  "Firestore paid access must only combine admin, sponsor, and explicit wellness paid access.");
assert.ok(!/function canReadPaidArticles\(\)[\s\S]*?\|\|\s*isActiveWellnessMember\(\)/.test(rules),
  "LOCK VIOLATION: ordinary active wellness members must not automatically read paid articles.");
assert.ok(!/function canReadPaidArticles\(\)[\s\S]*?isRecordedActiveMember\(\)/.test(rules),
  "LOCK VIOLATION: historical/recorded membership must not grant paid access.");
assert.ok(!/function isLingjiMember\(\)[\s\S]*?annualSpend\s*>=/.test(rules),
  "LOCK VIOLATION: annual spend progress must not become current Lingji paid access.");

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
  [{ kind: "none" }, false, "Non-member"],
];
for (const [state, expected, label] of cases) {
  assert.equal(mayRead(state), expected, `${label} policy changed unexpectedly.`);
}

console.log("PAID ARTICLE ACCESS POLICY LOCK: PASS");
