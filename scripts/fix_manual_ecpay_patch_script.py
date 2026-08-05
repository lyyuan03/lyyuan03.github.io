from pathlib import Path

path = Path("scripts/manual_ecpay_sponsor_flow_once.py")
text = path.read_text(encoding="utf-8")

helper_anchor = '''def sub_once(path: str, pattern: str, replacement: str) -> None:
'''
helper = '''def replace_all_exact(path: str, old: str, new: str, expected: int) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} exact matches, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")


def sub_once(path: str, pattern: str, replacement: str) -> None:
'''
if "def replace_all_exact" not in text:
    if helper_anchor not in text:
        raise SystemExit("helper anchor not found")
    text = text.replace(helper_anchor, helper, 1)

old_block = '''replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。',
    '付款完成後，靈元院行政團隊會核對款項並開通閱讀資格。請使用本信收件 Email 登入靈元院官網。'
)
replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '      <p>付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。</p>',
    '      <p>付款完成後，靈元院行政團隊會核對款項並開通閱讀資格。請使用本信收件 Email 登入靈元院官網。</p>'
)
'''
new_block = '''replace_all_exact(
    "functions/public-sponsor-checkout-functions.js",
    '付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。',
    '付款完成後，靈元院行政團隊會核對款項並開通閱讀資格。請使用本信收件 Email 登入靈元院官網。',
    2
)
'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif new_block not in text:
    raise SystemExit("duplicate wording block not found")

path.write_text(text, encoding="utf-8")
print("Patch script duplicate wording fix applied.")
