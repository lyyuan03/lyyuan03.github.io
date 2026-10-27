import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const secure = readFileSync("paid-article-secure-loader.js", "utf8");
const draft = readFileSync("article-admin-draft-preview.js", "utf8");
const html = readFileSync("articles.html", "utf8");
const loader = readFileSync("articles-v6.js", "utf8");

assert.match(draft, /data-admin-draft-preview-detail="true"/);
assert.match(draft, /function hydratePaidDraft\(/);
assert.match(draft, /return \{ \.\.\.article, content: \[publicContent, privateContent\]/);
assert.match(secure, /view\.dataset\.adminDraftPreviewDetail === "true"/);
assert.match(html, /articles-v6\.js\?v=20261027-draft-private-dedup-1/);
assert.match(loader, /paid-article-secure-loader\.js\?v=20261027-draft-private-dedup-1/);

function extractFunction(start, end) {
  const from = secure.indexOf(start);
  const to = secure.indexOf(end, from);
  assert.ok(from >= 0 && to > from, "Could not isolate paid loader function");
  return secure.slice(from, to);
}

const draftView = {
  dataset: { adminDraftPreviewDetail: "true" },
  querySelectorAll(selector) {
    if (selector === "[data-paid-private-body]") return [{ remove: () => removed.push("private-body") }];
    if (selector === "[data-paid-secure-unlocked], [data-paid-secure-status]") {
      return [{ remove: () => removed.push("unlock-marker") }];
    }
    throw Error("Unexpected selector in draft preview: " + selector);
  },
  querySelector() { throw Error("Secure loader must never append to full draft preview"); }
};

const removed = [];
let unsubscribed = 0;
const context = vm.createContext({
  articleId: "historical-yuanshen-destiny-cultivation",
  currentUser: { email: "authorized-editor@example.com" },
  requestSerial: 0,
  paidBodyUnsubscribe: () => { unsubscribed += 1; },
  paidView: () => draftView
});

vm.runInContext(
  extractFunction("function insertPrivateBody(", "function ensurePaidBodyRealtimeSync(") +
  extractFunction("async function hydratePaidBody()", "function scheduleHydrate()"),
  context
);

// The draft-only HTML already holds the public and protected bodies joined once.
assert.equal(vm.runInContext('insertPrivateBody(paidView(), "already present", 1)', context), false);
await vm.runInContext("hydratePaidBody()", context);
assert.deepEqual(removed, ["private-body", "unlock-marker"]);
assert.equal(unsubscribed, 1);
assert.equal(vm.runInContext("paidBodyUnsubscribe", context), null);
assert.equal(vm.runInContext("requestSerial", context), 1);

// Ordinary published paid views must still accept the legitimate secure body.
const normalView = {
  dataset: {},
  querySelector(selector) {
    assert.equal(selector, "[data-paid-private-body]");
    return { dataset: { paidContentVersion: "1", paidContentHash: "verified-hash" } };
  }
};
context.normalView = normalView;
assert.equal(vm.runInContext('insertPrivateBody(normalView, "member prose", 1, "verified-hash")', context), true);
console.log("PASS: authorized draft preview renders private content once; ordinary paid articles still unlock");
