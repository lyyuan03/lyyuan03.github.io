import hashlib
import io
import os
import re
import urllib.parse
import uuid
from pathlib import Path

import requests
from PIL import Image
from google.cloud import firestore, storage

PROJECT_ID = os.environ.get("PROJECT_ID", "lyyuan03-membership")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "lyyuan03-membership.firebasestorage.app")
ARTICLE_ID = os.environ.get("ARTICLE_ID", "channeling-ability-secrets-draft")
SETTINGS_ID = "__article-thumbnail-settings"
PAID_MARKER = "<!-- paid-only -->"
IMAGE_DIR = Path("assets/articles/channeling-ability-secrets-draft")
REVISION = "chatgpt-inline-images-20260905-v1"

FILES = [
    ("01-amplified-ability.jpg", "通靈放大既有能力的象徵圖"),
    ("02-ability-heart-cultivation.jpg", "能力、心性與修行的象徵圖"),
    ("03-levels-of-spirit.jpg", "不同靈性層次的象徵圖"),
    ("04-desire-and-gain.jpg", "欲望、利益與選擇的象徵圖"),
    ("05-accuracy-vs-level.jpg", "準確與層次不可混為一談的象徵圖"),
    ("06-return-to-heart.jpg", "高層次靈性回到內在心性的象徵圖"),
]

PRIVATE_ANCHORS = [
    "## 第二個秘密｜能力、心性、修行，本來就是三個不同層次",
    "## 第三個秘密｜通靈與「所通的靈」是綁在一起的",
    "## 第四個秘密｜樂透、股票、賭博，最容易照出人的欲望",
    "## 第五個秘密｜「準」和「層次高」，一定要分開",
    "## 第六個秘密｜高層次的靈性，最後都會把人帶回自己",
]

POSITIONS = [(50,50,100),(50,48,100),(58,48,100),(65,50,100),(40,50,100),(50,50,100)]


def firebase_url(path, token):
    encoded = urllib.parse.quote(path, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o/{encoded}?alt=media&token={token}"


def remove_image_urls(text, urls):
    result = str(text or "")
    for url in sorted(set(filter(None, urls)), key=len, reverse=True):
        pattern = r"\n*!\[[^\]]*\]\(" + re.escape(url) + r"\)\n*"
        result = re.sub(pattern, "\n\n", result)
    return re.sub(r"\n{3,}", "\n\n", result).strip()


def image_markdown(alt, url):
    return f"![{alt}]({url})"


def upload_and_verify():
    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(BUCKET_NAME)
    urls = []
    for filename, _ in FILES:
        local = IMAGE_DIR / filename
        if not local.exists():
            raise RuntimeError(f"missing generated image: {local}")
        with Image.open(local) as im:
            if im.size != (1600, 900) or im.format != "JPEG":
                raise RuntimeError(f"invalid image format/dimensions: {filename} {im.format} {im.size}")
        object_path = f"articles/{ARTICLE_ID}/chatgpt/{filename}"
        token = str(uuid.uuid4())
        blob = bucket.blob(object_path)
        blob.cache_control = "public,max-age=31536000,immutable"
        blob.metadata = {
            "firebaseStorageDownloadTokens": token,
            "articleId": ARTICLE_ID,
            "usage": "article-inline-image",
            "generatedBy": "ChatGPT",
            "revision": REVISION,
        }
        blob.upload_from_filename(str(local), content_type="image/jpeg")
        blob.patch()
        url = firebase_url(object_path, token)
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f"uploaded image not readable: {filename} HTTP {response.status_code}")
        with Image.open(io.BytesIO(response.content)) as remote:
            if remote.size != (1600, 900):
                raise RuntimeError(f"remote image dimensions invalid: {filename} {remote.size}")
        urls.append(url)
        print(f"verified image: {filename} 1600x900 HTTP 200")
    return urls


