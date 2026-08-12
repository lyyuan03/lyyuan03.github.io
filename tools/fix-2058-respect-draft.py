from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"missing expected text in {path}: {old[:160]}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# 1) Static source itself must no longer claim this Firestore-managed draft is published.
replace_once(
    "article-2058-future-person-prophecy.js",
    '  status: "published",',
    '  status: "draft",'
)

# 2) Remove the static-articles wrapper that force-published the 2058 article.
replace_once(
    "static-articles.js",
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-3',
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-4'
)
replace_once(
    "static-articles.js",
    '''const publishedFuturePerson2058ProphecyArticle = {\n  ...futurePerson2058ProphecyArticle,\n  status: "published"\n};\n\n''',
    ''
)
replace_once(
    "static-articles.js",
    '  publishedFuturePerson2058ProphecyArticle,',
    '  futurePerson2058ProphecyArticle,'
)

# 3) Treat 2058 as Firestore-managed even before/without a fresh status index,
#    and remove the special static published fallback that exposed drafts.
replace_once(
    "articles-core-20260810-v6.js",
    './static-articles.js?v=20260812-2058-fallback-1',
    './static-articles.js?v=20260812-2058-respect-draft-1'
)
replace_once(
    "articles-core-20260810-v6.js",
    'const LEGACY_FIRESTORE_MANAGED_IDS = new Set(["yuanshen-destiny-archetype"]);',
    'const LEGACY_FIRESTORE_MANAGED_IDS = new Set(["yuanshen-destiny-archetype", "2058-future-person-prophecy"]);'
)
replace_once(
    "articles-core-20260810-v6.js",
    '''  const mergedById = new Map();\n  const firestorePublishedIds = new Set(firestoreArticles.map((article) => article.id));\n  staticArticles.forEach((article) => {\n    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);\n    const allow2058PublishedFallback = article.id === "2058-future-person-prophecy"\n      && !firestorePublishedIds.has(article.id);\n    if (!managedByFirestore || allow2058PublishedFallback) mergedById.set(article.id, article);\n  });\n  firestoreArticles.forEach((article) => mergedById.set(article.id, article));\n  statusById.forEach((status, articleId) => {\n    const keep2058StaticFallback = articleId === "2058-future-person-prophecy"\n      && !firestorePublishedIds.has(articleId);\n    if (!keep2058StaticFallback && (status.status !== "published" || status.hidden === true || status.systemRecord === true)) {\n      mergedById.delete(articleId);\n    }\n  });\n''',
    '''  const mergedById = new Map();\n  staticArticles.forEach((article) => {\n    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);\n    if (!managedByFirestore) mergedById.set(article.id, article);\n  });\n  firestoreArticles.forEach((article) => mergedById.set(article.id, article));\n  statusById.forEach((status, articleId) => {\n    if (status.status !== "published" || status.hidden === true || status.systemRecord === true) {\n      mergedById.delete(articleId);\n    }\n  });\n'''
)

# 4) Bust both loader levels so the browser cannot reuse the fallback code.
replace_once(
    "articles-v6.js",
    './articles-core-20260810-v6.js?v=20260812-2058-fallback-2',
    './articles-core-20260810-v6.js?v=20260812-2058-respect-draft-1'
)
replace_once(
    "articles.html",
    'articles-v6.js?v=20260812-confirm-fix-8',
    'articles-v6.js?v=20260812-2058-respect-draft-1'
)

print("2058 draft visibility repair applied")