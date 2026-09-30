import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const rules = read("firestore.rules");
const loader = read("paid-article-secure-loader.js");
const resolver = read("member-access-resolver.js");
const core = read("articles-core-20260810-v6.js");

function blockBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Missing policy block start: ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `Missing policy block end: ${endToken}`);
  return source.slice(start, end);
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

const wellnessPaidBlock = blockBetween(rules, "function hasWellnessPaidArticleAccess()", "function hasCanonicalPaidArticleAccess()");
const entitlementBlock = blockBetween(rules, "function hasCanonicalPaidArticleAccess()", "function sponsorSourceNewerThanEntitlement()");
const fallbackBlock = blockBetween(rules, "function shouldUseLegacyAccessFallback()", "function articleWindowEffectiveAt()");
const canReadBlock = blockBetween(rules, "function canReadPaidArticles(articleId)", "function hasCanonicalWellnessVideoAccess()");
const windowBlock = blockBetween(rules, "function articleWindowEffectiveAt()", "function canReadPaidArticles(articleId)");
const lingjiBlock = blockBetween(rules, "function isLingjiMember()", "function hasDirectSponsorArticleAccess()");
const sponsorBlock = blockBetween(rules, "function hasDirectSponsorArticleAccess()", "function hasWellnessPaidArticleAccess()");

// Canonical entitlements are the primary authority.
assert.ok(entitlementBlock.includes("memberEntitlement()"), "Canonical paid article access must use the memberEntitlements helper.");
assert.ok(entitlementBlock.includes("sponsorArticleAccess == true"), "Canonical sponsor article access must be explicit.");
assert.ok(entitlementBlock.includes("wellnessArticleAccess == true"), "Canonical wellness article access must be explicit.");
assert.ok(entitlementBlock.includes("sponsorExpiresAt > request.time"), "Canonical sponsor access must enforce expiry.");
assert.ok(entitlementBlock.includes("wellnessExpiresAt > request.time"), "Canonical wellness access must enforce expiry.");
assert.ok(canReadBlock.includes("hasCanonicalPaidArticleAccessInWindow(articleId)"), "Paid articles must use canonical entitlements first, limited to the member reading window.");
assert.ok(windowBlock.includes("hasCanonicalPaidArticleAccess()"), "Window-limited canonical access must build on the canonical entitlement check.");

// 付費文章閱讀範圍：開通日前 30 天起發表的付費文章；到期即不能閱讀。
assert.ok(rules.includes("allow read: if canReadPaidArticles(articleId)"), "Paid bodies must be checked against the article being read.");
assert.ok(windowBlock.includes("duration.value(30, 'd')"), "LOCK: reading window lookback must stay 30 days.");
assert.ok(windowBlock.includes("timestamp.date(2026, 9, 30) + duration.value(16, 'h')"), "LOCK: reading window effective date must stay 2026-10-01 Asia/Taipei.");
assert.ok(windowBlock.includes("get(articlePath).data.publishedAt >= windowStart"), "LOCK: articles must be compared by first publish time.");
assert.ok(windowBlock.includes('entitlementWindowAllows(articleId, "sponsorArticleWindowStartsAt", sponsorMember().data)'), "LOCK: sponsor reading window must be enforced.");
assert.ok(windowBlock.includes('entitlementWindowAllows(articleId, "wellnessArticleWindowStartsAt", wellnessMember().data)'), "LOCK: wellness/Lingji reading window must be enforced.");
assert.ok(windowBlock.includes("sponsorExpiresAt > request.time") && windowBlock.includes("wellnessExpiresAt > request.time"), "LOCK: window access must still require an unexpired membership.");
assert.ok(canReadBlock.includes("memberRecordWindowAllows(sponsorMember().data, articleId)"), "LOCK: sponsor fallback must enforce the reading window.");
assert.ok(canReadBlock.includes("memberRecordWindowAllows(wellnessMember().data, articleId)"), "LOCK: wellness fallback must enforce the reading window.");
assert.ok(canReadBlock.includes("shouldUseLegacyAccessFallback()"), "A bounded legacy fallback must exist for newly changed member records.");
assert.ok(fallbackBlock.includes("!hasMemberEntitlementRecord()"), "Fallback must cover records not yet migrated.");


// Firestore fallback policy: ordinary wellness membership alone MUST NOT grant article access.
assert.ok(wellnessPaidBlock.includes("isActiveWellnessMember()"), "Paid wellness fallback must require an active wellness membership.");
assert.ok(wellnessPaidBlock.includes('memberLevel == "lingji"'), "Current Lingji members must be allowed.");
assert.ok(wellnessPaidBlock.includes('keys().hasAny(["articleAccess"])'), "General wellness paid access must require an explicit articleAccess field.");
assert.ok(wellnessPaidBlock.includes("articleAccess == true"), "General wellness paid access must require articleAccess == true.");
assert.ok(canReadBlock.includes("isAdmin()"), "Admin access must remain available.");
assert.ok(canReadBlock.includes("hasDirectSponsorArticleAccess()"), "Sponsor fallback must remain available during synchronization.");
assert.ok(canReadBlock.includes("hasWellnessPaidArticleAccess()"), "Wellness fallback must remain routed through the locked helper.");
assert.ok(!canReadBlock.includes("isActiveWellnessMember()"), "LOCK VIOLATION: ordinary active wellness members must not automatically read paid articles.");
assert.ok(!canReadBlock.includes("isRecordedActiveMember()"), "LOCK VIOLATION: historical/recorded membership must not grant paid access.");
assert.ok(!lingjiBlock.includes("annualSpend"), "LOCK VIOLATION: annual spend progress must not become current Lingji paid access.");

