from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageOps

SOURCE = "https://lyyuan.tw/assets/articles/channeling-ability-secrets-draft/00-photo-first.jpg?v=source-20260905"
OUT = Path("assets/articles/channeling-ability-secrets-draft/00-photo-first.jpg")

r = requests.get(SOURCE, timeout=30, headers={"Cache-Control": "no-cache"})
r.raise_for_status()

img = Image.open(BytesIO(r.content))
img.load()
img = ImageOps.exif_transpose(img).convert("RGB")
img = ImageOps.fit(img, (1600, 900), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(
    OUT,
    format="JPEG",
    quality=86,
    progressive=False,
    optimize=False,
    subsampling=2,
    dpi=(72, 72),
)

with Image.open(OUT) as check:
    check.load()
    if check.format != "JPEG" or check.size != (1600, 900) or check.mode != "RGB":
        raise RuntimeError(f"unexpected output: {check.format} {check.size} {check.mode}")

raw = OUT.read_bytes()
if not (raw.startswith(b"\xff\xd8") and raw.endswith(b"\xff\xd9")):
    raise RuntimeError("JPEG markers invalid")

print(f"REENCODE_OK path={OUT} bytes={len(raw)} size=1600x900 mode=RGB progressive=false")
