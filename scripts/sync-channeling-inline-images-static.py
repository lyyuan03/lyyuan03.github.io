import hashlib
import io
import re
from copy import deepcopy

import requests
from PIL import Image
from google.cloud import firestore

PROJECT_ID = "lyyuan03-membership"
ARTICLE_ID = "channeling-ability-secrets-draft"
SETTINGS_ID = "__article-thumbnail-settings"
PAID_MARKER = "<!-- paid-only -->"
BASE = "https://lyyuan.tw/assets/articles/channeling-ability-secrets-draft"
REVISION = "chatgpt-inline-images-static-20260905-v1"

FILES = [
    ("01-amplified-ability.jpg", "通靈放大既有能力的象徵圖"),
    ("02-ability-heart-cultivation.jpg", "能力、心性與修行的象徵圖"),
    ("03-levels-of-spirit.jpg", "不同靈性層次的象徵圖"),
    ("04-desire-and-gain.jpg", "欲望、利益與選擇的象徵圖"),
    ("05-accuracy-vs-level.jpg", "準確與層次不可混為一談的象徵圖"),
    ("06-return-to-heart.jpg", "高層次靈性回到內在心性的象徵圖"),
]
URLS = [f"{BASE}/{name}" for name, _ in FILES]
POSITIONS = [(50,50,100),(50,48,100),(58,48,100),(65,50,100),(40,50,100),(50,50,100)]
PRIVATE_ANCHORS = [
    "## 第二個秘密｜能力、心性、修行，本來就是三個不同層次",
    "## 第三個秘密｜通靈與「所通的靈」是綁在一起的",
    "## 第四個秘密｜樂透、股票、賭博，最容易照出人的欲望",
    "## 第五個秘密｜「準」和「層次高」，一定要分開",
    "## 第六個秘密｜高層次的靈性，最後都會把人帶回自己",
]


def verify_urls():
    for url in URLS:
        response = requests.get(url, timeout=30, headers={"Cache-Control":"no-cache"})
        if response.status_code != 200:
            raise RuntimeError(f"image URL not live: {url} HTTP {response.status_code}")
        with Image.open(io.BytesIO(response.content)) as im:
            if im.size != (1600, 900) or im.format != "JPEG":
                raise RuntimeError(f"invalid live image: {url} {im.format} {im.size}")
        print(f"live image verified: {url} 1600x900 JPEG")


def managed_url(url):
    value = str(url or "")
    return (
        "/assets/articles/channeling-ability-secrets-draft/" in value
        or "articles%2Fchanneling-ability-secrets-draft%2F" in value
        or "articles/channeling-ability-secrets-draft/" in value
    )


def strip_managed_images(text):
    source = str(text or "")
    pattern = re.compile(r"\n*!\[[^\]]*\]\(([^)]+)\)\n*")
    source = pattern.sub(lambda m: "\n\n" if managed_url(m.group(1)) else m.group(0), source)
    return re.sub(r"\n{3,}", "\n\n", source).strip()


def md(index):
    return f"![{FILES[index][1]}]({URLS[index]})"


def image_urls(text):
    return re.findall(r"!\[[^\]]*\]\((https?://[^)]+)\)", str(text or ""))


