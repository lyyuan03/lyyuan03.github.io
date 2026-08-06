from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'membership-admin.js',
    '''  const body = `${name}您好：

您的「靈元院贊助專屬文章會員」已完成開通。''',
    '''  const body = `${name}　師兄/師姐您好：

您的「靈元院贊助專屬文章會員」已完成開通。'''
)

replace_once(
    'membership-admin.js',
    '''祝福吉祥
靈元院行政團隊`;''',
    '''祝福吉祥　母娘保佑
靈元院行政團隊`;'''
)

replace_once(
    'admin.html',
    'membership-admin.js?v=20260806-official-sender-1',
    'membership-admin.js?v=20260806-email-wording-1'
)

print('Member activation email greeting and closing updated.')