def sync_firestore(urls):
    db = firestore.Client(project=PROJECT_ID)
    article_ref = db.collection("articles").document(ARTICLE_ID)
    private_ref = db.collection("paidArticleBodies").document(ARTICLE_ID)
    settings_ref = db.collection("articles").document(SETTINGS_ID)
    transaction = db.transaction()

    @firestore.transactional
    def apply(transaction):
        article_snap = article_ref.get(transaction=transaction)
        private_snap = private_ref.get(transaction=transaction)
        settings_snap = settings_ref.get(transaction=transaction)
        if not article_snap.exists:
            raise RuntimeError("article Firestore document missing")
        if not private_snap.exists:
            raise RuntimeError("paidArticleBodies Firestore document missing")

        article = article_snap.to_dict() or {}
        paid = private_snap.to_dict() or {}
        settings = settings_snap.to_dict() if settings_snap.exists else {}
        settings = settings or {}

        if article.get("status") != "draft" or article.get("accessType") != "paid":
            raise RuntimeError(f"unexpected article state: status={article.get('status')} accessType={article.get('accessType')}")
        public_safe = str(article.get("content") or "")
        if PAID_MARKER not in public_safe:
            raise RuntimeError("public paid marker missing")
        if public_safe.split(PAID_MARKER, 1)[1].strip():
            raise RuntimeError("private body unexpectedly present in public article document")
        private_body = str(paid.get("content") or "").strip()
        if not private_body:
            raise RuntimeError("private paid body is empty")

        old_inline = dict(settings.get("inlineImageSettings") or {})
        old_record = old_inline.get(ARTICLE_ID) or {}
        old_urls = [str(item.get("src") or "") for item in (old_record.get("images") or []) if isinstance(item, dict)]
        cleanup_urls = old_urls + urls

        public_preview = public_safe.split(PAID_MARKER, 1)[0].strip()
        public_preview = remove_image_urls(public_preview, cleanup_urls)
        public_content = f"{public_preview}\n\n{image_markdown(FILES[0][1], urls[0])}\n\n{PAID_MARKER}".strip()

        next_private = remove_image_urls(private_body, cleanup_urls)
        for index, anchor in enumerate(PRIVATE_ANCHORS, start=1):
            if anchor not in next_private:
                raise RuntimeError(f"private insertion anchor missing: {anchor}")
            next_private = next_private.replace(anchor, f"{anchor}\n\n{image_markdown(FILES[index][1], urls[index])}", 1)

        private_hash = hashlib.sha256(next_private.encode("utf-8")).hexdigest()
        previous_hash = str(paid.get("contentHash") or "")
        previous_version = max(int(paid.get("contentVersion") or 0), int(article.get("paidContentVersion") or 0))
        changed = next_private != private_body or private_hash != previous_hash
        version = previous_version + 1 if changed else max(1, previous_version)

        inline_images = []
        for (filename, alt), url, (x,y,scale) in zip(FILES, urls, POSITIONS):
            inline_images.append({"src": url, "alt": alt, "positionX": x, "positionY": y, "scale": scale})
        old_inline[ARTICLE_ID] = {
            "version": 1,
            "ratio": "16:9",
            "fit": "cover",
            "maxImages": 6,
            "images": inline_images,
            "source": REVISION,
        }

        private_update = {
            "articleId": ARTICLE_ID,
            "title": article.get("title") or paid.get("title") or "",
            "status": "draft",
            "content": next_private,
            "contentHash": private_hash,
            "contentVersion": version,
            "active": True,
            "mediaSyncRevision": REVISION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        if changed:
            private_update["previousContentBackup"] = private_body
            private_update["previousContentVersionBackup"] = previous_version
            private_update["previousBackupAt"] = firestore.SERVER_TIMESTAMP

        transaction.set(private_ref, private_update, merge=True)
        transaction.set(article_ref, {
            "content": public_content,
            "status": "draft",
            "accessType": "paid",
            "privatePaidContent": True,
            "paidContentHash": private_hash,
            "paidContentVersion": version,
            "inlineImageSyncRevision": REVISION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        transaction.set(settings_ref, {
            "inlineImageSettings": old_inline,
            "inlineImageSettingsUpdatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return version, private_hash

    version, private_hash = apply(transaction)

    article = article_ref.get().to_dict() or {}
    paid = private_ref.get().to_dict() or {}
    settings = settings_ref.get().to_dict() or {}
    record = (settings.get("inlineImageSettings") or {}).get(ARTICLE_ID) or {}
    images = record.get("images") or []

    if article.get("status") != "draft" or article.get("accessType") != "paid" or article.get("privatePaidContent") is not True:
        raise RuntimeError("final article access verification failed")
    public_safe = str(article.get("content") or "")
    if PAID_MARKER not in public_safe or public_safe.split(PAID_MARKER,1)[1].strip():
        raise RuntimeError("final public/private split verification failed")
    if str(article.get("paidContentHash") or "") != private_hash:
        raise RuntimeError("article paid hash verification failed")
    if str(paid.get("contentHash") or "") != private_hash or int(paid.get("contentVersion") or 0) != version:
        raise RuntimeError("private body hash/version verification failed")
    if len(images) != 6 or [item.get("src") for item in images] != urls:
        raise RuntimeError("inline image settings verification failed")

    combined = f"{public_safe}\n\n{str(paid.get('content') or '')}"
    detected = re.findall(r"!\[[^\]]*\]\((https://firebasestorage\.googleapis\.com/[^)]+)\)", combined)
    managed = [url for url in detected if f"articles%2F{ARTICLE_ID}%2Fchatgpt%2F" in url]
    if managed != urls:
        raise RuntimeError(f"article image markdown verification failed: expected 6 in order, got {len(managed)}")
    if PAID_MARKER in str(paid.get("content") or ""):
        raise RuntimeError("private body contains paid marker")

    print(f"Firestore verified: draft paid article, 6/6 inline images, paidContentVersion={version}, hash={private_hash}")


if __name__ == "__main__":
    urls = upload_and_verify()
    sync_firestore(urls)
