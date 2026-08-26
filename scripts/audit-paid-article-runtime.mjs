import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const marker = "<!-- paid-only -->";
const cacheToken = "20260826-dragon-primary-image-1";

const { staticArticles } = await import(pathToFileURL(path.join(root, "static-articles.js")).href);
const paidArticles = staticArticles.filter((article) => article.accessType === "paid" || String(article.content || "").includes(marker));

assert.ok(paidArticles.length > 0, "Expected at least one paid article in static sources.");
for (const article of paidArticles) {
  const content = String(article.content || "");
  assert.ok(content.includes(marker), `Paid article ${article.id} is missing the public/private marker.`);
  const privateSuffix = content.slice(content.indexOf(marker) + marker.length).trim();
  assert.equal(privateSuffix, "", `Paid article ${article.id} leaks private text after the public marker.`);
}

const core = read("articles-core-20260810-v6.js");
const loader = read("paid-article-secure-loader.js");
const gate = read("article-paid-gate-restore.js");
const bootstrap = read("articles-v6.js");
const page = read("articles.html");
const firestoreRules = read("firestore.rules");

assert.ok(!core.includes('accessType === "paid" && hasPaidAccess'), "Core must not remove the paid gate before the private body loads.");
assert.ok(core.includes('data-article-access="${escapeHtml(accessType)}"'), "Rendered articles must expose their access type.");
assert.ok(core.includes('data-paid-body-state="locked"'), "Paid articles must begin in a locked state.");
assert.ok(loader.includes('view.dataset.articleAccess === "paid"'), "Secure loader must recognize paid state without relying only on gate markup.");
assert.ok(loader.includes('view.dataset.paidBodyState = "unlocked"'), "Secure loader must record successful private-body insertion.");
assert.ok(loader.includes('wellness.memberLevel === "lingji" || wellness.articleAccess === true'), "Secure loader must use the unified wellness paid-access rule.");
assert.ok(loader.includes('activeSponsorMember(sponsor, email)'), "Secure loader must explicitly allow active sponsor article members.");
assert.ok(loader.includes('"&": "&amp;"') && loader.includes('"<": "&lt;"') && loader.includes('">": "&gt;"'), "Secure body rendering must HTML-escape unsafe characters.");
assert.ok(loader.indexOf("if (!normalizedContent) return false;") < loader.indexOf('querySelectorAll(".article-paid-gate'), "The loader must validate private content before removing the gate.");
assert.ok(loader.includes("return null;\n  }\n}"), "Transient metadata failures must not be cached as successful empty metadata.");

assert.ok(firestoreRules.includes('wellnessMember().data.memberLevel == "lingji"'), "Firestore rules must allow current Lingji members.");
assert.ok(firestoreRules.includes('wellnessMember().data.articleAccess == true'), "Firestore rules must allow general wellness members only when paid-article access is enabled.");
assert.ok(firestoreRules.includes('hasDirectSponsorArticleAccess()'), "Firestore rules must allow active sponsor article members.");
assert.ok(!firestoreRules.includes('|| isRecordedActiveMember()'), "Firestore rules must not grant paid articles to every recorded active wellness member.");
assert.ok(!/canReadPaidArticles\(\)[\s\S]*?\|\| isActiveWellnessMember\(\)/.test(firestoreRules), "Firestore rules must not grant paid articles to every active wellness member.");
assert.ok(!/function isLingjiMember\(\)[\s\S]*?annualSpend\s*>=\s*100000/.test(firestoreRules), "Current paid access must not confuse annual-spend progress with current Lingji level.");

function expectedPaidAccess({ kind, level, articleAccess }) {
  if (kind === "sponsor") return true;
  if (kind !== "wellness") return false;
  if (level === "lingji") return true;
  return level === "wellness" && articleAccess === true;
}

assert.equal(expectedPaidAccess({ kind: "wellness", level: "lingji", articleAccess: false }), true, "Lingji member should read paid articles.");
assert.equal(expectedPaidAccess({ kind: "wellness", level: "wellness", articleAccess: true }), true, "General wellness member with paid access should read paid articles.");
assert.equal(expectedPaidAccess({ kind: "wellness", level: "wellness", articleAccess: false }), false, "General wellness member without paid access must be blocked.");
assert.equal(expectedPaidAccess({ kind: "sponsor", level: "", articleAccess: true }), true, "Sponsor article member should read paid articles.");

assert.ok(gate.includes("data-sponsor-plan=\"1\"") && gate.includes("data-sponsor-plan=\"3\""), "Paid gate must keep both sponsorship plan choices.");
assert.ok(gate.includes("data-paid-member-login") && gate.includes("會員登入"), "Paid gate must keep the member login path.");
assert.ok(gate.includes("綠界安全付款"), "Paid gate must explain the payment path.");

assert.ok(bootstrap.includes(`articles-core-20260810-v6.js?v=${cacheToken}`), "Core cache token is not updated.");
assert.ok(bootstrap.includes(`article-paid-gate-restore.js?v=${cacheToken}`), "Paid-gate cache token is not updated.");
assert.ok(bootstrap.includes(`paid-article-secure-loader.js?v=${cacheToken}`), "Secure-loader cache token is not updated.");
assert.ok(page.includes(`articles-v6.js?v=${cacheToken}`), "Article bootstrap cache token is not updated.");

console.log(`Paid article runtime audit passed for ${paidArticles.length} paid article(s), including the unified four-state membership policy.`);
