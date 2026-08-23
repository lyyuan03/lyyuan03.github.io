import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parse } from "acorn";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsRequire = createRequire(path.join(root, "functions", "package.json"));
const { getApps, initializeApp } = functionsRequire("firebase-admin/app");
const { FieldValue, getFirestore } = functionsRequire("firebase-admin/firestore");

const PAID_MARKER = "<!-- paid-only -->";
const PRIVATE_COLLECTION = "paidArticleBodies";

if (!getApps().length) initializeApp();
const db = getFirestore();

function splitPaidContent(value = "") {
  const content = String(value || "");
  const markerIndex = content.indexOf(PAID_MARKER);
  if (markerIndex < 0) return null;
  return {
    publicContent: content.slice(0, markerIndex).trim(),
    privateContent: content.slice(markerIndex + PAID_MARKER.length).trim()
  };
}

function digest(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, visitor);
    } else if (value && typeof value === "object" && typeof value.type === "string") {
      walk(value, visitor);
    }
  }
}

function propertyName(property) {
  if (property?.type !== "Property") return "";
  if (property.key?.type === "Identifier") return property.key.name || "";
  if (property.key?.type === "Literal") return String(property.key.value || "");
  return "";
}

function objectProperties(node) {
  const map = new Map();
  for (const property of node?.properties || []) {
    if (property?.type !== "Property" || property.kind !== "init") continue;
    const name = propertyName(property);
    if (name) map.set(name, property.value);
  }
  return map;
}

function literal(node) {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((item) => item.value.cooked ?? item.value.raw).join("");
  }
  return undefined;
}

function literalArray(node) {
  if (node?.type !== "ArrayExpression") return undefined;
  const values = node.elements.map(literal);
  return values.every((value) => typeof value === "string") ? values : undefined;
}

function sourceArticleFromObject(node, filePath) {
  if (node?.type !== "ObjectExpression") return null;
  const props = objectProperties(node);
  const id = String(literal(props.get("id")) || literal(props.get("slug")) || "").trim();
  const contentNode = props.get("content");
  if (!id || !contentNode) return null;
  const content = literal(contentNode);
  if (typeof content !== "string") return null;
  const split = splitPaidContent(content);
  if (!split?.privateContent) return null;

  const result = {
    id,
    slug: String(literal(props.get("slug")) || id),
    title: String(literal(props.get("title")) || ""),
    category: String(literal(props.get("category")) || "spiritual"),
    status: literal(props.get("status")) === "draft" ? "draft" : "published",
    excerpt: String(literal(props.get("excerpt")) || ""),
    coverImage: String(literal(props.get("coverImage")) || ""),
    thumbnailImage: String(literal(props.get("thumbnailImage")) || ""),
    accessType: "paid",
    publicContent: split.publicContent,
    privateContent: split.privateContent,
    source: `github-source:${path.basename(filePath)}`
  };
  for (const key of [
    "displayCategory", "series", "bookTitle", "bookAuthor", "bookPublisher",
    "bookPurchaseUrl", "bookCoverImage", "readingLevel", "sharePath", "publishedAt"
  ]) {
    const value = literal(props.get(key));
    if (value !== undefined && value !== null) result[key] = value;
  }
  const topics = literalArray(props.get("topics"));
  if (topics) result.topics = topics;
  return result;
}

function collectPaidStaticArticles() {
  const files = fs.readdirSync(root)
    .filter((name) => /^article-.*\.js$/.test(name) || name === "static-articles-base.js")
    .map((name) => path.join(root, name));
  const byId = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    let ast;
    try {
      ast = parse(source, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
    } catch (error) {
      throw new Error(`Cannot parse ${path.basename(filePath)}: ${error.message}`);
    }
    walk(ast, (node) => {
      const article = sourceArticleFromObject(node, filePath);
      if (!article) return;
      const previous = byId.get(article.id);
      if (previous && previous.privateContent !== article.privateContent) {
        throw new Error(`Conflicting paid source bodies found for article ${article.id}`);
      }
      if (!previous) byId.set(article.id, article);
    });
  }
  return byId;
}

