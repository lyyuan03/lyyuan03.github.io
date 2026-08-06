from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "sponsor-checkout.js",
    '''    .sponsor-offer-sync{display:inline-flex;align-items:center;justify-content:center;gap:5px;margin-top:3px;font-size:9px;color:#8a765e}\n    .sponsor-offer-sync::before{content:'';width:5px;height:5px;border-radius:50%;background:#9d8058}\n    .sponsor-offer-sync.is-live::before{background:#657247}\n''',
    ""
)

replace_once(
    "sponsor-checkout.js",
    '''  const syncText = offerIsLive ? "名額與付款連結已同步" : "正在取得最新名額與付款連結";\n''',
    ""
)

replace_once(
    "sponsor-checkout.js",
    '''      <small class="sponsor-offer-sync${offerIsLive ? " is-live" : ""}">${syncText}</small>\n''',
    ""
)

html = Path("articles.html")
text = html.read_text(encoding="utf-8")
updated, count = re.subn(
    r'(sponsor-checkout\.js\?v=)[^"\']+',
    r'\g<1>20260806-remove-sync-text-1',
    text,
    count=1,
)
if count != 1:
    raise SystemExit(f"articles.html: expected one sponsor-checkout cache version, got {count}")
html.write_text(updated, encoding="utf-8")

print("Removed sponsor sync status text from frontend.")
