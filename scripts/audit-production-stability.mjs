import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const html = read("articles.html");
const bootstrap = read("articles-v6.js");
const core = read("articles-core-20260810-v6.js");
const rescue = read("article-list-rescue.js");
const draftPreview = read("article-admin-draft-preview.js");
const gate = read("article-paid-gate-restore.js");
const toc2058 = read("article-2058-toc.js");
const publicationRepair = read("article-publication-index-repair.js");

const scriptTags = [...html.matchAll(/<script\b/g)].length;
assert.ok(scriptTags <= 14, `Article page script count grew from the locked ceiling: ${scriptTags} > 14`);

assert.ok(
  bootstrap.includes('if (!activeArticleId)') && bootstrap.includes('article-list-rescue.js'),
  "Article list rescue must remain disabled on detail pages."
);
assert.ok(!core.includes('"auth-fallback"'), "Forbidden second article bootstrap path returned.");
assert.ok(!core.includes("repairRestoredGates"), "repairRestoredGates must not exist in article core.");
assert.ok(!gate.includes("function repairRestoredGates"), "Self-healing paid gate loop must not return.");
assert.ok(!draftPreview.includes("yuanshen-awakening-old-manuscript"),
  "Generic draft preview must not special-case the published yuanshen article.");
assert.ok(draftPreview.includes("activeDetailIsDraft === true"),
  "Published article detail must not repeatedly re-run draft preview reads on every DOM mutation.");
assert.ok(publicationRepair.includes("if (!hasActiveArticleDetail)"),
  "Publication-index repair must not reload active article detail pages.");
assert.ok(toc2058.includes("if (isTargetArticle)"),
  "2058 observer/retry logic must be scoped to the 2058 article only.");

const targetGuardIndex = toc2058.indexOf("if (isTargetArticle)");
const observerIndex = toc2058.indexOf("new MutationObserver", targetGuardIndex);
const intervalIndex = toc2058.indexOf("setInterval", targetGuardIndex);
assert.ok(observerIndex > targetGuardIndex && intervalIndex > targetGuardIndex,
  "2058 MutationObserver/setInterval must stay inside the target-article guard.");

const runtimeFiles = [
  "articles-v6.js",
  "articles-core-20260810-v6.js",
  "article-admin-draft-preview.js",
  "article-publication-index-repair.js",
  "sponsor-checkout-v3.js",
  "article-thumbnail-display-v2.js",
  "article-inline-image-display.js",
  "construction-patron-restored.js",
  "article-2058-toc.js",
  "site-auth-nav.js",
  "article-paid-gate-restore.js",
  "paid-article-secure-loader.js",
  "article-key-quote-display.js",
  "article-love-beyond-filial-piety-display-fix.js",
  "article-destination-links.js"
];

let observerCount = 0;
for (const name of runtimeFiles) {
  const source = read(name);
  observerCount += (source.match(/new\s+MutationObserver/g) || []).length;
}
assert.ok(observerCount <= 14,
  `Article runtime MutationObserver count grew above locked ceiling: ${observerCount} > 14`);

const pageToken = html.match(/articles-v6\.js\?v=([^"'&]+)/)?.[1] || "";
const coreToken = bootstrap.match(/articles-core-20260810-v6\.js\?v=([^"'&]+)/)?.[1] || "";
const gateToken = bootstrap.match(/article-paid-gate-restore\.js\?v=([^"'&]+)/)?.[1] || "";
const loaderToken = bootstrap.match(/paid-article-secure-loader\.js\?v=([^"'&]+)/)?.[1] || "";
assert.ok(pageToken && coreToken && gateToken && loaderToken, "Unable to resolve article cache tokens.");
assert.equal(pageToken, coreToken, "articles.html and article core cache tokens diverged.");
assert.equal(pageToken, gateToken, "Paid gate cache token diverged from article entry token.");
assert.equal(pageToken, loaderToken, "Paid loader cache token diverged from article entry token.");

console.log(JSON.stringify({
  status: "PASS",
  scriptTags,
  mutationObservers: observerCount,
  cacheToken: pageToken
}, null, 2));
