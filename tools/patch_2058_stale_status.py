from pathlib import Path

core = Path('articles-core-20260810-v6.js')
text = core.read_text(encoding='utf-8')
old = '''    const indexedStatus = statusById.get(article.id);
    const allow2058PublishedFallback = article.id === "2058-future-person-prophecy"
      && !firestorePublishedIds.has(article.id)
      && indexedStatus?.status !== "draft"
      && indexedStatus?.hidden !== true
      && indexedStatus?.systemRecord !== true;
'''
new = '''    const allow2058PublishedFallback = article.id === "2058-future-person-prophecy"
      && !firestorePublishedIds.has(article.id);
'''
if old not in text:
    raise SystemExit('fallback condition not found')
text = text.replace(old, new, 1)
old2 = '''  statusById.forEach((status, articleId) => {
    if (status.status !== "published" || status.hidden === true || status.systemRecord === true) {
      mergedById.delete(articleId);
    }
  });'''
new2 = '''  statusById.forEach((status, articleId) => {
    const keep2058StaticFallback = articleId === "2058-future-person-prophecy"
      && !firestorePublishedIds.has(articleId);
    if (!keep2058StaticFallback && (status.status !== "published" || status.hidden === true || status.systemRecord === true)) {
      mergedById.delete(articleId);
    }
  });'''
if old2 not in text:
    raise SystemExit('status deletion block not found')
text = text.replace(old2, new2, 1)
core.write_text(text, encoding='utf-8')

loader = Path('articles-v6.js')
text = loader.read_text(encoding='utf-8')
text = text.replace('articles-core-20260810-v6.js?v=20260812-2058-fallback-1','articles-core-20260810-v6.js?v=20260812-2058-fallback-2',1)
loader.write_text(text, encoding='utf-8')

for p in [Path('tools/patch_2058_stale_status.py'), Path('.github/workflows/patch-2058-stale-status.yml')]:
    if p.exists(): p.unlink()
