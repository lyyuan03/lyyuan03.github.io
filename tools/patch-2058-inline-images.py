from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]}')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')

# Force fresh static article module and new sync revision.
replace_once('article-admin-core.js',
    'import { staticArticles } from "./static-articles.js?v=20260812-2058-image-sync-1";',
    'import { staticArticles } from "./static-articles.js?v=20260812-2058-inline-image-sync-1";')
replace_once('article-admin-core.js',
    '["2058-future-person-prophecy", "20260812-2058-image-sync-1"]',
    '["2058-future-person-prophecy", "20260812-2058-image-sync-2"]')

old = '''async function syncRevisedStaticArticleImages(snapshot) {\n  const firestoreById = new Map(snapshot.docs.map((item) => [item.id, item.data()]));\n  let didSync = false;\n  for (const [articleId, revision] of staticImageSyncRevisions) {\n    const current = firestoreById.get(articleId);\n    const article = staticArticles.find((item) => item.id === articleId);\n    if (!current || !article) continue;\n    const desiredCoverImage = article.coverImage || "";\n    const desiredThumbnailImage = article.thumbnailImage || "";\n    if (\n      current.staticImageSyncRevision === revision\n      && (current.coverImage || "") === desiredCoverImage\n      && (current.thumbnailImage || "") === desiredThumbnailImage\n    ) continue;\n    await setDoc(doc(db, "articles", articleId), {\n      coverImage: desiredCoverImage,\n      thumbnailImage: desiredThumbnailImage,\n      staticImageSyncRevision: revision,\n      staticImageSourceUpdatedAt: article.updatedAt || "",\n      updatedAt: serverTimestamp()\n    }, { merge: true });\n    didSync = true;\n  }\n  return didSync;\n}\n'''
new = '''function syncKnownInlineImagePaths(articleId, content = "") {\n  if (articleId !== "2058-future-person-prophecy") return String(content || "");\n  return String(content || "")\n    .replace(/assets\\/articles\\/2058-future-person-prophecy\\/verification\\.svg(?:\\?v=[^)\\s]+)?/g, "assets/articles/2058-future-person-prophecy/verification.webp?v=20260812-2")\n    .replace(/assets\\/articles\\/2058-future-person-prophecy\\/consciousness-network\\.svg(?:\\?v=[^)\\s]+)?/g, "assets/articles/2058-future-person-prophecy/consciousness-network.webp?v=20260812-2");\n}\n\nasync function syncRevisedStaticArticleImages(snapshot) {\n  const firestoreById = new Map(snapshot.docs.map((item) => [item.id, item.data()]));\n  let didSync = false;\n  for (const [articleId, revision] of staticImageSyncRevisions) {\n    const current = firestoreById.get(articleId);\n    const article = staticArticles.find((item) => item.id === articleId);\n    if (!current || !article) continue;\n    const desiredCoverImage = article.coverImage || "";\n    const desiredThumbnailImage = article.thumbnailImage || "";\n    const currentContent = current.content || "";\n    const desiredContent = syncKnownInlineImagePaths(articleId, currentContent);\n    const contentChanged = desiredContent !== currentContent;\n    if (\n      current.staticImageSyncRevision === revision\n      && (current.coverImage || "") === desiredCoverImage\n      && (current.thumbnailImage || "") === desiredThumbnailImage\n      && !contentChanged\n    ) continue;\n    const payload = {\n      coverImage: desiredCoverImage,\n      thumbnailImage: desiredThumbnailImage,\n      staticImageSyncRevision: revision,\n      staticImageSourceUpdatedAt: article.updatedAt || "",\n      updatedAt: serverTimestamp()\n    };\n    if (contentChanged) payload.content = desiredContent;\n    await setDoc(doc(db, "articles", articleId), payload, { merge: true });\n    didSync = true;\n  }\n  return didSync;\n}\n'''
replace_once('article-admin-core.js', old, new)

replace_once('article-admin-core.js',
'''          coverImage: staticArticle.coverImage || article.coverImage || "",\n          thumbnailImage: staticArticle.thumbnailImage || article.thumbnailImage || ""\n''',
'''          coverImage: staticArticle.coverImage || article.coverImage || "",\n          thumbnailImage: staticArticle.thumbnailImage || article.thumbnailImage || "",\n          content: syncKnownInlineImagePaths(article.id, article.content || "")\n''')

# Make the inline-image panel repair the two known stale SVG references immediately.
replace_once('article-inline-image-admin.js',
'''const KNOWN_ARTICLE_IMAGE_REPAIRS = {\n  "yuanshen-destiny-archetype": [\n''',
'''const KNOWN_ARTICLE_IMAGE_REPAIRS = {\n  "2058-future-person-prophecy": [\n    { alt: "當預言只剩下命中的版本，真正要辨識的是我們看見了什麼、又漏掉了什麼", src: "assets/articles/2058-future-person-prophecy/verification.webp?v=20260812-2" },\n    { alt: "未來不是單一路線，而是選擇與集體意識交織出的可能性", src: "assets/articles/2058-future-person-prophecy/consciousness-network.webp?v=20260812-2" }\n  ],\n  "yuanshen-destiny-archetype": [\n''')

# Bust every relevant nested module cache.
replace_once('static-articles.js',
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-2',
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-3')
replace_once('firebase-config.js',
    './article-inline-image-admin.js?v=20260807-inline-image-manager-1',
    './article-inline-image-admin.js?v=20260812-2058-inline-image-sync-1')
replace_once('article-admin.js',
    'import "./article-admin-core.js?v=20260812-article-notify-1";',
    'import "./article-admin-core.js?v=20260812-2058-inline-image-sync-1";')
replace_once('article-admin.js',
    'import { app } from "./firebase-config.js";',
    'import { app } from "./firebase-config.js?v=20260812-2058-inline-image-sync-1";')
replace_once('article-admin-core.js',
    'import { auth, db, provider, storage, isAdminEmail } from "./firebase-config.js";',
    'import { auth, db, provider, storage, isAdminEmail } from "./firebase-config.js?v=20260812-2058-inline-image-sync-1";')
replace_once('admin.html',
    'article-admin.js?v=20260807-hide-sponsor-quota-1',
    'article-admin.js?v=20260812-2058-inline-image-sync-1')

print('2058 inline image repair patched successfully')
