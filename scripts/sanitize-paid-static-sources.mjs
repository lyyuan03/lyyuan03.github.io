import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAID_MARKER = "<!-- paid-only -->";

// 這 17 篇已由 migrate-paid-article-bodies.mjs 寫入 paidArticleBodies，
// 並在 GitHub Actions Run 32611076611 逐篇驗證完整正文一致後才允許清理公開來源。
const MIGRATED_ARTICLE_IDS = new Set([
  "2058-future-person-prophecy",
  "celebrity-death-dream-spirit-five-checks",
  "dragon-canon-consciousness-field",
  "fantasy-intuition-or-yuanshen",
  "how-to-judge-true-lingxiu-understanding",
  "japan-temple-faith-and-decline",
  "jitong-discernment-before-exorcism",
  "jitong-leader-discernment",
  "love-beyond-filial-piety-and-ancestor-worship",
  "shenming-yinlu-ganying-budengyu-xiuwei",
  "wealth-as-water",
  "spiritual-practice-cannot-be-outsourced-to-gods",
  "good-fortune-believe-in-yourself-choices",
  "yuanshen-awakening-eleven-principles",
  "seven-twenty-five-election-shift",
  "jitong-shenming-fushen",
  "market-crash-money-self-control"
]);

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
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((item) => item.value.cooked ?? item.value.raw).join("");
  }
  return undefined;
}

function splitPaidContent(value = "") {
  const content = String(value || "");
  const markerIndex = content.indexOf(PAID_MARKER);
  if (markerIndex < 0) return null;
  return {
    publicContent: content.slice(0, markerIndex).trim(),
    privateContent: content.slice(markerIndex + PAID_MARKER.length).trim()
  };
}

function sourceFiles() {
  return fs.readdirSync(root)
    .filter((name) => /^article-.*\.js$/.test(name) || name === "static-articles-base.js")
    .map((name) => path.join(root, name));
}

function parseFile(filePath, source) {
  try {
    return parse(source, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  } catch (error) {
    throw new Error(`Cannot parse ${path.basename(filePath)}: ${error.message}`);
  }
}

function articleContentRecords(filePath, source) {
  const ast = parseFile(filePath, source);
  const records = [];

  walk(ast, (node) => {
    if (node?.type !== "ObjectExpression") return;
    const props = objectProperties(node);
    const id = String(literal(props.get("id")) || literal(props.get("slug")) || "").trim();
    const contentNode = props.get("content");
    if (!id || !contentNode) return;

    const content = literal(contentNode);
    if (content === undefined) {
      const raw = source.slice(contentNode.start, contentNode.end);
      if (raw.includes(PAID_MARKER)) {
        throw new Error(`Dynamic paid content cannot be sanitized safely: ${id} in ${path.basename(filePath)}`);
      }
      return;
    }

    const split = splitPaidContent(content);
    if (!split) return;
    records.push({ id, contentNode, split });
  });

  return records;
}

const changed = [];
const sanitizedIds = new Set();

for (const filePath of sourceFiles()) {
  const source = fs.readFileSync(filePath, "utf8");
  const records = articleContentRecords(filePath, source)
    .filter((record) => record.split.privateContent);
  if (!records.length) continue;

  for (const record of records) {
    if (!MIGRATED_ARTICLE_IDS.has(record.id)) {
      throw new Error(
        `Refusing to remove unverified paid body: ${record.id} in ${path.basename(filePath)}. ` +
        "Run the private-body migration and verification first."
      );
    }
  }

  const replacements = records
    .map((record) => ({
      start: record.contentNode.start,
      end: record.contentNode.end,
      id: record.id,
      value: JSON.stringify(`${record.split.publicContent}\n\n${PAID_MARKER}`.trim())
    }))
    .sort((a, b) => b.start - a.start);

  let next = source;
  for (const replacement of replacements) {
    next = `${next.slice(0, replacement.start)}${replacement.value}${next.slice(replacement.end)}`;
    sanitizedIds.add(replacement.id);
  }

  parseFile(filePath, next);
  fs.writeFileSync(filePath, next);
  changed.push({ file: path.basename(filePath), ids: records.map((record) => record.id) });
}

if (!changed.length) {
  console.log("No public static paid bodies require sanitization; sources are already safe.");
}

// 全量重掃：任何 article content 在 paid-only 後仍有文字都視為失敗。
const leaks = [];
for (const filePath of sourceFiles()) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const record of articleContentRecords(filePath, source)) {
    if (record.split.privateContent) leaks.push(`${record.id}@${path.basename(filePath)}`);
  }
}
if (leaks.length) {
  throw new Error(`Paid body still exists in public static sources: ${leaks.join(", ")}`);
}

console.log(`Sanitized ${sanitizedIds.size} paid article id(s) across ${changed.length} file(s).`);
for (const item of changed) console.log(`[sanitized] ${item.file}: ${item.ids.join(", ")}`);
console.log("Static paid-source audit passed: no private suffix remains after paid-only markers.");
