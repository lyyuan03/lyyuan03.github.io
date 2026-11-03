import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { openPlan } from "./jinmu-import-envelope.mjs";

const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const ID = "2026-guanyin-renunciation-suffering";
const EVENT = "2026-guanyin-renunciation";
const KEY_ID = "guanyin-renunciation-20261103";
const TITLE = "拜觀音多年，為什麼人生還是有這麼多苦難？";
const PREFIX = "assets/articles/" + ID + "/";
const CONTENT_HASH = "f123146b517ed6867ce0d0da964a7d170fc0d326ab27eb2e99cdcf5a15056699";

function failUnless(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  failUnless(service.private_key && service.project_id === "lyyuan03-membership", "Missing or invalid Firebase service credentials");
  const sealed = JSON.parse(await readFile(new URL("../secure-imports/guanyin-renunciation-20261103.sealed.json", import.meta.url), "utf8"));
  const plan = openPlan(sealed, service.private_key, KEY_ID);
  failUnless(plan.articleId === ID && plan.eventId === EVENT && plan.title === TITLE, "Sealed article identity mismatch");
  const content = gunzipSync(Buffer.from(plan.contentGzipB64 || "", "base64")).toString("utf8");
  const digest = createHash("sha256").update(content).digest("hex");
  failUnless(plan.contentSha256 === digest && digest === CONTENT_HASH, "Protected manuscript hash mismatch");
  failUnless(content.startsWith("# " + TITLE), "Protected manuscript title mismatch");
  failUnless((content.match(/^## /gm) || []).length === 9, "Unexpected article headings");
  const imageNames = (content.match(/assets\/articles\/2026-guanyin-renunciation-suffering\/\d\d-guanyin\.webp/g) || []);
  failUnless(imageNames.length === 6 && new Set(imageNames).size === 6, "Expected six unique in-article illustrations");

  const app = initializeApp({ credential: cert(service), projectId: "lyyuan03-membership" });
  const db = getFirestore(app);
  const articleRef = db.doc("articles/" + ID);
  const bodyRef = db.doc("eventArticleBodies/" + ID);
  const eventRef = db.doc("membershipSettings/eventManagement");
  const [articleSnap, bodySnap, eventSnap] = await Promise.all([
    articleRef.get(), bodyRef.get(), eventRef.get()
  ]);
  if (articleSnap.exists) {
    const existing = articleSnap.data() || {};
    failUnless(existing.accessType === "event" && existing.requiredPermission === EVENT, "Existing article has incompatible permission");
    failUnless((existing.content || "") === "", "Refusing to expose or overwrite public article content");
  }
  if (bodySnap.exists) {
    const existing = bodySnap.data() || {};
    failUnless(existing.requiredPermission === EVENT, "Existing private body has different permission");
    failUnless(existing.contentHash === CONTENT_HASH && existing.content === content, "Existing private body has changed; refusing to overwrite edited content");
  }

  const currentEvents = Array.isArray(eventSnap.data()?.events) ? eventSnap.data().events : [];
  const collision = currentEvents.find(x => x.id === EVENT);
  failUnless(!collision || /觀世音菩薩出家|觀音出家/.test(collision.name || ""), "Activity identifier already used for another event");
  const nextEvents = collision ? currentEvents : currentEvents.concat({
    id: EVENT, name: "2026（丙午）觀世音菩薩出家紀念日法儀", status: "active"
  });

  const article = {
    id: ID,
    slug: ID,
    title: TITLE,
    author: "宇色",
    category: "spiritual",
    displayCategory: "靈修",
    series: "丙午觀世音菩薩出家日｜專屬文選",
    excerpt: "拜觀音多年，為何苦難仍接連發生？從持咒、業力、靈性投射到慈悲與大無畏，重新思考修行如何走入日常。",
    accessType: "event",
    eventId: EVENT,
    eventName: "2026（丙午）觀世音菩薩出家紀念日法儀",
    requiredPermission: EVENT,
    accessBadge: "觀音出家日登記者專屬",
    accessDeniedMessage: "本篇僅提供2026年觀世音菩薩出家紀念日法儀已確認登記的信眾閱讀。",
    content: "",
    previousContentBackup: "",
    encryptedContent: "",
    eventIv: "",
    magicLinkAccess: {},
    status: "published",
    hidden: false,
    readingLevel: "深度",
    topics: ["觀音法會", "慈悲與大無畏", "靈修心性"],
    coverImage: PREFIX + "cover.webp",
    thumbnailImage: PREFIX + "thumbnail-9x16.webp",
    sharePath: "article/guanyin-renunciation-suffering.html",
    source: "secure-guanyin-publication-20261103",
    updatedAt: FieldValue.serverTimestamp(),
    ...(!articleSnap.data()?.publishedAt ? { publishedAt: FieldValue.serverTimestamp() } : {})
  };
  const privateBody = {
    articleId: ID, title: TITLE, requiredPermission: EVENT,
    status: "published", active: true, content, contentHash: CONTENT_HASH,
    source: "sealed-guanyin-import-20261103",
    updatedAt: FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(articleRef, article, { merge: true });
  batch.set(bodyRef, privateBody, { merge: true });
  if (!collision) batch.set(eventRef, { events: nextEvents, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  // Only previously admin-confirmed event registrations are synchronized.
  // No general membership/paid article access automatically grants this permission.
  const memberSnapshot = await db.collection("memberAccess").get();
  const writer = db.bulkWriter();
  let grants = 0;
  for (const member of memberSnapshot.docs) {
    const record = member.data() || {};
    if (record.eventAccess?.[EVENT]?.status !== "active") continue;
    const email = String(record.email || member.id).trim().toLowerCase();
    if (!/^[^@\s]+@gmail\.com$/.test(email) || member.id !== email) continue;
    if (record.disabled || record.suspended) continue;
    const ref = db.doc("memberEntitlements/" + email);
    const snapshot = await ref.get();
    const existing = snapshot.data() || {};
    const permissions = [...new Set([...(Array.isArray(existing.permissions) ? existing.permissions : []), EVENT])];
    const managed = [...new Set([...(Array.isArray(existing.activityManagedPermissions) ? existing.activityManagedPermissions : []), EVENT])];
    writer.set(ref, {
      email, permissions, activityManagedPermissions: managed,
      schemaVersion: existing.schemaVersion || 1,
      activityManagementSyncedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    grants += 1;
  }
  await writer.close();
  const check = await Promise.all([articleRef.get(), bodyRef.get()]);
  failUnless(check[0].data()?.content === "" && check[1].data()?.contentHash === CONTENT_HASH, "Post-publication Firestore verification failed");
  console.log(JSON.stringify({ status: "published", articleId: ID, requiredPermission: EVENT,
    contentSha256: CONTENT_HASH, imageCount: imageNames.length, synchronizedRegisteredEmails: grants,
    articleUrl: "https://lyyuan.tw/articles.html?id=" + ID }));
}
run().catch(error => { console.error("Secure Guanyin publication failed:", error.message); process.exitCode = 1; });