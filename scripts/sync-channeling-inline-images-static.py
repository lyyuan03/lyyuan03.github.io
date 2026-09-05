import hashlib
import re
from copy import deepcopy

import requests
from google.cloud import firestore

PROJECT_ID = "lyyuan03-membership"
ARTICLE_ID = "channeling-ability-secrets-draft"
SETTINGS_ID = "__article-thumbnail-settings"
PAID_MARKER = "<!-- paid-only -->"
BASE = "https://lyyuan.tw/assets/articles/channeling-ability-secrets-draft"
REVISION = "chatgpt-teaching-infographics-20260905-v2"

FILES = [
    ("01-secret-amplify.svg", "第一個秘密：通靈只會放大既有能力"),
    ("02-secret-ability-heart-cultivation.svg", "第二個秘密：能力、心性與修行是不同層次"),
    ("03-secret-spirit-levels.svg", "第三個秘密：所通之靈的層次決定它關心什麼"),
    ("04-secret-desire.svg", "第四個秘密：樂透、股票、考試照出人的欲望"),
    ("05-secret-accuracy-level.svg", "第五個秘密：準確不等於層次高"),
    ("06-secret-return-heart.svg", "第六個秘密：高層次的靈性把人帶回自己的心"),
]
URLS = [f"{BASE}/{name}" for name, _ in FILES]
THUMBNAIL_URL = f"{BASE}/00-thumbnail-teaching.svg"
POSITIONS = [(50,50,100)] * 6
PRIVATE_ANCHORS = [
    "## 第二個秘密｜能力、心性、修行，本來就是三個不同層次",
    "## 第三個秘密｜通靈與「所通的靈」是綁在一起的",
    "## 第四個秘密｜樂透、股票、賭博，最容易照出人的欲望",
    "## 第五個秘密｜「準」和「層次高」，一定要分開",
    "## 第六個秘密｜高層次的靈性，最後都會把人帶回自己",
]


def verify_svg(url):
    response = requests.get(url, timeout=30, headers={"Cache-Control": "no-cache"})
    if response.status_code != 200:
        raise RuntimeError(f"image URL not live: {url} HTTP {response.status_code}")
    text = response.text
    if "<svg" not in text or 'width="1600"' not in text or 'height="900"' not in text:
        raise RuntimeError(f"invalid 1600x900 SVG: {url}")
    print(f"live image verified: {url} 1600x900 SVG")


def verify_urls():
    verify_svg(THUMBNAIL_URL)
    for url in URLS:
        verify_svg(url)


def managed_url(url):
    value = str(url or "")
    return "/assets/articles/channeling-ability-secrets-draft/" in value or "assets/articles/channeling-ability-secrets-draft/" in value


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
        if not article_snap.exists or not private_snap.exists:
            raise RuntimeError("article/private document missing")

        article = article_snap.to_dict() or {}
        paid = private_snap.to_dict() or {}
        settings = settings_snap.to_dict() if settings_snap.exists else {}
        settings = settings or {}

        if article.get("status") != "draft":
            raise RuntimeError(f"refusing to modify non-draft article: {article.get('status')}")
        if article.get("accessType") != "paid" or article.get("privatePaidContent") is not True:
            raise RuntimeError("paid/private flags are not intact")

        safe_public = str(article.get("content") or "")
        if PAID_MARKER not in safe_public:
            raise RuntimeError("public paid marker missing")
        public_before, public_after = safe_public.split(PAID_MARKER, 1)
        if public_after.strip():
            raise RuntimeError("private text exists after paid marker in public article doc")

        private_body = str(paid.get("content") or "").strip()
        if not private_body or PAID_MARKER in private_body:
            raise RuntimeError("private body invalid")

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
            "version": 2,
            "ratio": "16:9",
            "fit": "cover",
            "maxImages": 6,
            "images": [
                {"src": url, "alt": alt, "positionX": x, "positionY": y, "scale": scale}
                for (_, alt), url, (x, y, scale) in zip(FILES, URLS, POSITIONS)
            ],
            "source": REVISION,
        }

        thumb_map = deepcopy(settings.get("settings") or {})
        thumb_map[ARTICLE_ID] = {
            "thumbnailFit": "cover",
            "thumbnailPositionX": 50,
            "thumbnailPositionY": 50,
            "thumbnailScale": 100,
            "thumbnailTitleAlign": "left",
            "thumbnailImage": THUMBNAIL_URL,
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
            "thumbnailImage": THUMBNAIL_URL,
            "status": "draft",
            "accessType": "paid",
            "privatePaidContent": True,
            "paidContentHash": new_hash,
            "paidContentVersion": next_version,
            "inlineImageSyncRevision": REVISION,
            "thumbnailSyncRevision": REVISION,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        txn.set(settings_ref, {
            "inlineImageSettings": inline_map,
            "settings": thumb_map,
            "inlineImageSettingsUpdatedAt": firestore.SERVER_TIMESTAMP,
            "settingsUpdatedAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return next_version, new_hash

    version, digest = apply(transaction)

    article = article_ref.get().to_dict() or {}
    paid = private_ref.get().to_dict() or {}
    settings = settings_ref.get().to_dict() or {}
    record = (settings.get("inlineImageSettings") or {}).get(ARTICLE_ID) or {}
    thumb = (settings.get("settings") or {}).get(ARTICLE_ID) or {}
    images = record.get("images") or []

    if article.get("status") != "draft" or article.get("accessType") != "paid" or article.get("privatePaidContent") is not True:
        raise RuntimeError("final access flags verification failed")
    safe_public = str(article.get("content") or "")
    before, after = safe_public.split(PAID_MARKER, 1)
    if after.strip():
        raise RuntimeError("final public doc leaks private body")
    private_body = str(paid.get("content") or "")
    public_managed = [u for u in image_urls(before) if managed_url(u)]
    private_managed = [u for u in image_urls(private_body) if managed_url(u)]
    if public_managed != URLS[:1] or private_managed != URLS[1:]:
        raise RuntimeError("final article image placement verification failed")
    if [item.get("src") for item in images] != URLS or len(images) != 6:
        raise RuntimeError("inlineImageSettings verification failed")
    if str(article.get("thumbnailImage") or "") != THUMBNAIL_URL or str(thumb.get("thumbnailImage") or "") != THUMBNAIL_URL:
        raise RuntimeError("thumbnail verification failed")
    if str(article.get("paidContentHash") or "") != digest:
        raise RuntimeError("public paid hash mismatch")
    if str(paid.get("contentHash") or "") != digest or int(paid.get("contentVersion") or 0) != version:
        raise RuntimeError("private hash/version mismatch")

    print(f"FIRESTORE_SYNC_OK article={ARTICLE_ID} status=draft access=paid images=6/6 thumbnail=ok public=1 private=5 version={version} hash={digest}")


if __name__ == "__main__":
    verify_urls()
    sync_firestore()
    verify_urls()
