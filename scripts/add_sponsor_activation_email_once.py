from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def regex_once(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, got {count}")
    p.write_text(updated, encoding="utf-8")


helpers_anchor = '''function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未開通";
}
'''
helpers = helpers_anchor + '''
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

function gmailComposeUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function mailtoUrl(member = {}) {
  const { email, subject, body } = activationEmailContent(member);
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function prepareNotificationWindow() {
  const draftWindow = window.open("about:blank", "_blank");
  if (!draftWindow) return null;
  draftWindow.document.title = "準備會員開通通知信";
  draftWindow.document.body.innerHTML = '<div style="font-family:sans-serif;padding:32px;color:#594F47">正在建立會員開通通知信，請稍候…</div>';
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
  if (!opened) location.href = mailtoUrl(member);
}
'''
replace_once("membership-admin.js", helpers_anchor, helpers)

activate_function = '''async function activateMember() {
  if (!memberForm.reportValidity()) return;
  const notificationWindow = prepareNotificationWindow();
  activateButton.disabled = true;
  const originalLabel = activateButton.textContent;
  activateButton.textContent = "正在開通…";
  try {
    const email = normalizeEmail(document.getElementById("member-email").value);
    const name = document.getElementById("member-name").value.trim();
    const months = selectedMonths();
    const existing = members.find((item) => item.email === email) || {};
    offerStatus = calculateOfferStatus();
    const tier = currentTier();
    const amount = planAmountForTier(months, tier);
    const now = new Date();
    const currentExpiry = dateValue(existing.expiresAt);
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = addMonths(base, months);
    const orderNo = String(existing.lastOrderNo || existing.pendingOrderNo || `MAN${Date.now().toString(36).toUpperCase()}`);
    const alreadyCounted = isCountedSponsorMember(existing);
    const sequence = tier === "promo"
      ? Number(existing.promotionSequence || (alreadyCounted ? offerStatus.paidCount : offerStatus.paidCount + 1))
      : null;
    const payload = {
      email,
      name,
      memberType: "sponsor-member",
      articleAccess: true,
      wellnessAccess: false,
      accessScope: "sponsor-paid-articles",
      accessVersion: 2,
      planMonths: months,
      amount,
      priceTier: tier,
      promotionSequence: sequence,
      paymentStatus: "paid",
      status: "active",
      disabled: false,
      suspended: false,
      revokedAt: deleteField(),
      firstJoinedAt: existing.firstJoinedAt || now.toISOString(),
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      paidAt: now.toISOString(),
      lastOrderNo: orderNo,
      pendingOrderNo: deleteField(),
      pendingPlanMonths: deleteField(),
      pendingAmount: deleteField(),
      pendingPriceTier: deleteField(),
      pendingPromotionSequence: deleteField(),
      pendingPaymentUrl: deleteField(),
      pendingPaymentDeadline: deleteField(),
      confirmedBy: auth.currentUser?.email || "",
      confirmedAt: serverTimestamp(),
      note: document.getElementById("member-note").value.trim(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "sponsorMemberAccess", email), payload, { merge: true });
    await writeSponsorHistory(email, payload, "verified");
    await loadMembers();
    openActivationEmail(payload, notificationWindow);
    statusEl.textContent = `付款已確認並開通｜到期日 ${formatDate(payload.expiresAt)}｜開通通知信已建立，請在 Gmail 確認後按下寄送`;
    resetMemberForm();
  } catch (error) {
    if (notificationWindow && !notificationWindow.closed) notificationWindow.close();
    throw error;
  } finally {
    activateButton.disabled = false;
    activateButton.textContent = originalLabel;
  }
}

async function createPaymentOrder'''
regex_once(
    "membership-admin.js",
    r'''async function activateMember\(\) \{.*?\n\}\n\nasync function createPaymentOrder''',
    activate_function,
)

replace_once(
    "membership-admin.js",
    '''            <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯／續期</button>
            <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>''',
    '''            <button class="btn" type="button" data-notify="${escapeHtml(member.email)}">寄發開通通知</button>
            <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯／續期</button>
            <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>''',
)

replace_once(
    "membership-admin.js",
    '''  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));
  listEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.delete)));''',
    '''  listEl.querySelectorAll("[data-notify]").forEach((button) => button.addEventListener("click", () => {
    const member = members.find((item) => item.email === button.dataset.notify);
    if (member) openActivationEmail(member);
  }));
  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));
  listEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.delete)));''',
)

replace_once(
    "admin.html",
    '<button id="member-activate" class="btn" type="button">付款成功，加入／續期會員</button>',
    '<button id="member-activate" class="btn" type="button">付款成功，開通並建立通知信</button>',
)
replace_once(
    "admin.html",
    '<p class="membership-help">流程只有兩步：先依目前人數寄出正確付款連結；確認收到款項後，再按「付款成功，加入／續期會員」。只有這一步完成後，前台倒數人數才會更新。</p>',
    '<p class="membership-help">流程只有兩步：先寄出付款連結；確認收到款項後，按「付款成功，開通並建立通知信」。系統會更新會員資格與前台倒數，並自動開啟已填好收件人、方案、開通日與到期日的 Gmail 草稿；行政人員確認內容後按下寄送即可。會員名單內也可隨時重新產生通知信。</p>',
)
replace_once(
    "admin.html",
    'membership-admin.js?v=20260805-public-sync-1',
    'membership-admin.js?v=20260806-activation-email-1',
)

print("Sponsor activation email workflow added.")