def sync_firestore():
    db = firestore.Client(project=PROJECT_ID)
    article_ref = db.collection("articles").document(ARTICLE_ID)
    private_ref = db.collection("paidArticleBodies").document(ARTICLE_ID)
    settings_ref = db.collection("articles").document(SETTINGS_ID)
    transaction = db.transaction()

    @firestore.transactional
    def apply(txn):
        article_snap = article_ref.get(transaction=txn)
        private_snap = private_ref.get(transaction=txn)
        settings_snap = settings_ref.get(transaction=txn)
        if not article_snap.exists:
            raise RuntimeError("article document missing")
        if not private_snap.exists:
            raise RuntimeError("paidArticleBodies document missing")

        article = article_snap.to_dict() or {}
        paid = private_snap.to_dict() or {}
        settings = settings_snap.to_dict() if settings_snap.exists else {}
        settings = settings or {}

        if article.get("status") != "draft":
            raise RuntimeError(f"refusing to modify non-draft article: {article.get('status')}")
        if article.get("accessType") != "paid" or article.get("privatePaidContent") is not True:
            raise RuntimeError("refusing to modify article because paid/private flags are not intact")

        safe_public = str(article.get("content") or "")
        if PAID_MARKER not in safe_public:
            raise RuntimeError("public paid marker missing")
        public_before, public_after = safe_public.split(PAID_MARKER, 1)
        if public_after.strip():
            raise RuntimeError("private text exists after paid marker in public article doc")

        private_body = str(paid.get("content") or "").strip()
        if not private_body:
            raise RuntimeError("private body empty")
        if PAID_MARKER in private_body:
            raise RuntimeError("private body unexpectedly contains paid marker")

        public_clean = strip_managed_images(public_before)
        private_clean = strip_managed_images(private_body)
        next_public = f"{public_clean}\n\n{md(0)}\n\n{PAID_MARKER}".strip()
        next_private = private_clean
        for index, anchor in enumerate(PRIVATE_ANCHORS, start=1):
            if anchor not in next_private:
                raise RuntimeError(f"private insertion anchor missing: {anchor}")
            next_private = next_private.replace(anchor, f"{anchor}\n\n{md(index)}", 1)

        new_hash = hashlib.sha256(next_private.encode("utf-8")).hexdigest()
        previous_hash = str(paid.get("contentHash") or "")
        previous_version = max(int(paid.get("contentVersion") or 0), int(article.get("paidContentVersion") or 0))
        changed = next_private != private_body or new_hash != previous_hash
        next_version = previous_version + 1 if changed else max(1, previous_version)

        inline_map = deepcopy(settings.get("inlineImageSettings") or {})
        inline_map[ARTICLE_ID] = {
            "version": 1,
            "ratio": "16:9",
            "fit": "cover",
            "maxImages": 6,
            "images": [
                {"src": url, "alt": alt, "positionX": x, "positionY": y, "scale": scale}
                for (_, alt), url, (x, y, scale) in zip(FILES, URLS, POSITIONS)
            ],
            "source": REVISION,
        }

        private_update = {
            "articleId": ARTICLE_ID,
            "title": article.get("title") or paid.get("title") or "",
            "status": "draft",
            "content": next_private,
            "contentHash": new_hash,
            "contentVersion": next_version,
            "active": True,
            "mediaSyncRevision": REVISION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        if changed:
            private_update.update({
                "previousContentBackup": private_body,
                "previousContentVersionBackup": previous_version,
                "previousBackupAt": firestore.SERVER_TIMESTAMP,
            })

        txn.set(private_ref, private_update, merge=True)
        txn.set(article_ref, {
            "content": next_public,
            "status": "draft",
            "accessType": "paid",
            "privatePaidContent": True,
            "paidContentHash": new_hash,
            "paidContentVersion": next_version,
            "inlineImageSyncRevision": REVISION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        txn.set(settings_ref, {
            "inlineImageSettings": inline_map,
            "inlineImageSettingsUpdatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return next_version, new_hash

    version, digest = apply(transaction)

    article = article_ref.get().to_dict() or {}
    paid = private_ref.get().to_dict() or {}
    settings = settings_ref.get().to_dict() or {}
    record = (settings.get("inlineImageSettings") or {}).get(ARTICLE_ID) or {}
    images = record.get("images") or []

    if article.get("status") != "draft" or article.get("accessType") != "paid" or article.get("privatePaidContent") is not True:
        raise RuntimeError("final access flags verification failed")
    safe_public = str(article.get("content") or "")
    if PAID_MARKER not in safe_public:
        raise RuntimeError("final marker missing")
    before, after = safe_public.split(PAID_MARKER, 1)
    if after.strip():
        raise RuntimeError("final public doc leaks private body")
    private_body = str(paid.get("content") or "")
    if PAID_MARKER in private_body:
        raise RuntimeError("final private body contains marker")
    public_managed = [u for u in image_urls(before) if managed_url(u)]
    private_managed = [u for u in image_urls(private_body) if managed_url(u)]
    if public_managed != URLS[:1]:
        raise RuntimeError(f"public image verification failed: {public_managed}")
    if private_managed != URLS[1:]:
        raise RuntimeError(f"private image verification failed: {private_managed}")
    if [item.get("src") for item in images] != URLS or len(images) != 6:
        raise RuntimeError("inlineImageSettings verification failed")
    if str(article.get("paidContentHash") or "") != digest:
        raise RuntimeError("public paid hash mismatch")
    if str(paid.get("contentHash") or "") != digest or int(paid.get("contentVersion") or 0) != version:
        raise RuntimeError("private hash/version mismatch")

    print(f"FIRESTORE_SYNC_OK article={ARTICLE_ID} status=draft access=paid images=6/6 public=1 private=5 version={version} hash={digest}")


if __name__ == "__main__":
    verify_urls()
    sync_firestore()
    verify_urls()
