import os
import runpy
from google.cloud import storage
from google.api_core.exceptions import NotFound, Forbidden

project = os.environ.get("PROJECT_ID", "lyyuan03-membership")
preferred = os.environ.get("BUCKET_NAME", "").strip()
candidates = [name for name in [preferred, f"{project}.appspot.com", f"{project}.firebasestorage.app"] if name]
client = storage.Client(project=project)
resolved = ""
seen = set()
for name in candidates:
    if name in seen:
        continue
    seen.add(name)
    try:
        bucket = client.get_bucket(name)
        resolved = bucket.name
        break
    except NotFound:
        print(f"Storage bucket candidate not found: {name}")
    except Forbidden:
        print(f"Storage bucket candidate exists or may exist but cannot be read: {name}")

if not resolved:
    try:
        buckets = list(client.list_buckets(project=project))
    except Exception as exc:
        raise SystemExit(f"Unable to resolve Firebase Storage bucket: {exc}")
    names = [bucket.name for bucket in buckets]
    print("Available project buckets:", names)
    matching = [name for name in names if project in name]
    if len(matching) == 1:
        resolved = matching[0]
    elif len(names) == 1:
        resolved = names[0]

if not resolved:
    raise SystemExit("No usable Firebase Storage bucket found for project")

print(f"Resolved Firebase Storage bucket: {resolved}")
os.environ["BUCKET_NAME"] = resolved
runpy.run_path("scripts/sync-channeling-inline-images.py", run_name="__main__")
