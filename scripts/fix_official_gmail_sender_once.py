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
    'const settingsForm = document.getElementById("membership-settings-form");',
    'const OFFICIAL_SENDER_EMAIL = "lyyuan03@gmail.com";\n\nconst settingsForm = document.getElementById("membership-settings-form");'
)

replace_once(
    'membership-admin.js',
    '''function gmailComposeUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function mailtoUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
''',
    '''function officialGmailComposeUrl(to, subject, body) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(OFFICIAL_SENDER_EMAIL)}&view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function gmailComposeUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return officialGmailComposeUrl(email, subject, body);
}
'''
)

replace_once(
    'membership-admin.js',
    '''  draftWindow.document.title = "準備會員開通通知信";
  draftWindow.document.body.innerHTML = '<div style="font-family:sans-serif;padding:32px;color:#594F47">正在建立會員開通通知信，請稍候…</div>';
''',
    '''  draftWindow.document.title = "準備會員開通通知信";
  draftWindow.document.body.innerHTML = `<div style="font-family:sans-serif;padding:32px;color:#594F47">正在以靈元院官方信箱 ${OFFICIAL_SENDER_EMAIL} 建立會員開通通知信，請稍候…</div>`;
'''
)

replace_once(
    'membership-admin.js',
    '''  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = mailtoUrl(member);
}
''',
    '''  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}
'''
)

replace_once(
    'membership-admin.js',
    '''    statusEl.textContent = `付款已確認並開通｜到期日 ${formatDate(payload.expiresAt)}｜開通通知信已建立，請在 Gmail 確認後按下寄送`;
''',
    '''    statusEl.textContent = `付款已確認並開通｜到期日 ${formatDate(payload.expiresAt)}｜已用 ${OFFICIAL_SENDER_EMAIL} 建立通知草稿，請確認後按下寄送`;
'''
)

replace_once(
    'membership-admin.js',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在開啟付款通知 Email。`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
''',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在以 ${OFFICIAL_SENDER_EMAIL} 開啟付款通知 Gmail 草稿。`;
  const url = officialGmailComposeUrl(email, subject, body);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}
'''
)

replace_once(
    'admin.html',
    '''<p class="membership-help">流程只有兩步：先寄出付款連結；確認收到款項後，按「付款成功，開通並建立通知信」。系統會更新會員資格與前台倒數，並自動開啟已填好收件人、方案、開通日與到期日的 Gmail 草稿；行政人員確認內容後按下寄送即可。會員名單內也可隨時重新產生通知信。</p>''',
    '''<p class="membership-help">流程只有兩步：先寄出付款連結；確認收到款項後，按「付款成功，開通並建立通知信」。系統會更新會員資格與前台倒數，並固定以靈元院官方信箱 lyyuan03@gmail.com 開啟已填好收件人、方案、開通日與到期日的 Gmail 草稿；行政人員確認內容後按下寄送即可。若瀏覽器尚未登入官方信箱，Google 會先要求登入或切換帳號。會員名單內也可隨時重新產生通知信。</p>'''
)

replace_once(
    'admin.html',
    'membership-admin.js?v=20260806-activation-email-1',
    'membership-admin.js?v=20260806-official-sender-1'
)

print('Official Gmail sender fixed while preserving message flow and content.')