function publicStaticPayload(source, safeContent, contentHash, contentVersion) {
  const payload = {
    title: String(source.title || ""),
    slug: String(source.slug || source.id || ""),
    category: String(source.category || "spiritual"),
    status: source.status === "draft" ? "draft" : "published",
    excerpt: String(source.excerpt || ""),
    coverImage: String(source.coverImage || ""),
    thumbnailImage: String(source.thumbnailImage || ""),
    accessType: "paid",
    content: safeContent,
    privatePaidContent: true,
    paidContentHash: contentHash,
    paidContentVersion: contentVersion,
    migratedFromStatic: true,
    updatedAt: FieldValue.serverTimestamp()
  };
  for (const key of [
    "displayCategory", "series", "bookTitle", "bookAuthor", "bookPublisher",
    "bookPurchaseUrl", "bookCoverImage", "readingLevel", "sharePath"
  ]) {
    if (source[key] !== undefined && source[key] !== null) payload[key] = source[key];
  }
  if (Array.isArray(source.topics)) payload.topics = source.topics;
  if (source.publishedAt) payload.publishedAt = source.publishedAt;
  return payload;
}

const staticById = collectPaidStaticArticles();
const publicSnapshot = await db.collection("articles").get();
const firestoreById = new Map(publicSnapshot.docs.map((item) => [item.id, item]));
const migrationById = new Map(staticById);

for (const item of publicSnapshot.docs) {
  const article = item.data() || {};
  const split = splitPaidContent(article.content);
  if (!split?.privateContent) continue;
  migrationById.set(item.id, {
    ...article,
    id: item.id,
    ...split,
    source: "firestore-public"
  });
}

if (!migrationById.size) {
  throw new Error("No paid article bodies were found. Migration stopped without changes.");
}

const results = [];
for (const [id, source] of migrationById) {
  if (!source.privateContent) throw new Error(`Paid article ${id} has no private body.`);
  const contentHash = digest(source.privateContent);
  const privateRef = db.collection(PRIVATE_COLLECTION).doc(id);
  const currentPrivate = await privateRef.get();
  const currentData = currentPrivate.data() || {};
  const contentVersion = currentData.contentHash === contentHash
    ? Math.max(1, Number(currentData.contentVersion || 1))
    : Math.max(1, Number(currentData.contentVersion || 0) + 1);
  const sourceStatus = source.status === "draft" ? "draft" : "published";

  await privateRef.set({
    articleId: id,
    title: String(source.title || currentData.title || ""),
    status: sourceStatus,
    content: source.privateContent,
    contentHash,
    contentVersion,
    source: source.source,
    active: true,
    migratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const verifyPrivate = await privateRef.get();
  const verifyData = verifyPrivate.data() || {};
  if (!verifyPrivate.exists || verifyData.contentHash !== contentHash || verifyData.content !== source.privateContent) {
    throw new Error(`Private body verification failed for ${id}`);
  }

  const safeContent = `${source.publicContent}\n\n${PAID_MARKER}`.trim();
  let publicDoc = firestoreById.get(id);
  let publicSanitized = false;
  let publicCreated = false;

  if (publicDoc) {
    const publicArticle = publicDoc.data() || {};
    const currentSplit = splitPaidContent(publicArticle.content);
    if (currentSplit?.privateContent || String(publicArticle.content || "").trim() !== safeContent) {
      await publicDoc.ref.set({
        content: safeContent,
        accessType: "paid",
        privatePaidContent: true,
        paidContentHash: contentHash,
        paidContentVersion: contentVersion,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      publicSanitized = true;
    }
  } else {
    const staticSource = staticById.get(id) || source;
    const publicRef = db.collection("articles").doc(id);
    await publicRef.set({
      ...publicStaticPayload(staticSource, safeContent, contentHash, contentVersion),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    publicDoc = await publicRef.get();
    firestoreById.set(id, publicDoc);
    publicCreated = true;
  }

  const verifyPublic = await db.collection("articles").doc(id).get();
  const verifyPublicData = verifyPublic.data() || {};
  const verifySplit = splitPaidContent(verifyPublicData.content || "");
  if (!verifyPublic.exists || !verifySplit || verifySplit.privateContent) {
    throw new Error(`Public article sanitization verification failed for ${id}`);
  }
  if (verifyPublicData.accessType !== "paid" || verifyPublicData.privatePaidContent !== true) {
    throw new Error(`Public paid metadata verification failed for ${id}`);
  }

  results.push({ id, source: source.source, publicCreated, publicSanitized, contentVersion });
  const publicState = publicCreated ? "created-safe" : (publicSanitized ? "sanitized" : "already-safe");
  console.log(`[paid-migration] ${id}: private verified; public=${publicState}`);
}

console.log(`Paid article migration complete: ${results.length} article(s).`);
console.log(JSON.stringify(results, null, 2));
