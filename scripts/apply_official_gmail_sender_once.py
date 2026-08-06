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
    '''function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未開通";
}
''',
    '''function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未開通";
}

function activationEmailContent(member = {}) {
  const name = String(member.name || "會員").trim() || "會員";
  const email = normalizeEmail(member.email || "");
  const months = Number(member.planMonths) === 3 ? 3 : 1;
  const priceLabel = member.priceTier === "regular" ? "一般價格" : "前200名優惠";
  const subject = `靈元院贊助專屬文章會員｜開通通知`;
  const body = `${name}您好：

您的「靈元院贊助專屬文章會員」已完成開通。

登入 Gmail：${email}
會員方案：${months} 個月
開通日期：${formatDate(member.startsAt || member.paidAt)}
資格到期日：${formatDate(member.expiresAt)}
本次方案：${priceLabel}
實收金額：新台幣 ${Number(member.amount || 0).toLocaleString("zh-TW")} 元

會員中心：
https://lyyuan.tw/member-dashboard.html

贊助專屬文章：
https://lyyuan.tw/articles.html

請使用上述 Gmail 登入靈元院官網，即可在會員中心查看資格與到期日，並閱讀贊助專屬文章。

如已完成付款但登入後仍未顯示資格，請直接回覆本信，由行政團隊協助確認。

祝福吉祥
靈元院行政團隊`;
  return { email, subject, body };
}

function officialGmailComposeUrl(to, subject, body) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(OFFICIAL_SENDER_EMAIL)}&view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function gmailComposeUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return officialGmailComposeUrl(email, subject, body);
}

function prepareNotificationWindow() {
  const draftWindow = window.open("about:blank", "_blank");
  if (!draftWindow) return null;
  draftWindow.document.title = "準備會員開通通知信";
  draftWindow.document.body.innerHTML = `<div style="font-family:sans-serif;padding:32px;color:#594F47">正在以靈元院官方信箱 ${OFFICIAL_SENDER_EMAIL} 建立會員開通通知信，請稍候…</div>`;
  return draftWindow;
}

function openActivationEmail(member = {}, draftWindow = null) {
  const url = gmailComposeUrl(member);
  if (draftWindow && !draftWindow.closed) {
    draftWindow.location.href = url;
    try { draftWindow.opener = null; } catch {}
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}
'''
)

replace_once(
    'membership-admin.js',
    '''async function activateMember() {
  if (!memberForm.reportValidity()) return;
  activateButton.disabled = true;''',
    '''async function activateMember() {
  if (!memberForm.reportValidity()) return;
  const notificationWindow = prepareNotificationWindow();
  activateButton.disabled = true;'''
)

replace_once(
    'membership-admin.js',
    '''    await setDoc(doc(db, "sponsorMemberAccess", email), payload, { merge: true });
    await writeSponsorHistory(email, payload, "verified");
    statusEl.textContent = `付款已確認並開通｜${tier === "promo" ? `前200名優惠第 ${sequence} 名` : "一般價格"}｜NT$${Number(amount).toLocaleString("zh-TW")}／${months}個月`;
    await loadMembers();
    resetMemberForm();
  } finally {''',
    '''    await setDoc(doc(db, "sponsorMemberAccess", email), payload, { merge: true });
    await writeSponsorHistory(email, payload, "verified");
    await loadMembers();
    openActivationEmail(payload, notificationWindow);
    statusEl.textContent = `付款已確認並開通｜到期日 ${formatDate(payload.expiresAt)}｜已用 ${OFFICIAL_SENDER_EMAIL} 建立通知草稿，請確認後按下寄送`;
    resetMemberForm();
  } catch (error) {
    if (notificationWindow && !notificationWindow.closed) notificationWindow.close();
    throw error;
  } finally {'''
)

replace_once(
    'membership-admin.js',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在開啟付款通知 Email。`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}''',
    '''  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在以 ${OFFICIAL_SENDER_EMAIL} 開啟付款通知 Gmail 草稿。`;
  const url = officialGmailComposeUrl(email, subject, body);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) location.href = url;
}'''
)

replace_once(
    'membership-admin.js',
    '''          <div class="member-row-actions">
            <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯／續期</button>''',
    '''          <div class="member-row-actions">
            <button class="btn" type="button" data-notify="${escapeHtml(member.email)}">寄發開通通知</button>
            <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯／續期</button>'''
)

replace_once(
    'membership-admin.js',
    '''  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));''',
    '''  listEl.querySelectorAll("[data-notify]").forEach((button) => button.addEventListener("click", () => {
    const member = members.find((item) => item.email === button.dataset.notify);
    if (member) openActivationEmail(member);
  }));
  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));'''
)

replace_once(
    'admin.html',
    '''<button id="member-activate" class="btn" type="button">付款成功，加入／續期會員</button>''',
    '''<button id="member-activate" class="btn" type="button">付款成功，開通並建立通知信</button>'''
)

replace_once(
    'admin.html',
    '''<p class="membership-help">流程只有兩步：先依目前人數寄出正確付款連結；確認收到款項後，再按「付款成功，加入／續期會員」。只有這一步完成後，前台倒數人數才會更新。</p>''',
    '''<p class="membership-help">流程只有兩步：先寄出付款連結；確認收到款項後，按「付款成功，開通並建立通知信」。系統會更新會員資格與前台倒數，並固定以靈元院官方信箱 lyyuan03@gmail.com 開啟已填好收件人、方案、開通日與到期日的 Gmail 草稿；行政人員確認內容後按下寄送即可。若瀏覽器尚未登入官方信箱，Google 會先要求登入或切換帳號。會員名單內也可隨時重新產生通知信。</p>'''
)

replace_once(
    'admin.html',
    'membership-admin.js?v=20260805-public-sync-1',
    'membership-admin.js?v=20260806-official-sender-1'
)

print('Official Gmail sender flow applied.')
