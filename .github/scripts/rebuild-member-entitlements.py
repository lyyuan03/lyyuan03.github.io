#!/usr/bin/env python3
"""Rebuild the canonical memberEntitlements collection from membership source records."""

from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "lyyuan03-membership")
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"
SCHEMA_VERSION = 1


def access_token() -> str:
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


TOKEN = access_token()


def request_json(method: str, url: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {TOKEN}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Firestore {method} failed ({error.code}): {payload}") from error


def decode_value(value: dict):
    if "stringValue" in value:
        return value["stringValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    if "mapValue" in value:
        return {key: decode_value(item) for key, item in value["mapValue"].get("fields", {}).items()}
    return None


def decode_fields(document: dict) -> dict:
    return {key: decode_value(value) for key, value in document.get("fields", {}).items()}


def encode_value(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {key: encode_value(item) for key, item in value.items()}}}
    return {"stringValue": str(value)}


def timestamp_value(value: dt.datetime | None) -> dict | None:
    if value is None:
        return None
    value = value.astimezone(dt.timezone.utc)
    rendered = value.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return {"timestampValue": rendered}


def parse_datetime(value) -> dt.datetime | None:
    if not value:
        return None
    if isinstance(value, dt.datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = dt.datetime.fromisoformat(text)
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def normalized_email(value: str) -> str:
    return str(value or "").strip().lower()


def list_collection(collection: str) -> dict[str, dict]:
    result: dict[str, dict] = {}
    page_token = ""
    while True:
        params = {"pageSize": "300"}
        if page_token:
            params["pageToken"] = page_token
        url = f"{BASE_URL}/{collection}?{urllib.parse.urlencode(params)}"
        payload = request_json("GET", url)
        for document in payload.get("documents", []):
            doc_id = urllib.parse.unquote(document["name"].rsplit("/", 1)[-1])
            result[normalized_email(doc_id)] = {
                "fields": decode_fields(document),
                "name": document["name"],
                "updateTime": document.get("updateTime"),
            }
        page_token = payload.get("nextPageToken", "")
        if not page_token:
            break
    return result


def active_window(record: dict, now: dt.datetime) -> tuple[bool, dt.datetime | None]:
    starts_at = parse_datetime(record.get("startsAt") or record.get("firstJoinedAt"))
    expires_at = parse_datetime(record.get("expiresAt"))
    return (bool((starts_at is None or starts_at <= now) and expires_at and expires_at > now), expires_at)


def sponsor_state(record: dict, email: str, now: dt.datetime) -> dict:
    window, expires_at = active_window(record, now)
    record_email = normalized_email(record.get("email") or email)
    active = bool(
        record_email == email
        and record.get("memberType") == "sponsor-member"
        and record.get("status") == "active"
        and record.get("paymentStatus") == "paid"
        and record.get("disabled") is not True
        and record.get("suspended") is not True
        and not record.get("revokedAt")
        and window
    )
    return {"article": active, "expiresAt": expires_at}


def wellness_state(record: dict, email: str, now: dt.datetime) -> dict:
    window, expires_at = active_window(record, now)
    record_email = normalized_email(record.get("email") or email)
    active = bool(
        record_email == email
        and record.get("memberType") == "wellness-channel"
        and record.get("wellnessAccess") is True
        and record.get("memberLevel") in {"wellness", "lingji"}
        and record.get("status") == "active"
        and record.get("paymentStatus") == "paid"
        and record.get("disabled") is not True
        and record.get("suspended") is not True
        and not record.get("revokedAt")
        and window
    )
    lingji = active and record.get("memberLevel") == "lingji"
    article = active and (lingji or record.get("articleAccess") is True)
    return {"article": article, "video": active, "lingji": lingji, "expiresAt": expires_at}


def entitlement_fields(email: str, sponsor: dict, wellness: dict, has_sponsor: bool, has_wellness: bool) -> dict:
    now = dt.datetime.now(dt.timezone.utc)
    sponsor_access = sponsor_state(sponsor, email, now)
    wellness_access = wellness_state(wellness, email, now)
    paid_article = sponsor_access["article"] or wellness_access["article"]
    active = paid_article or wellness_access["video"]

    fields = {
        "email": encode_value(email),
        "schemaVersion": encode_value(SCHEMA_VERSION),
        "status": encode_value("active" if active else "inactive"),
        "paidArticleAccess": encode_value(paid_article),
        "sponsorArticleAccess": encode_value(sponsor_access["article"]),
        "wellnessArticleAccess": encode_value(wellness_access["article"]),
        "wellnessVideoAccess": encode_value(wellness_access["video"]),
        "lingjiAccess": encode_value(wellness_access["lingji"]),
        "sourceCollections": encode_value({
            "sponsorMemberAccess": has_sponsor,
            "memberAccess": has_wellness,
        }),
        "computedAt": timestamp_value(now),
    }
    if sponsor_access["expiresAt"]:
        fields["sponsorExpiresAt"] = timestamp_value(sponsor_access["expiresAt"])
    if wellness_access["expiresAt"]:
        fields["wellnessExpiresAt"] = timestamp_value(wellness_access["expiresAt"])
    return fields


def patch_entitlement(email: str, fields: dict) -> None:
    doc_id = urllib.parse.quote(email, safe="")
    # 僅更新本流程負責的付費／養生欄位，保留活動 permissions 與其他既有欄位。
    mask_fields = set(fields) | {"sponsorExpiresAt", "wellnessExpiresAt"}
    query = urllib.parse.urlencode([("updateMask.fieldPaths", name) for name in sorted(mask_fields)])
    request_json("PATCH", f"{BASE_URL}/memberEntitlements/{doc_id}?{query}", {"fields": fields})


def delete_entitlement(email: str) -> None:
    doc_id = urllib.parse.quote(email, safe="")
    request_json("DELETE", f"{BASE_URL}/memberEntitlements/{doc_id}")


def main() -> int:
    sponsor_docs = list_collection("sponsorMemberAccess")
    wellness_docs = list_collection("memberAccess")
    entitlement_docs = list_collection("memberEntitlements")
    emails = sorted(set(sponsor_docs) | set(wellness_docs) | set(entitlement_docs))

    updated = 0
    deleted = 0
    for email in emails:
        has_sponsor = email in sponsor_docs
        has_wellness = email in wellness_docs
        independent_permissions = entitlement_docs.get(email, {}).get("fields", {}).get("permissions", [])
        if not has_sponsor and not has_wellness and not independent_permissions:
            delete_entitlement(email)
            deleted += 1
            print(f"Deleted orphan entitlement: {email}")
            continue

        sponsor = sponsor_docs.get(email, {}).get("fields", {})
        wellness = wellness_docs.get(email, {}).get("fields", {})
        fields = entitlement_fields(email, sponsor, wellness, has_sponsor, has_wellness)
        patch_entitlement(email, fields)
        updated += 1
        print(f"Rebuilt entitlement: {email}")

    print(f"Member entitlement rebuild complete: {updated} updated, {deleted} deleted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
