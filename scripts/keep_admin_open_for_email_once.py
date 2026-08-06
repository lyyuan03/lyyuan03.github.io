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
    '''function openActivationEmail(member = {}, draftWindow = null) {
  const url = gmailComposeUrl(member);
  if (draftWindow && !draftWindow.closed) {
    draftWindow.location.href = url;
    try { draftWindow.opener = null; } catch {}
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}
''',
    '''function openActivationEmail(member = {}, draftWindow = null) {
  const url = gmailComposeUrl(member);
  const emailWindow = draftWindow && !draftWindow.closed
    ? draftWindow
    : prepareNotificationWindow();
  if (!emailWindow) {
    alert("瀏覽器阻擋了 Gmail 新視窗。請允許 lyyuan.tw 開啟彈出式視窗後再試一次；目前後台頁面會保留不變。");
    return false;
  }
  emailWindow.location.href = url;
  try { emailWindow.opener = null; } catch {}
  return true;
}
'''
)

replace_once(
    'membership-admin.js',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在以 ${OFFICIAL_SENDER_EMAIL} 開啟付款通知 Gmail 草稿。`;
  const url = officialGmailComposeUrl(email, subject, body);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}
''',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在以 ${OFFICIAL_SENDER_EMAIL} 開啟付款通知 Gmail 草稿。`;
  const url = officialGmailComposeUrl(email, subject, body);
  const emailWindow = window.open("about:blank", "_blank");
  if (!emailWindow) {
    alert("瀏覽器阻擋了 Gmail 新視窗。請允許 lyyuan.tw 開啟彈出式視窗後再試一次；目前後台頁面會保留不變。");
    return;
  }
  emailWindow.document.title = "準備付款通知信";
  emailWindow.document.body.innerHTML = `<div style="font-family:sans-serif;padding:32px;color:#594F47">正在以靈元院官方信箱 ${OFFICIAL_SENDER_EMAIL} 建立付款通知信，請稍候…</div>`;
  emailWindow.location.href = url;
  try { emailWindow.opener = null; } catch {}
}
'''
)

replace_once(
    'admin.html',
    'membership-admin.js?v=20260806-email-wording-1',
    'membership-admin.js?v=20260806-email-new-tab-1'
)

print('Gmail drafts now open in a new tab without replacing the admin page.')
