from pathlib import Path
import re

VERSION = "20260813-manual-image-markdown-3"

inline_path = Path("article-inline-image-admin.js")
inline = inline_path.read_text()
inline, count_map = re.subn(
    r'const KNOWN_ARTICLE_IMAGE_REPAIRS = \{.*?\n\};\n\n',
    '',
    inline,
    count=1,
    flags=re.S,
)
inline, count_fn = re.subn(
    r'function repairKnownArticleImages\(content = "", id = ""\) \{.*?\n\}\n\n(?=function syncImages)',
    '',
    inline,
    count=1,
    flags=re.S,
)
if count_map != 1 or count_fn != 1:
    raise SystemExit(f"inline repair removal failed: map={count_map}, fn={count_fn}")
if "KNOWN_ARTICLE_IMAGE_REPAIRS" in inline or "repairKnownArticleImages" in inline:
    raise SystemExit("inline automatic repair code still remains")
inline_path.write_text(inline)

core_path = Path("article-admin-core.js")
core = core_path.read_text()
core, count_sync = re.subn(
    r'function syncKnownInlineImagePaths\(articleId, content = ""\) \{.*?\n\}\n\n(?=async function syncRevisedStaticArticleImages)',
    '',
    core,
    count=1,
    flags=re.S,
)
if count_sync != 1:
    raise SystemExit(f"syncKnownInlineImagePaths removal failed: {count_sync}")

old_image_logic = '''    const desiredThumbnailImage = article.thumbnailImage || "";
    const currentContent = current.content || "";
    const desiredContent = syncKnownInlineImagePaths(articleId, currentContent);
    const contentChanged = desiredContent !== currentContent;
    if (
      current.staticImageSyncRevision === revision
      && (current.coverImage || "") === desiredCoverImage
      && (current.thumbnailImage || "") === desiredThumbnailImage
      && !contentChanged
    ) continue;'''
new_image_logic = '''    const desiredThumbnailImage = article.thumbnailImage || "";
    if (
      current.staticImageSyncRevision === revision
      && (current.coverImage || "") === desiredCoverImage
      && (current.thumbnailImage || "") === desiredThumbnailImage
    ) continue;'''
if old_image_logic not in core:
    raise SystemExit("static image sync content rewrite block not found")
core = core.replace(old_image_logic, new_image_logic, 1)
core = core.replace('    if (contentChanged) payload.content = desiredContent;\n', '', 1)

old_merge = '''          coverImage: staticArticle.coverImage || article.coverImage || "",
          thumbnailImage: staticArticle.thumbnailImage || article.thumbnailImage || "",
          content: syncKnownInlineImagePaths(article.id, article.content || "")'''
new_merge = '''          coverImage: staticArticle.coverImage || article.coverImage || "",
          thumbnailImage: staticArticle.thumbnailImage || article.thumbnailImage || ""'''
if old_merge not in core:
    raise SystemExit("mergedArticles content rewrite block not found")
core = core.replace(old_merge, new_merge, 1)

for forbidden in ("syncKnownInlineImagePaths", "desiredContent", "contentChanged"):
    if forbidden in core:
        raise SystemExit(f"article-admin-core still contains {forbidden}")

core = re.sub(r'(from "\./firebase-config\.js\?v=)[^"]+(";)', rf'\g<1>{VERSION}\2', core, count=1)
core = re.sub(r'(from "\./static-articles\.js\?v=)[^"]+(";)', rf'\g<1>{VERSION}\2', core, count=1)
core_path.write_text(core)

admin_js_path = Path("article-admin.js")
admin_js = admin_js_path.read_text()
admin_js = re.sub(r'(import "\./article-admin-core\.js\?v=)[^"]+(";)', rf'\g<1>{VERSION}\2', admin_js, count=1)
admin_js = re.sub(r'(from "\./firebase-config\.js\?v=)[^"]+(";)', rf'\g<1>{VERSION}\2', admin_js, count=1)
admin_js_path.write_text(admin_js)

firebase_path = Path("firebase-config.js")
firebase = firebase_path.read_text()
firebase = re.sub(r'(import\("\./article-inline-image-admin\.js\?v=)[^"]+("\);)', rf'\g<1>{VERSION}\2', firebase, count=1)
firebase_path.write_text(firebase)

admin_html_path = Path("admin.html")
admin_html = admin_html_path.read_text()
admin_html = re.sub(r'(src="article-admin\.js\?v=)[^"]+("\>)', rf'\g<1>{VERSION}\2', admin_html, count=1)
admin_html_path.write_text(admin_html)

print("Image Markdown editing fix applied successfully")
