import { readFile } from "node:fs/promises";
import { createDecipheriv, randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { jinmuEventArticles } from "../jinmu-event-series.js";
const require = createRequire(import.meta.url);
const { initializeApp, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const project = "lyyuan03-membership";
const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  : applicationDefault();
const app = initializeApp({ credential, projectId: project });
const db = getFirestore(app);
const auth = getAuth(app);
const apiKey = "AIzaSyAgHy-nPOErzs7NDJossVGPITbenXOfjQY";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

async function deployRules() {
  const { access_token: token } = await app.options.credential.getAccessToken();
  const request = async (url, method, payload) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw new Error(`Rules API ${response.status}: ${result.error?.message || "failed"}`);
    return result;
  };
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const ruleset = await request(`https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`, "POST", { source: { files: [{ name: "firestore.rules", content: rules }] } });
  await request(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`, "PATCH", { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: ruleset.name }, updateMask: "rulesetName" });
  console.log(JSON.stringify({ stage: "rules", status: "deployed", ruleset: ruleset.name }));
}

function decryptLegacy(article, key) {
  if (!article.encryptedContent || !article.eventIv || !key) return "";
  const packed = Buffer.from(article.encryptedContent, "base64");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), Buffer.from(article.eventIv, "base64"));
  decipher.setAuthTag(packed.subarray(-16));
  return Buffer.concat([decipher.update(packed.subarray(0, -16)), decipher.final()]).toString("utf8");
}

const imageChanges = [
  ["名字一宣讀，這段關係就被帶到壇前", "06-name-ritual-hd.png"],
  ["最痛那一刀，往往來自最親的人", "07-family-grievance-hd.png"],
  ["為什麼冤親債主永遠度不完？", "08-yuanqin-cover-hd.png"],
  ["白天放下，夜裡還在跟祂爭吵", "09-night-argument-hd.png"],
  ["不是把誰趕走，是那股抓著的力開始鬆", "10-release-grip-hd.png"]
];

function updateImages(content) {
  let next = content;
  for (const [alt, file] of imageChanges) {
    const needle = new RegExp(`!\\[${alt}\\]\\([^)]*\\)`, "g");
    if ([...next.matchAll(needle)].length !== 1) throw new Error(`Image anchor must occur once: ${file}`);
    next = next.replace(needle, `![${alt}](assets/articles/reconciliation-absolution-heart/${file}?v=20260830-hd-1)`);
  }
  if (next.includes("assets/articles/yuanqin-debt-heart/")) throw new Error("Old reconciliation image references remain");
  return next;
}

async function migrate() {
  const witnessBefore = await db.doc("eventArticleBodies/2026-lineage-lamp-building-record").get();
  if (witnessBefore.data()?.jinmuSeriesMigrationVersion !== 2) throw new Error("Protected construction article migration is incomplete; public-history recovery is permanently retired");
  const summaries = await db.runTransaction(async (transaction) => {
    const publicRefs = jinmuEventArticles.map((article) => db.doc(`articles/${article.id}`));
    const bodyRefs = jinmuEventArticles.map((article) => db.doc(`eventArticleBodies/${article.id}`));
    const snapshots = await transaction.getAll(...publicRefs, ...bodyRefs, db.doc("membershipSettings/eventArticleKeys"));
    const keys = snapshots[8].data()?.keys || {};
    const prepared = jinmuEventArticles.map((meta, index) => {
      const publicSnapshot = snapshots[index];
      if (!publicSnapshot.exists) throw new Error(`Existing article not found: ${meta.id}; no duplicate created`);
      const old = publicSnapshot.data();
      const privateBody = snapshots[index + 4].data();
      let content = privateBody?.content || old.content || decryptLegacy(old, keys[meta.id]);
      if (!content || content.length < 200) throw new Error(`Complete body unavailable: ${meta.id}`);
      // One-time conversion only: subsequent runs must preserve intentional admin body/image edits.
      if (meta.id === "reconciliation-absolution-heart" && privateBody?.jinmuSeriesMigrationVersion !== 2) content = updateImages(content);
      // 明確公開欄位白名單；不將舊 content／備份／ciphertext 留在 public document。
      const preserved = {};
      for (const key of ["bookTitle", "bookAuthor", "bookPublisher", "bookPurchaseUrl", "bookCoverImage", "createdAt", "publishedAt", "readingLevel", "topics", "thumbnailSettings", "thumbnailPosition"]) {
        if (old[key] !== undefined) preserved[key] = old[key];
      }
      return { meta, old, content, privateBody, publicPayload: { ...meta, ...preserved, content: "", hidden: false, systemRecord: false, source: "firestore-admin-authoritative", secureBodyCollection: "eventArticleBodies", updatedAt: FieldValue.serverTimestamp() } };
    });
    const statuses = {};
    prepared.forEach(({ meta, old, content, privateBody, publicPayload }, index) => {
      transaction.set(bodyRefs[index], {
        articleId: meta.id, title: meta.title, requiredPermission: meta.requiredPermission,
        content, contentHash: createHash("sha256").update(content).digest("hex"),
        status: "published", active: true,
        ...(privateBody ? {} : { migrationSourceBackup: old }),
        source: "jinmu-series-migration-v1", jinmuSeriesMigrationVersion: 2, updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(publicRefs[index], publicPayload);
      statuses[meta.id] = { status: "published", hidden: false, systemRecord: false };
    });
    transaction.set(db.doc("articleMetrics/__article-publication-status"), { statuses, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return prepared.map(({ meta, content }) => ({ id: meta.id, requiredPermission: meta.requiredPermission, bodyCharacters: content.length, imagesReplaced: meta.id === "reconciliation-absolution-heart" ? 5 : 0 }));
  });
  console.log(JSON.stringify({ stage: "migration", status: "verified-in-transaction", articles: summaries }));
}

async function requestDocument(collection, id, token = "") {
  return fetch(`${base}/${collection}/${encodeURIComponent(id)}?key=${apiKey}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000)
  });
}