// Sponsor paid-article membership is independent from wellness/general membership.
assert.ok(sponsorBlock.includes('memberType == "sponsor-member"'), "Direct sponsor access must require sponsor-member type.");
assert.ok(sponsorBlock.includes('paymentStatus == "paid"'), "Direct sponsor access must require paid status.");
assert.ok(sponsorBlock.includes('articleAccess == true'), "Direct sponsor access must require articleAccess == true.");
assert.ok(sponsorBlock.includes('accessScope == "sponsor-paid-articles"'), "Direct sponsor access must keep the sponsor-paid-articles scope.");
assert.ok(!sponsorBlock.includes("wellnessMember()"), "LOCK VIOLATION: sponsor access must not depend on wellness member data.");
assert.ok(!sponsorBlock.includes("hasWellnessMemberRecord()"), "LOCK VIOLATION: sponsor access must not require a wellness/general member record.");
assert.ok(!sponsorBlock.includes("memberLevel"), "LOCK VIOLATION: sponsor access must not depend on wellness/general member level.");

// Frontend must use one resolver and prefer canonical entitlements before legacy data.
assert.ok(/import \{ resolveMemberAccess, paidArticleWindowStart, paidArticleWithinWindow \} from "\.\/member-access-resolver\.js\?v=[^"]+"/.test(loader),
  "Secure loader must delegate member decisions and the reading window to the unified resolver.");
assert.ok(resolver.includes("const ARTICLE_WINDOW_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;"),
  "LOCK: frontend reading window lookback must stay 30 days.");
assert.ok(!loader.includes("activeSponsorMember("),
  "Secure loader must not duplicate sponsor membership rules.");
assert.ok(!loader.includes("activeWellnessMember("),
  "Secure loader must not duplicate wellness membership rules.");
assert.ok(resolver.includes("activeEntitlement(entitlement, email)"),
  "Resolver must check canonical entitlements.");
assert.ok(resolver.includes("activeSponsorMember(sponsor, email)"),
  "Resolver must keep sponsor fallback during synchronization.");
assert.ok(resolver.includes('wellness.memberLevel === "lingji" || wellness.articleAccess === true'),
  "Resolver must only allow Lingji or explicit wellness articleAccess.");
assert.ok(!/wellnessAccess\s*===\s*true[\s\S]{0,160}return \{ allowed: true/.test(resolver),
  "LOCK VIOLATION: wellnessAccess alone must never unlock paid articles.");
const entitlementFrontendIndex = resolver.indexOf("if (activeEntitlement(entitlement, email))");
const sponsorFrontendIndex = resolver.indexOf("if (activeSponsorMember(sponsor, email))");
const wellnessFrontendIndex = resolver.indexOf("if (activeWellnessMember(wellness, email)");
assert.ok(entitlementFrontendIndex >= 0 && sponsorFrontendIndex > entitlementFrontendIndex && wellnessFrontendIndex > sponsorFrontendIndex,
  "LOCK VIOLATION: frontend must prefer canonical entitlements, then sponsor fallback, then wellness fallback.");
assert.ok(core.includes('data-paid-body-state="locked"'),
  "Paid articles must render locked before secure authorization completes.");

function mayRead({ kind, level = "", articleAccess = false }) {
  if (kind === "sponsor") return true;
  if (kind !== "wellness") return false;
  if (level === "lingji") return true;
  return level === "wellness" && articleAccess === true;
}

const DAY = 86400000;
function mayReadArticle(state, publishedAt, now) {
  if (!mayRead(state)) return false;
  if (!(state.expiresAt > now)) return false;
  if (state.windowStart === 0) return true;
  return publishedAt >= state.windowStart;
}
const joinedAt = Date.UTC(2026, 9, 20);
const windowState = { kind: "sponsor", articleAccess: true, windowStart: joinedAt - 30 * DAY, expiresAt: joinedAt + 30 * DAY };
assert.equal(mayReadArticle(windowState, joinedAt - 10 * DAY, joinedAt + DAY), true, "Articles from the 30 days before joining must be readable.");
assert.equal(mayReadArticle(windowState, joinedAt + 20 * DAY, joinedAt + 25 * DAY), true, "Articles published during the membership must be readable.");
assert.equal(mayReadArticle(windowState, joinedAt - 31 * DAY, joinedAt + DAY), false, "Articles older than join-30d must be locked.");
assert.equal(mayReadArticle(windowState, joinedAt - 10 * DAY, joinedAt + 31 * DAY), false, "Nothing is readable after expiry.");
assert.equal(mayReadArticle({ kind: "wellness", level: "lingji", windowStart: joinedAt - 30 * DAY, expiresAt: joinedAt + 365 * DAY }, joinedAt - 40 * DAY, joinedAt), false, "Lingji members follow the same reading window.");

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
