#!/usr/bin/env python3
"""Mirror author-provided Guanyin images to the permanent first-party article assets."""
from pathlib import Path
from PIL import Image
from urllib.request import Request, urlopen
from io import BytesIO
import hashlib

ARTICLE = "2026-guanyin-renunciation-suffering"
DEST = Path("assets/articles") / ARTICLE
HOST = "https://d2ol7oe51mr4n9.cloudfront.net"
ACCOUNT = "user_3CC8OMVTj8bkUz71eKrO5BtBL9Y"

SOURCE_IMAGES = {
    "01-guanyin.webp": "3cae01c8-d223-40f3-adde-0add31aead30.png",
    "02-guanyin.webp": "6508ff73-a9be-4e1d-8f4d-3e8a3566f3bd.png",
    "03-guanyin.webp": "412897c4-d7d7-4bdd-9497-5fdccabb96a8.png",
    "04-guanyin.webp": "7a6d7369-c581-4365-8f1e-3aa9c6e1f568.png",
    "05-guanyin.webp": "eb72eb86-f869-4e7c-a8d8-48e93644e0b0.png",
    "06-guanyin.webp": "88e726b5-ad92-47f7-ac78-aa1d3c36a09c.png",
}
COVER_SOURCE = "595336f0-9cf1-43f5-8878-29edb47695dd.png"

def get_png(file):
    url = HOST + "/" + ACCOUNT + "/" + file
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (Guanyin publication asset migration)"})
    with urlopen(request, timeout=45) as response:
        payload = response.read()
    if not payload.startswith(b"\x89PNG\r\n\x1a\n") or len(payload) < 100_000:
        raise RuntimeError("Image source invalid: " + file)
    image = Image.open(BytesIO(payload)).convert("RGB")
    if image.width < 1200 or image.height < 650:
        raise RuntimeError("Image resolution invalid: " + file)
    return image

def save_webp(image, name, width, quality):
    height = round(image.height * width / image.width)
    target = DEST / name
    image.resize((width, height), Image.Resampling.LANCZOS).save(
        target, "WEBP", quality=quality, method=6
    )
    print(name, target.stat().st_size, hashlib.sha256(target.read_bytes()).hexdigest())

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for name, source in SOURCE_IMAGES.items():
        save_webp(get_png(source), name, 780, 42)
    cover = get_png(COVER_SOURCE)
    save_webp(cover, "cover.webp", 1000, 48)
    width, height = cover.size
    crop_width = int(width * 9 / 16)
    left = min(int(width * .44), width - crop_width)
    portrait = cover.crop((left, 0, left + crop_width, height))
    portrait.resize((468, 832), Image.Resampling.LANCZOS).save(
        DEST / "thumbnail-9x16.webp", "WEBP", quality=56, method=6
    )
    if len(list(DEST.glob("*.webp"))) != 8:
        raise RuntimeError("Expected 6 body images + cover + thumbnail")
    print("Guanyin 8 first-party website assets prepared")

if __name__ == "__main__":
    main()
