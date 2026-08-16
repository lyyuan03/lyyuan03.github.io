from pathlib import Path
import base64
import hashlib
import re
import struct

ROOT = Path(".")
STAGED = ROOT / ".github/image-rebuild-temp/takaichi.b64"
POLITICIAN = ROOT / "assets/articles/2058-future-person-prophecy/takaichi-press-conference.webp"
TOC = ROOT / "article-2058-toc.js"
ARTICLE = ROOT / "article-2058-future-person-prophecy.js"
PAGE = ROOT / "articles.html"
WORKFLOW = ROOT / ".github/workflows/fix-2058-image-placement-20260816.yml"
SCRIPT = ROOT / ".github/fix_2058_images.py"

def decode_image():
    data = base64.b64decode(STAGED.read_text(encoding="utf-8").strip(), validate=True)
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise SystemExit("Invalid politician WebP payload")
    declared = struct.unpack("<I", data[4:8])[0] + 8
    if declared != len(data):
        raise SystemExit(f"Politician WebP size mismatch: declared={declared}, actual={len(data)}")
    POLITICIAN.parent.mkdir(parents=True, exist_ok=True)
    POLITICIAN.write_bytes(data)
    print("politician image", len(data), hashlib.sha256(data).hexdigest())

def patch_toc():
    text = TOC.read_text(encoding="utf-8")
    text, n = re.subn(
        r'const NETWORK_SRC = "[^"]+";',
        'const NETWORK_SRC = "/assets/articles/2058-future-person-prophecy/consciousness-network.webp?v=20260816-3";\n'
        'const POLITICIAN_SRC = "/assets/articles/2058-future-person-prophecy/takaichi-press-conference.webp?v=20260816-3";',
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit("Could not patch NETWORK_SRC")

    replacement = '''function removeExtraImageMatches(view, key, fragments) {
  const keep = view.querySelector(`p[data-article2058-image="${key}"]`);
  getParagraphs(view).forEach((paragraph) => {
    if (paragraph === keep) return;
    const images = paragraph.querySelectorAll(":scope > img");
    if (images.length !== 1 || cleanText(paragraph)) return;
    const imageSrc = images[0].getAttribute("src") || images[0].src || "";
    if (fragments.some((fragment) => imageSrc.includes(fragment))) paragraph.remove();
  });
}

function ensureImages(view) {
  removeBadFemaleImage(view);

  ensureImageAfter(
    view,
    "如果他的預言全部集中在政治與金融",
    "stadium",
    STADIUM_SRC,
    "日本職棒與足球冠軍賽現場",
    ["japanese-stadium-championship"]
  );
  removeExtraImageMatches(view, "stadium", ["japanese-stadium-championship"]);

  ensureImageAfter(
    view,
    "前六則有一個共同的弱點",
    "politician",
    POLITICIAN_SRC,
    "日本女性政治人物於記者會發表談話",
    ["takaichi-press-conference"]
  );
  removeExtraImageMatches(view, "politician", ["takaichi-press-conference"]);

  ensureImageAfter(
    view,
    "我在《喚醒天生好命》中談過一個概念",
    "network",
    NETWORK_SRC,
    "宇宙意識網與集體意識的連結",
    ["collective-consciousness-network", "consciousness-network"]
  );
  removeExtraImageMatches(view, "network", ["collective-consciousness-network", "consciousness-network"]);
}

function ensureToc'''
    pattern = r'function ensureImages\(view\) \{.*?\n\}\n\nfunction ensureToc'
    text, n = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Could not patch ensureImages()")
    TOC.write_text(text, encoding="utf-8")

def patch_article():
    text = ARTICLE.read_text(encoding="utf-8")
    text = re.sub(
        r'\n!\[\]\(assets/articles/2058-future-person-prophecy/collective-consciousness-network\.webp\?v=[^)]+\)\n',
        "\n",
        text,
    )
    text = re.sub(
        r'assets/articles/2058-future-person-prophecy/consciousness-network\.webp\?v=[^)]+',
        'assets/articles/2058-future-person-prophecy/consciousness-network.webp?v=20260816-3',
        text,
    )
    politician_md = '![](assets/articles/2058-future-person-prophecy/takaichi-press-conference.webp?v=20260816-3)'
    if politician_md not in text:
        marker = "只有年份，晚了整整一年。\n\n"
        if marker not in text:
            raise SystemExit("Could not find politician insertion point")
        text = text.replace(marker, marker + politician_md + "\n\n", 1)
    text = re.sub(
        r'updatedAt: "[^"]+"',
        'updatedAt: "2026-08-16T03:02:00.000Z"',
        text,
        count=1,
    )
    ARTICLE.write_text(text, encoding="utf-8")

def patch_page():
    text = PAGE.read_text(encoding="utf-8")
    text, n = re.subn(
        r"/article-2058-toc\.js\?v=[^\"']+",
        "/article-2058-toc.js?v=20260816-3",
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit("Could not bump article-2058-toc cache key")
    PAGE.write_text(text, encoding="utf-8")

def cleanup():
    STAGED.unlink(missing_ok=True)
    WORKFLOW.unlink(missing_ok=True)
    SCRIPT.unlink(missing_ok=True)

decode_image()
patch_toc()
patch_article()
patch_page()
cleanup()
