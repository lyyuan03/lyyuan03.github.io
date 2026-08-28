from __future__ import annotations

from pathlib import Path
import re

import cv2
import numpy as np
import pytesseract
from PIL import Image

ROOT = Path("assets/articles/yuanqin-debt-heart")
FILES = [
    "01-cover-yuanqin.webp",
    "02-night-argument.webp",
    "03-name-ritual.webp",
    "04-freedom-release.webp",
    "05-family-grievance.webp",
    "06-release-grip.webp",
]

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fffA-Za-z0-9]")


def valid_text(text: str) -> bool:
    text = text.strip()
    return bool(text and CJK_RE.search(text))


def ocr_boxes(img_bgr: np.ndarray):
    h, w = img_bgr.shape[:2]
    scale = 2.0
    up = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants = [
        cv2.cvtColor(up, cv2.COLOR_BGR2RGB),
        clahe,
        otsu,
        255 - otsu,
    ]

    found = []
    for variant in variants:
        data = pytesseract.image_to_data(
            variant,
            lang="chi_tra+eng",
            config="--oem 1 --psm 11",
            output_type=pytesseract.Output.DICT,
        )
        for i, raw in enumerate(data.get("text", [])):
            text = (raw or "").strip()
            try:
                conf = float(data["conf"][i])
            except Exception:
                conf = -1
            if conf < 18 or not valid_text(text):
                continue
            x = int(data["left"][i] / scale)
            y = int(data["top"][i] / scale)
            bw = max(1, int(data["width"][i] / scale))
            bh = max(1, int(data["height"][i] / scale))
            if bw * bh < 18:
                continue
            # Ignore implausibly huge OCR regions.
            if bw > w * 0.96 and bh > h * 0.55:
                continue
            found.append((x, y, bw, bh, text, conf))

    # De-duplicate overlapping OCR results from preprocessing variants.
    unique = []
    for box in sorted(found, key=lambda b: b[5], reverse=True):
        x, y, bw, bh, text, conf = box
        x2, y2 = x + bw, y + bh
        duplicate = False
        for ux, uy, ubw, ubh, _, _ in unique:
            ux2, uy2 = ux + ubw, uy + ubh
            ix1, iy1 = max(x, ux), max(y, uy)
            ix2, iy2 = min(x2, ux2), min(y2, uy2)
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            area = min(bw * bh, ubw * ubh)
            if area and inter / area > 0.62:
                duplicate = True
                break
        if not duplicate:
            unique.append(box)
    return unique


def text_mask(img_bgr: np.ndarray, boxes):
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h, w), dtype=np.uint8)

    for x, y, bw, bh, text, conf in boxes:
        pad_x = max(5, int(bh * 0.42))
        pad_y = max(4, int(bh * 0.30))
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + bw + pad_x)
        y2 = min(h, y + bh + pad_y)
        roi = gray[y1:y2, x1:x2]
        if roi.size == 0:
            continue

        # Select high local-contrast strokes inside OCR boxes rather than
        # erasing the entire rectangle, preserving the illustration.
        k = max(5, min(31, (min(roi.shape[:2]) // 3) | 1))
        if k % 2 == 0:
            k += 1
        local = cv2.medianBlur(roi, k)
        diff = cv2.absdiff(roi, local)
        contrast = (diff > 17).astype(np.uint8) * 255

        edges = cv2.Canny(roi, 45, 130)
        strokes = cv2.bitwise_or(contrast, edges)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        strokes = cv2.dilate(strokes, kernel, iterations=2)

        # Keep a padded central band around the recognized text box.
        band = np.zeros_like(strokes)
        bx1 = max(0, x - x1 - 3)
        by1 = max(0, y - y1 - 3)
        bx2 = min(strokes.shape[1], x + bw - x1 + 3)
        by2 = min(strokes.shape[0], y + bh - y1 + 3)
        band[by1:by2, bx1:bx2] = 255
        band = cv2.dilate(band, kernel, iterations=2)
        strokes = cv2.bitwise_and(strokes, band)

        mask[y1:y2, x1:x2] = cv2.bitwise_or(mask[y1:y2, x1:x2], strokes)

    # Feather around anti-aliased text outlines.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.dilate(mask, kernel, iterations=1)
    return mask


def clean_one(path: Path):
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Cannot read {path}")

    before = ocr_boxes(img)
    current = img.copy()
    all_detected = list(before)

    # Two cleanup passes catch shadowed / outlined text revealed after pass one.
    for _ in range(2):
        boxes = ocr_boxes(current)
        if not boxes:
            break
        mask = text_mask(current, boxes)
        if cv2.countNonZero(mask) == 0:
            break
        current = cv2.inpaint(current, mask, 5, cv2.INPAINT_TELEA)

    after = ocr_boxes(current)

    # Preserve dimensions; overwrite the WebP at high quality.
    rgb = cv2.cvtColor(current, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, "WEBP", quality=94, method=6)

    print(f"IMAGE {path.name}")
    print("  before:", " | ".join(b[4] for b in before) or "(no OCR text)")
    print("  after :", " | ".join(b[4] for b in after) or "(no OCR text)")
    print(f"  boxes : {len(before)} -> {len(after)}")


def update_article_files():
    p = Path("article-yuanqin-debt-heart.js")
    s = p.read_text(encoding="utf-8")
    s = s.replace('status: "draft"', 'status: "published"')
    if 'publishedAt:' not in s:
        s = s.replace(
            'status: "published",\n',
            'status: "published",\n  publishedAt: "2026-08-28T11:05:00.000Z",\n',
            1,
        )
    s = re.sub(r'\?v=20260828-6', '?v=20260828-clean-text-1', s)
    p.write_text(s, encoding="utf-8")

    replacements = {
        "static-articles.js": [
            ("20260828-final-article-images-7", "20260828-clean-text-1"),
        ],
        "articles-core-20260810-v6.js": [
            ("20260828-yuanqin-final-article-images-7", "20260828-yuanqin-clean-text-1"),
            ("assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-4",
             "assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-clean-text-1"),
        ],
        "article-thumbnail-display-v2.js": [
            ("20260828-yuanqin-six-images-1", "20260828-yuanqin-clean-text-1"),
            ("assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-4",
             "assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-clean-text-1"),
        ],
        "article-admin-draft-preview.js": [
            ("20260828-yuanqin-final-article-images-7", "20260828-yuanqin-clean-text-1"),
        ],
    }
    for filename, pairs in replacements.items():
        q = Path(filename)
        t = q.read_text(encoding="utf-8")
        for old, new in pairs:
            t = t.replace(old, new)
        q.write_text(t, encoding="utf-8")


if __name__ == "__main__":
    for name in FILES:
        clean_one(ROOT / name)
    update_article_files()