async function testRules() {
  const cases = [
    ["A", ["2026-jinmu-am"], [true, false, false, false]],
    ["B", ["2026-jinmu-pm"], [false, true, false, false]],
    ["C", ["2026-jinmu-am", "2026-jinmu-pm"], [true, true, false, false]],
    ["D", ["2026-jinmu-build-patron", "2026-jinmu-build-supporter"], [false, false, true, true]],
    ["E", ["2026-jinmu-build-supporter"], [false, false, false, true]],
    ["F", [], [false, false, false, false]]
  ];
  for (const meta of jinmuEventArticles) {
    const publicResponse = await requestDocument("articles", meta.id);
    if (publicResponse.status !== 200) throw new Error(`Public card unavailable: ${meta.id}`);
    const data = await publicResponse.json();
    const fields = data.fields || {};
    if (fields.content?.stringValue || fields.previousContentBackup?.stringValue || fields.encryptedContent?.stringValue || fields.migrationSourceBackup) throw new Error(`Public body leak: ${meta.id}`);
    const privateResponse = await requestDocument("eventArticleBodies", meta.id);
    if (privateResponse.status !== 403) throw new Error(`Anonymous body must be denied: ${meta.id} (${privateResponse.status})`);
  }
  const results = [];
  for (const [label, permissions, expected] of cases) {
    const uid = `jinmu-test-${randomUUID()}`;
    const email = `${uid}@gmail.com`;
    let created = false;
    try {
      await auth.createUser({ uid, email, emailVerified: true, displayName: `Temporary permission test ${label}` });
      created = true;
      await db.doc(`memberEntitlements/${email}`).set({
        email, permissions, schemaVersion: 1, status: "active",
        // F 是一般贊助會員但無活動 permission；仍必須拒絕四篇。
        sponsorArticleAccess: label === "F", sponsorExpiresAt: new Date("2099-01-01")
      });
      const customToken = await auth.createCustomToken(uid);
      const tokenResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }), signal: AbortSignal.timeout(20000) });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.idToken) throw new Error(`Test ${label} authentication failed: ${tokens.error?.message || tokenResponse.status}`);
      const actual = [];
      for (const meta of jinmuEventArticles) {
        const response = await requestDocument("eventArticleBodies", meta.id, tokens.idToken);
        if (![200, 403].includes(response.status)) throw new Error(`Unexpected test response ${response.status}`);
        if (response.ok) {
          const doc = await response.json();
          if (!doc.fields?.content?.stringValue) throw new Error("Authorized body is empty");
        }
        actual.push(response.ok);
      }
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Test ${label} failed: ${JSON.stringify(actual)}`);
      results.push({ case: label, allowed: actual, passed: true });
    } finally {
      if (created) {
        await db.doc(`memberEntitlements/${email}`).delete();
        await auth.deleteUser(uid);
      }
    }
  }
  console.log(JSON.stringify({ stage: "live-security-tests", anonymousDenied: true, publicMetadataOnly: true, cases: results, temporaryUsersDeleted: true }));
  const receipt = (await db.doc("membershipSettings/jinmuPermissionImportReceipt").get()).data();
  if (receipt?.status === "verified") {
    const imported = await db.collection("memberEntitlements").where("eventPermissionsSource", "==", "2026-jinmu-gmail-excel-audit").get();
    const counts = { am: 0, pm: 0, patron: 0, supporter: 0, both: 0 };
    let disabledMembers = 0;
    for (const snapshot of imported.docs) {
      const record = snapshot.data();
      if (!/^[^\s@]+@gmail\.com$/.test(snapshot.id) || record.email !== snapshot.id || !Array.isArray(record.permissions)) throw new Error("Imported Gmail key or permission array invalid");
      const has = (value) => record.permissions.includes(`2026-jinmu-${value}`);
      counts.am += Number(has("am")); counts.pm += Number(has("pm"));
      counts.patron += Number(has("build-patron")); counts.supporter += Number(has("build-supporter"));
      counts.both += Number(has("am") && has("pm"));
      if (has("build-patron") && !has("build-supporter")) throw new Error("Patron lost supporter permission");
      if (record.disabled || record.suspended || record.status === "disabled") disabledMembers += 1;
    }
    if (imported.size < receipt.importedEmails || Object.entries(receipt.counts).some(([key, value]) => counts[key] < value)) throw new Error("Previously imported event permissions were lost");
    const transport = await db.doc("membershipSettings/jinmuPermissionImportTransport").get();
    if (transport.exists) throw new Error("One-time private import key still exists");
    console.log(JSON.stringify({ stage: "real-gmail-readback", records: imported.size, counts, disabledMembers, gmailKeysValid: true, permissionsRetained: true, oneTimePrivateKeyAbsent: true }));
  }
}

const action = process.argv[2];
if (action === "rules") await deployRules();
else if (action === "migrate") await migrate();
else if (action === "test") {
  // Firebase Rules 發布可能短暫尚未傳播；每次仍實際讀取並完整清理臨時帳號。
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try { await testRules(); break; }
    catch (error) {
      if (attempt === 4) throw error;
      console.log(JSON.stringify({ stage: "rules-propagation-retry", attempt, reason: error.message }));
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
else throw new Error("Expected action: rules | migrate | test");
