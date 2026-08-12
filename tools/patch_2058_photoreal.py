from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps
import re

root = Path('.')
out = root / 'assets/articles/2058-future-person-prophecy'
out.mkdir(parents=True, exist_ok=True)
version = '20260812-2'

def make_editorial(src, dest, size=(1200, 800), brightness=0.86, contrast=1.12, saturation=0.80):
    im = Image.open(src).convert('RGB')
    im = ImageOps.fit(im, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    im = ImageEnhance.Brightness(im).enhance(brightness)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = ImageEnhance.Color(im).enhance(saturation)
    im.save(dest, 'WEBP', quality=88, method=6)
    return im

cover = make_editorial('/tmp/2058-src/cover.jpg', out / 'cover.webp', brightness=0.84, contrast=1.13, saturation=0.78)
make_editorial('/tmp/2058-src/verification.jpg', out / 'verification.webp', brightness=0.82, contrast=1.12, saturation=0.72)
make_editorial('/tmp/2058-src/consciousness.jpg', out / 'consciousness-network.webp', brightness=0.78, contrast=1.15, saturation=0.80)
thumb = ImageOps.fit(cover, (720, 480), method=Image.Resampling.LANCZOS, centering=(0.5, 0.48))
thumb.save(out / 'thumbnail.webp', 'WEBP', quality=86, method=6)

article_path = root / 'article-2058-future-person-prophecy.js'
text = article_path.read_text(encoding='utf-8')
swaps = [
    ('assets/articles/2058-future-person-prophecy/cover.svg?v=20260812-1', f'assets/articles/2058-future-person-prophecy/cover.webp?v={version}'),
    ('assets/articles/2058-future-person-prophecy/thumbnail.svg?v=20260812-1', f'assets/articles/2058-future-person-prophecy/thumbnail.webp?v={version}'),
    ('assets/articles/2058-future-person-prophecy/verification.svg?v=20260812-1', f'assets/articles/2058-future-person-prophecy/verification.webp?v={version}'),
    ('assets/articles/2058-future-person-prophecy/consciousness-network.svg?v=20260812-1', f'assets/articles/2058-future-person-prophecy/consciousness-network.webp?v={version}'),
]
for old, new in swaps:
    if old not in text:
        raise SystemExit(f'missing expected article path: {old}')
    text = text.replace(old, new)
if 'bookTitle: "喚醒天生好命"' not in text:
    anchor = '  readingLevel: "深度",\n'
    if anchor not in text:
        raise SystemExit('missing readingLevel anchor')
    fields = (
        '  bookTitle: "喚醒天生好命",\n'
        '  bookAuthor: "宇色Osel",\n'
        '  bookPublisher: "高寶",\n'
        '  bookPurchaseUrl: "https://www.books.com.tw/products/0011003625?loc=P_br_r0vq68ygz_D_2aabd0_B_1",\n'
    )
    text = text.replace(anchor, anchor + fields, 1)
article_path.write_text(text, encoding='utf-8')

static_path = root / 'static-articles.js'
text = static_path.read_text(encoding='utf-8')
text = text.replace(
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-1',
    './article-2058-future-person-prophecy.js?v=20260812-prophecy-2',
    1,
)
static_path.write_text(text, encoding='utf-8')

core_path = root / 'articles-core-20260810-v6.js'
text = core_path.read_text(encoding='utf-8')
thumb_entry = f'  "2058-future-person-prophecy": "assets/articles/2058-future-person-prophecy/thumbnail.webp?v={version}",\n'
thumb_anchor = 'const articleThumbnailImages = {\n'
if thumb_entry not in text:
    if thumb_anchor not in text:
        raise SystemExit('missing articleThumbnailImages anchor')
    text = text.replace(thumb_anchor, thumb_anchor + thumb_entry, 1)

override = f'''    if (article.id === "2058-future-person-prophecy") {{
      const fixedContent = String(article.content || "")
        .replace(/verification\\.svg(?:\\?[^)\\s"']*)?/g, "verification.webp?v={version}")
        .replace(/consciousness-network\\.svg(?:\\?[^)\\s"']*)?/g, "consciousness-network.webp?v={version}");
      return {{
        ...article,
        content: fixedContent,
        coverImage: "assets/articles/2058-future-person-prophecy/cover.webp?v={version}",
        thumbnailImage: "assets/articles/2058-future-person-prophecy/thumbnail.webp?v={version}",
        bookTitle: "喚醒天生好命",
        bookAuthor: "宇色Osel",
        bookPublisher: "高寶",
        bookPurchaseUrl: "https://www.books.com.tw/products/0011003625?loc=P_br_r0vq68ygz_D_2aabd0_B_1"
      }};
    }}
'''
normalized_pos = text.find('const normalizedArticles')
if normalized_pos < 0:
    raise SystemExit('missing normalizedArticles section')
if 'if (article.id === "2058-future-person-prophecy") {' not in text[normalized_pos:]:
    anchor = '    if (article.id === "celebrity-death-dream-spirit-five-checks") {'
    if anchor not in text:
        raise SystemExit('missing normalized insertion anchor')
    text = text.replace(anchor, override + anchor, 1)
core_path.write_text(text, encoding='utf-8')

html_path = root / 'article/2058-future-person-prophecy.html'
if html_path.exists():
    text = html_path.read_text(encoding='utf-8')
    pattern = r"assets/articles/2058-future-person-prophecy/cover\.svg(?:\?[^\"']*)?"
    text = re.sub(pattern, f'assets/articles/2058-future-person-prophecy/cover.webp?v={version}', text)
    html_path.write_text(text, encoding='utf-8')

for temp in [
    root / '.github/workflows/patch-2058-photoreal-images.yml',
    root / 'tools/patch_2058_photoreal.py',
]:
    if temp.exists():
        temp.unlink()
