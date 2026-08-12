from pathlib import Path

static_path = Path('static-articles.js')
text = static_path.read_text(encoding='utf-8')
old = '''const draftFuturePerson2058ProphecyArticle = {
  ...futurePerson2058ProphecyArticle,
  status: "draft"
};'''
new = '''const publishedFuturePerson2058ProphecyArticle = {
  ...futurePerson2058ProphecyArticle,
  status: "published"
};'''
if old not in text:
    raise SystemExit('draft wrapper not found')
text = text.replace(old, new, 1)
text = text.replace('  draftFuturePerson2058ProphecyArticle,', '  publishedFuturePerson2058ProphecyArticle,', 1)
static_path.write_text(text, encoding='utf-8')

core_path = Path('articles-core-20260810-v6.js')
text = core_path.read_text(encoding='utf-8')
old_import = 'import { staticArticles } from "./static-articles.js?v=20260810-complete-ending-1";'
new_import = 'import { staticArticles } from "./static-articles.js?v=20260812-2058-fallback-1";'
if old_import in text:
    text = text.replace(old_import, new_import, 1)
old_merge = '''  const mergedById = new Map();
  staticArticles.forEach((article) => {
    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);
    if (!managedByFirestore) mergedById.set(article.id, article);
  });
  firestoreArticles.forEach((article) => mergedById.set(article.id, article));'''
new_merge = '''  const mergedById = new Map();
  const firestorePublishedIds = new Set(firestoreArticles.map((article) => article.id));
  staticArticles.forEach((article) => {
    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);
    const indexedStatus = statusById.get(article.id);
    const allow2058PublishedFallback = article.id === "2058-future-person-prophecy"
      && !firestorePublishedIds.has(article.id)
      && indexedStatus?.status !== "draft"
      && indexedStatus?.hidden !== true
      && indexedStatus?.systemRecord !== true;
    if (!managedByFirestore || allow2058PublishedFallback) mergedById.set(article.id, article);
  });
  firestoreArticles.forEach((article) => mergedById.set(article.id, article));'''
if old_merge not in text:
    raise SystemExit('merge block not found')
text = text.replace(old_merge, new_merge, 1)
core_path.write_text(text, encoding='utf-8')

loader_path = Path('articles-v6.js')
text = loader_path.read_text(encoding='utf-8')
start = './articles-core-20260810-v6.js?v='
pos = text.find(start)
if pos < 0:
    raise SystemExit('core import not found')
end = text.find('"', pos)
text = text[:pos] + './articles-core-20260810-v6.js?v=20260812-2058-fallback-1' + text[end:]
loader_path.write_text(text, encoding='utf-8')

for p in [
    Path('.github/workflows/patch-2058-published-fallback.yml'),
    Path('.github/workflows/patch-2058-fallback-v2.yml'),
    Path('tools/patch_2058_fallback.py'),
]:
    if p.exists():
        p.unlink()
