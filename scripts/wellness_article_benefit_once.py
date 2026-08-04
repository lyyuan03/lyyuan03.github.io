from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> bool:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


def regex_once(path: str, pattern: str, replacement: str) -> bool:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}")
    file.write_text(updated, encoding="utf-8")
    return True


changed = False

# ---------------------------------------------------------------------------
# Admin UI: replace the confusing disabled checkbox with one automatic benefit
# card and two audit fields.
# ---------------------------------------------------------------------------
old_admin_block = '''            <label class="check-field" for="wellness-member-article-access">
              <input id="wellness-member-article-access" type="checkbox" disabled>
              <span><strong>贊助文章權限採獨立管理</strong><small>養生療癒會員不會自動取得贊助文章權限；如需開放，請至上方「贊助會員管理」完成付款與開通。</small></span>
            </label>
'''
new_admin_block = '''            <div id="wellness-article-benefit-summary" class="membership-summary">
              <strong id="wellness-article-benefit-title" style="display:block;color:#D8BD91;margin-bottom:4px">贊助文章閱讀權限：尚未符合</strong>
              <span id="wellness-article-benefit-detail">靈極會員自動開通；一般會員單筆消費滿新台幣 15,000 元後自動開通。</span>
            </div>
            <div class="grid">
              <div class="field"><label for="wellness-member-qualifying-purchase">本次符合權益的單筆消費</label><input id="wellness-member-qualifying-purchase" type="number" min="0" step="1" value="0"></div>
              <div class="field"><label for="wellness-member-article-reference">消費／訂單編號</label><input id="wellness-member-article-reference" placeholder="選填，方便日後核對"></div>
            </div>
            <p class="membership-help">權限由系統自動判讀，不需人工勾選：靈極會員於會籍有效期間自動開通；一般會員本次單筆消費達新台幣 15,000 元時開通。文章權限效期一律跟隨本次養生療癒會員會期。</p>
'''
changed |= replace_once("admin.html", old_admin_block, new_admin_block)

old_admin_help = '''          <p class="membership-help">此區只管理「靈元院養生療癒頻道」的一般會員、靈極會員與會期；贊助文章閱讀權限一律由上方贊助會員名單獨立判讀。</p>
'''
new_admin_help = '''          <p class="membership-help">此區同時管理養生療癒會員會籍與其加贈的贊助文章權限。靈極會員自動開通；一般會員須有單筆滿新台幣 15,000 元的紀錄。直接購買贊助閱讀方案者，仍由上方「贊助會員」名單獨立管理。</p>
'''
changed |= replace_once("admin.html", old_admin_help, new_admin_help)

# ---------------------------------------------------------------------------
# Wellness admin logic.
# ---------------------------------------------------------------------------
old_consts = '''const levelEl = document.getElementById("wellness-member-level");
const articleAccessEl = document.getElementById("wellness-member-article-access");
const sendPaymentButton = document.getElementById("wellness-member-send-payment");
'''
new_consts = '''const levelEl = document.getElementById("wellness-member-level");
const stateEl = document.getElementById("wellness-member-state");
const qualifyingPurchaseEl = document.getElementById("wellness-member-qualifying-purchase");
const articleReferenceEl = document.getElementById("wellness-member-article-reference");
const articleBenefitTitleEl = document.getElementById("wellness-article-benefit-title");
const articleBenefitDetailEl = document.getElementById("wellness-article-benefit-detail");
const sendPaymentButton = document.getElementById("wellness-member-send-payment");
const ARTICLE_BENEFIT_THRESHOLD = 15000;
'''
changed |= replace_once("wellness-member-admin.js", old_consts, new_consts)

old_sync = '''function syncArticleAccess() {
  articleAccessEl.checked = false;
  articleAccessEl.disabled = true;
}
'''
new_sync = '''function articleBenefitDecision({ memberLevel, status, qualifyingSinglePurchaseAmount }) {
  const amount = Math.max(0, Number(qualifyingSinglePurchaseAmount) || 0);
  const source = memberLevel === "lingji"
    ? "lingji-member"
    : amount >= ARTICLE_BENEFIT_THRESHOLD
      ? "single-purchase-15000"
      : "none";
  const qualified = source !== "none";
  return {
    source,
    qualified,
    active: status === "active" && qualified,
    amount
  };
}

function updateArticleBenefitPreview() {
  if (!articleBenefitTitleEl || !articleBenefitDetailEl) return;
  const level = levelEl.value === "lingji" ? "lingji" : "wellness";
  const status = stateEl.value;
  const decision = articleBenefitDecision({
    memberLevel: level,
    status,
    qualifyingSinglePurchaseAmount: qualifyingPurchaseEl.value
  });
  const startsAt = document.getElementById("wellness-member-starts-at").value || "未設定";
  const expiresAt = document.getElementById("wellness-member-expires-at").value || "未設定";

  if (decision.source === "lingji-member") {
    articleBenefitTitleEl.textContent = decision.active
      ? "贊助文章閱讀權限：靈極會員自動開通"
      : "贊助文章閱讀權限：待會員啟用";
    articleBenefitDetailEl.textContent = `資格來源：靈極會員加贈｜權限期間：${startsAt}－${expiresAt}`;
    return;
  }
  if (decision.source === "single-purchase-15000") {
    articleBenefitTitleEl.textContent = decision.active
      ? "贊助文章閱讀權限：一般會員單筆滿額開通"
      : "贊助文章閱讀權限：單筆滿額，待會員啟用";
    articleBenefitDetailEl.textContent = `本次單筆消費 NT$${decision.amount.toLocaleString("zh-TW")}｜權限期間：${startsAt}－${expiresAt}`;
    return;
  }
  articleBenefitTitleEl.textContent = "贊助文章閱讀權限：尚未符合";
  articleBenefitDetailEl.textContent = `一般會員尚差 NT$${Math.max(0, ARTICLE_BENEFIT_THRESHOLD - decision.amount).toLocaleString("zh-TW")} 達單筆滿額門檻；靈極會員則會自動開通。`;
}

async function syncWellnessArticleBenefit(member) {
  const decision = articleBenefitDecision({
    memberLevel: member.memberLevel,
    status: member.status,
    qualifyingSinglePurchaseAmount: member.qualifyingSinglePurchaseAmount
  });
  await setDoc(doc(db, "sponsorMemberAccess", member.email), {
    email: member.email,
    wellnessBenefit: {
      active: decision.active,
      articleAccess: decision.active,
      accessScope: "sponsor-paid-articles",
      accessVersion: 1,
      source: decision.source,
      status: decision.active ? "active" : "inactive",
      linkedMemberLevel: member.memberLevel,
      qualifyingPurchaseAmount: decision.amount,
      qualificationReference: member.articleBenefitReference || "",
      confirmedBy: auth.currentUser?.email || "",
      confirmedAt: serverTimestamp(),
      startsAt: member.startsAt || member.firstJoinedAt || null,
      expiresAt: member.expiresAt || null
    },
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function disableWellnessArticleBenefit(email, reason = "membership-ended") {
  if (!email) return;
  await setDoc(doc(db, "sponsorMemberAccess", email), {
    email,
    wellnessBenefit: {
      active: false,
      articleAccess: false,
      accessScope: "sponsor-paid-articles",
      accessVersion: 1,
      source: "none",
      status: "ended",
      reason,
      endedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  }, { merge: true });
}
'''
changed |= replace_once("wellness-member-admin.js", old_sync, new_sync)

old_reset = '''  levelEl.value = "wellness";
  articleAccessEl.checked = false;
  articleAccessEl.disabled = true;
  document.getElementById("wellness-member-annual-spend").value = "0";
'''
new_reset = '''  levelEl.value = "wellness";
  stateEl.value = "active";
  qualifyingPurchaseEl.value = "0";
  articleReferenceEl.value = "";
  document.getElementById("wellness-member-annual-spend").value = "0";
'''
changed |= replace_once("wellness-member-admin.js", old_reset, new_reset)

old_reset_tail = '''  document.getElementById("wellness-member-lingji-from").value = "";
  document.getElementById("wellness-member-lingji-until").value = "";
}
'''
new_reset_tail = '''  document.getElementById("wellness-member-lingji-from").value = "";
  document.getElementById("wellness-member-lingji-until").value = "";
  updateArticleBenefitPreview();
}
'''
changed |= replace_once("wellness-member-admin.js", old_reset_tail, new_reset_tail)

old_payload_head = '''  const lingjiFromInput = document.getElementById("wellness-member-lingji-from").value;
  const lingjiUntilInput = document.getElementById("wellness-member-lingji-until").value;
  return {
'''
new_payload_head = '''  const lingjiFromInput = document.getElementById("wellness-member-lingji-from").value;
  const lingjiUntilInput = document.getElementById("wellness-member-lingji-until").value;
  const qualifyingSinglePurchaseAmount = Math.max(0, Number(qualifyingPurchaseEl.value) || 0);
  const decision = articleBenefitDecision({ memberLevel: level, status, qualifyingSinglePurchaseAmount });
  return {
'''
changed |= replace_once("wellness-member-admin.js", old_payload_head, new_payload_head)

old_payload_article = '''    lingjiValidUntil: dateInputToIso(lingjiUntilInput || (level === "lingji" ? currentCycleDefaults().end : ""), true),
    articleAccess: false,
    note: document.getElementById("wellness-member-note").value.trim(),
'''
new_payload_article = '''    lingjiValidUntil: dateInputToIso(lingjiUntilInput || (level === "lingji" ? currentCycleDefaults().end : ""), true),
    qualifyingSinglePurchaseAmount,
    articleBenefitReference: articleReferenceEl.value.trim(),
    articleBenefitSource: decision.source,
    articleBenefitEligible: decision.qualified,
    articleAccess: decision.active,
    note: document.getElementById("wellness-member-note").value.trim(),
'''
changed |= replace_once("wellness-member-admin.js", old_payload_article, new_payload_article)

old_save = '''  await setDoc(doc(db, "memberAccess", data.email), data, { merge: true });
  await writeWellnessHistory(data.email, data, "verified");
  if (originalEmail && originalEmail !== data.email) {
    await deleteDoc(doc(db, "memberAccess", originalEmail));
  }
  statusEl.textContent = "養生療癒會員資料已儲存；贊助文章權限由贊助會員名單獨立管理";
'''
new_save = '''  await setDoc(doc(db, "memberAccess", data.email), data, { merge: true });
  await syncWellnessArticleBenefit(data);
  await writeWellnessHistory(data.email, data, "verified");
  if (originalEmail && originalEmail !== data.email) {
    await disableWellnessArticleBenefit(originalEmail, "email-changed");
    await deleteDoc(doc(db, "memberAccess", originalEmail));
  }
  const decision = articleBenefitDecision({
    memberLevel: data.memberLevel,
    status: data.status,
    qualifyingSinglePurchaseAmount: data.qualifyingSinglePurchaseAmount
  });
  statusEl.textContent = decision.active
    ? "養生療癒會員資料已儲存，贊助文章閱讀權限已同步開通"
    : "養生療癒會員資料已儲存，目前未開通贊助文章閱讀權限";
'''
changed |= replace_once("wellness-member-admin.js", old_save, new_save)

old_checkout = '''      name: document.getElementById("wellness-member-name").value.trim(),
      memberLevel: levelEl.value === "lingji" ? "lingji" : "wellness",
      articleAccess: false
'''
new_checkout = '''      name: document.getElementById("wellness-member-name").value.trim(),
      memberLevel: levelEl.value === "lingji" ? "lingji" : "wellness",
      qualifyingSinglePurchaseAmount: Math.max(0, Number(qualifyingPurchaseEl.value) || 0),
      articleBenefitReference: articleReferenceEl.value.trim()
'''
changed |= replace_once("wellness-member-admin.js", old_checkout, new_checkout)

old_article_label = '''    const articleLabel = "不含贊助文章權限";
'''
new_article_label = '''    const benefit = articleBenefitDecision({
      memberLevel: level,
      status: member.status,
      qualifyingSinglePurchaseAmount: member.qualifyingSinglePurchaseAmount
    });
    const articleLabel = benefit.source === "lingji-member"
      ? benefit.active ? "贊助文章：靈極自動開通" : "贊助文章：待啟用"
      : benefit.source === "single-purchase-15000"
        ? benefit.active ? "贊助文章：單筆滿額開通" : "贊助文章：滿額待啟用"
        : "贊助文章：未符合";
'''
changed |= replace_once("wellness-member-admin.js", old_article_label, new_article_label)

old_edit = '''  document.getElementById("wellness-member-lingji-until").value = toDateInput(member.lingjiValidUntil);
  articleAccessEl.checked = false;
  document.getElementById("wellness-member-note").value = member.note || "";
  syncArticleAccess();
'''
new_edit = '''  document.getElementById("wellness-member-lingji-until").value = toDateInput(member.lingjiValidUntil);
  qualifyingPurchaseEl.value = Math.max(0, Number(member.qualifyingSinglePurchaseAmount) || 0);
  articleReferenceEl.value = member.articleBenefitReference || "";
  document.getElementById("wellness-member-note").value = member.note || "";
  updateArticleBenefitPreview();
'''
changed |= replace_once("wellness-member-admin.js", old_edit, new_edit)

old_delete = '''  if (member) await writeWellnessHistory(email, member, "ended");
  await deleteDoc(doc(db, "memberAccess", email));
'''
new_delete = '''  if (member) await writeWellnessHistory(email, member, "ended");
  await disableWellnessArticleBenefit(email, "membership-deleted");
  await deleteDoc(doc(db, "memberAccess", email));
'''
changed |= replace_once("wellness-member-admin.js", old_delete, new_delete)

old_events = '''resetButton?.addEventListener("click", resetForm);
levelEl?.addEventListener("change", syncArticleAccess);
sendPaymentButton?.addEventListener("click", () => createPaymentOrder().catch(showError));
'''
new_events = '''resetButton?.addEventListener("click", resetForm);
[levelEl, stateEl, qualifyingPurchaseEl,
  document.getElementById("wellness-member-starts-at"),
  document.getElementById("wellness-member-expires-at")
].forEach((element) => {
  element?.addEventListener("change", updateArticleBenefitPreview);
  element?.addEventListener("input", updateArticleBenefitPreview);
});
sendPaymentButton?.addEventListener("click", () => createPaymentOrder().catch(showError));
'''
changed |= replace_once("wellness-member-admin.js", old_events, new_events)

# Add article benefit details to verified wellness history snapshots.
old_history_fields = '''    lastOrderNo: member.lastOrderNo || "",
    verified: true,
'''
new_history_fields = '''    lastOrderNo: member.lastOrderNo || "",
    articleAccess: member.articleAccess === true,
    articleBenefitSource: member.articleBenefitSource || "none",
    qualifyingSinglePurchaseAmount: Math.max(0, Number(member.qualifyingSinglePurchaseAmount) || 0),
    articleBenefitReference: member.articleBenefitReference || "",
    verified: true,
'''
changed |= replace_once("wellness-member-admin.js", old_history_fields, new_history_fields)

# ---------------------------------------------------------------------------
# Article authorization: keep direct sponsor plans strict, and separately accept
# an active, cross-checked wellness benefit.
# ---------------------------------------------------------------------------
old_has_paid = '''function hasPaidAccess(articleId = "") {
  if (isAdminEmail(currentUser?.email)) return true;
  if (!currentUser?.email || !currentSponsorAccess) return false;

  const userEmail = currentUser.email.trim().toLowerCase();
  const recordEmail = String(currentSponsorAccess.email || "").trim().toLowerCase();
  if (!recordEmail || recordEmail !== userEmail) return false;
  if (currentSponsorAccess.memberType !== "sponsor-member") return false;
  if (currentSponsorAccess.status !== "active") return false;
  if (currentSponsorAccess.paymentStatus !== "paid") return false;
  if (currentSponsorAccess.articleAccess !== true) return false;
  if (currentSponsorAccess.accessScope !== "sponsor-paid-articles") return false;
  if (Number(currentSponsorAccess.accessVersion || 0) < 2) return false;
  if (!String(currentSponsorAccess.lastOrderNo || "").trim()) return false;
  if (currentSponsorAccess.revokedAt || currentSponsorAccess.suspended === true || currentSponsorAccess.disabled === true) return false;

  const now = new Date();
  const startsAt = memberAccessDate(currentSponsorAccess.startsAt);
  const expiresAt = memberAccessDate(currentSponsorAccess.expiresAt);
  if (startsAt && startsAt > now) return false;
  if (!expiresAt || expiresAt <= now) return false;

  const deniedArticleIds = Array.isArray(currentSponsorAccess.deniedArticleIds)
    ? currentSponsorAccess.deniedArticleIds.map(String)
    : [];
  if (articleId && deniedArticleIds.includes(String(articleId))) return false;

  const allowedArticleIds = Array.isArray(currentSponsorAccess.allowedArticleIds)
    ? currentSponsorAccess.allowedArticleIds.map(String)
    : [];
  if (allowedArticleIds.length > 0 && (!articleId || !allowedArticleIds.includes(String(articleId)))) return false;

  return true;
}
'''
new_has_paid = '''function hasDirectSponsorAccess(record, userEmail) {
  if (!record || record.memberType !== "sponsor-member") return false;
  if (record.status !== "active" || record.paymentStatus !== "paid") return false;
  if (record.articleAccess !== true || record.accessScope !== "sponsor-paid-articles") return false;
  if (Number(record.accessVersion || 0) < 2 || !String(record.lastOrderNo || "").trim()) return false;
  if (record.revokedAt || record.suspended === true || record.disabled === true) return false;
  const recordEmail = String(record.email || "").trim().toLowerCase();
  if (!recordEmail || recordEmail !== userEmail) return false;
  const now = new Date();
  const startsAt = memberAccessDate(record.startsAt);
  const expiresAt = memberAccessDate(record.expiresAt);
  return (!startsAt || startsAt <= now) && Boolean(expiresAt && expiresAt > now);
}

function hasWellnessArticleBenefit(record, member, userEmail) {
  const benefit = record?.wellnessBenefit;
  if (!benefit || benefit.active !== true || benefit.articleAccess !== true) return false;
  if (benefit.status !== "active" || benefit.accessScope !== "sponsor-paid-articles") return false;
  if (Number(benefit.accessVersion || 0) < 1) return false;
  if (String(record.email || "").trim().toLowerCase() !== userEmail) return false;
  if (!member || String(member.email || "").trim().toLowerCase() !== userEmail) return false;
  if (member.memberType !== "wellness-channel" || member.wellnessAccess !== true) return false;
  if (!["wellness", "lingji"].includes(member.memberLevel)) return false;
  if (member.status !== "active" || member.paymentStatus !== "paid") return false;
  if (member.revokedAt || member.suspended === true || member.disabled === true) return false;

  const now = new Date();
  const memberStart = memberAccessDate(member.startsAt || member.firstJoinedAt);
  const memberExpiry = memberAccessDate(member.expiresAt);
  const benefitStart = memberAccessDate(benefit.startsAt);
  const benefitExpiry = memberAccessDate(benefit.expiresAt);
  if (memberStart && memberStart > now) return false;
  if (!memberExpiry || memberExpiry <= now || !benefitExpiry || benefitExpiry <= now) return false;
  if (benefitStart && benefitStart > now) return false;
  if (benefitExpiry.getTime() > memberExpiry.getTime() + 60000) return false;
  if (benefit.linkedMemberLevel !== member.memberLevel) return false;

  if (benefit.source === "lingji-member") return member.memberLevel === "lingji";
  if (benefit.source === "single-purchase-15000") {
    return Number(benefit.qualifyingPurchaseAmount || 0) >= 15000
      && Boolean(String(benefit.confirmedBy || "").trim())
      && Boolean(memberAccessDate(benefit.confirmedAt));
  }
  return false;
}

function hasPaidAccess(articleId = "") {
  if (isAdminEmail(currentUser?.email)) return true;
  if (!currentUser?.email || !currentSponsorAccess) return false;

  const userEmail = currentUser.email.trim().toLowerCase();
  const directAccess = hasDirectSponsorAccess(currentSponsorAccess, userEmail);
  const wellnessAccess = hasWellnessArticleBenefit(currentSponsorAccess, currentMemberAccess, userEmail);
  if (!directAccess && !wellnessAccess) return false;

  const entitlement = directAccess ? currentSponsorAccess : currentSponsorAccess.wellnessBenefit;
  const deniedArticleIds = Array.isArray(entitlement.deniedArticleIds)
    ? entitlement.deniedArticleIds.map(String)
    : [];
  if (articleId && deniedArticleIds.includes(String(articleId))) return false;

  const allowedArticleIds = Array.isArray(entitlement.allowedArticleIds)
    ? entitlement.allowedArticleIds.map(String)
    : [];
  if (allowedArticleIds.length > 0 && (!articleId || !allowedArticleIds.includes(String(articleId)))) return false;

  return true;
}
'''
changed |= replace_once("articles.js", old_has_paid, new_has_paid)

# ---------------------------------------------------------------------------
# Member center: show the benefit source and period.
# ---------------------------------------------------------------------------
member_anchor = '''function isActiveSponsorMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim())
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && Boolean(expiry && expiry > new Date());
}
'''
member_helpers = member_anchor + '''
function activeWellnessArticleBenefit(sponsorMember = {}, member = {}) {
  const benefit = sponsorMember?.wellnessBenefit;
  if (!benefit || benefit.active !== true || benefit.articleAccess !== true || benefit.status !== "active") return null;
  if (benefit.accessScope !== "sponsor-paid-articles" || Number(benefit.accessVersion || 0) < 1) return null;
  if (!isActiveWellnessMember(member) || benefit.linkedMemberLevel !== member.memberLevel) return null;
  const memberExpiry = toDate(member.expiresAt);
  const benefitExpiry = toDate(benefit.expiresAt);
  if (!memberExpiry || !benefitExpiry || benefitExpiry <= new Date()) return null;
  if (benefitExpiry.getTime() > memberExpiry.getTime() + 60000) return null;
  if (benefit.source === "lingji-member" && member.memberLevel === "lingji") return benefit;
  if (benefit.source === "single-purchase-15000"
      && Number(benefit.qualifyingPurchaseAmount || 0) >= 15000
      && benefit.confirmedBy
      && benefit.confirmedAt) return benefit;
  return null;
}
'''
changed |= replace_once("member-dashboard.js", member_anchor, member_helpers)

old_render_access = '''  const sponsorRecord = sponsorMember || (member.memberType === "sponsor-member" ? member : null);
  const sponsorActive = Boolean(sponsorRecord && isActiveSponsorMember(sponsorRecord));
  const sponsorOnly = sponsorActive && !wellnessActive;
  const articleActive = sponsorActive;
  const articleExpiry = sponsorActive ? formatDate(sponsorRecord.expiresAt) : "未設定";
'''
new_render_access = '''  const sponsorRecord = sponsorMember || (member.memberType === "sponsor-member" ? member : null);
  const sponsorActive = Boolean(sponsorRecord && isActiveSponsorMember(sponsorRecord));
  const wellnessArticleBenefit = activeWellnessArticleBenefit(sponsorRecord, member);
  const sponsorOnly = sponsorActive && !wellnessActive;
  const articleActive = sponsorActive || Boolean(wellnessArticleBenefit);
  const articleExpiry = sponsorActive
    ? formatDate(sponsorRecord.expiresAt)
    : wellnessArticleBenefit
      ? formatDate(wellnessArticleBenefit.expiresAt)
      : "未設定";
  const articleSource = sponsorActive
    ? "贊助閱讀方案"
    : wellnessArticleBenefit?.source === "lingji-member"
      ? "靈極會員加贈"
      : wellnessArticleBenefit
        ? "一般會員單筆滿額加贈"
        : "";
'''
changed |= replace_once("member-dashboard.js", old_render_access, new_render_access)

old_dashboard_label = '''  document.getElementById("dashboard-article-access").textContent = articleActive ? `閱讀資格有效｜至 ${articleExpiry}` : "尚未開通";
'''
new_dashboard_label = '''  document.getElementById("dashboard-article-access").textContent = articleActive ? `${articleSource}｜至 ${articleExpiry}` : "尚未開通";
'''
changed |= replace_once("member-dashboard.js", old_dashboard_label, new_dashboard_label)

# ---------------------------------------------------------------------------
# Backend checkout/callback: carry the benefit decision into paid activation.
# ---------------------------------------------------------------------------
old_backend_constants = '''const DEFAULT_PRICE = 6000;
const DEFAULT_MONTHS = 4;
'''
new_backend_constants = '''const DEFAULT_PRICE = 6000;
const DEFAULT_MONTHS = 4;
const ARTICLE_BENEFIT_THRESHOLD = 15000;
'''
changed |= replace_once("functions/index.js", old_backend_constants, new_backend_constants)

old_checkout_vars = '''    const memberLevel = request.data?.memberLevel === "lingji" ? "lingji" : "wellness";
    const articleAccess = false;
'''
new_checkout_vars = '''    const memberLevel = request.data?.memberLevel === "lingji" ? "lingji" : "wellness";
    const qualifyingSinglePurchaseAmount = Math.max(0, Number(request.data?.qualifyingSinglePurchaseAmount) || 0);
    const articleBenefitReference = cleanText(request.data?.articleBenefitReference, 100);
    const articleBenefitSource = memberLevel === "lingji"
      ? "lingji-member"
      : qualifyingSinglePurchaseAmount >= ARTICLE_BENEFIT_THRESHOLD
        ? "single-purchase-15000"
        : "none";
    const articleAccess = false;
'''
changed |= replace_once("functions/index.js", old_checkout_vars, new_checkout_vars)

old_order_fields = '''      memberLevel,
      articleAccess,
      memberType: "wellness-channel",
'''
new_order_fields = '''      memberLevel,
      articleAccess,
      articleBenefitSource,
      qualifyingSinglePurchaseAmount,
      articleBenefitReference,
      memberType: "wellness-channel",
'''
changed |= replace_once("functions/index.js", old_order_fields, new_order_fields)

old_pending_fields = '''      wellnessLevel: memberLevel,
      articleAccess,
      planMonths,
'''
new_pending_fields = '''      wellnessLevel: memberLevel,
      articleAccess,
      articleBenefitSource,
      articleBenefitEligible: articleBenefitSource !== "none",
      qualifyingSinglePurchaseAmount,
      articleBenefitReference,
      planMonths,
'''
changed |= replace_once("functions/index.js", old_pending_fields, new_pending_fields)

old_callback_else = '''        } else {
          activeMember.wellnessAccess = true;
          activeMember.memberLevel = order.memberLevel;
          activeMember.wellnessLevel = order.memberLevel;
          activeMember.articleAccess = false;
        }
        transaction.set(memberRef, activeMember, { merge: true });
'''
new_callback_else = '''        } else {
          const qualifyingSinglePurchaseAmount = Math.max(0, Number(order.qualifyingSinglePurchaseAmount) || 0);
          const articleBenefitSource = order.memberLevel === "lingji"
            ? "lingji-member"
            : qualifyingSinglePurchaseAmount >= ARTICLE_BENEFIT_THRESHOLD
              ? "single-purchase-15000"
              : "none";
          const articleBenefitEligible = articleBenefitSource !== "none";
          activeMember.wellnessAccess = true;
          activeMember.memberLevel = order.memberLevel;
          activeMember.wellnessLevel = order.memberLevel;
          activeMember.qualifyingSinglePurchaseAmount = qualifyingSinglePurchaseAmount;
          activeMember.articleBenefitReference = order.articleBenefitReference || "";
          activeMember.articleBenefitSource = articleBenefitSource;
          activeMember.articleBenefitEligible = articleBenefitEligible;
          activeMember.articleAccess = articleBenefitEligible;

          transaction.set(db.doc(`sponsorMemberAccess/${order.email}`), {
            email: order.email,
            wellnessBenefit: {
              active: articleBenefitEligible,
              articleAccess: articleBenefitEligible,
              accessScope: "sponsor-paid-articles",
              accessVersion: 1,
              source: articleBenefitSource,
              status: articleBenefitEligible ? "active" : "inactive",
              linkedMemberLevel: order.memberLevel,
              qualifyingPurchaseAmount: qualifyingSinglePurchaseAmount,
              qualificationReference: order.articleBenefitReference || "",
              confirmedBy: normalizeEmail(order.createdBy || "system-payment"),
              confirmedAt: nowTimestamp,
              startsAt: nowTimestamp,
              expiresAt: expiryTimestamp
            },
            updatedAt: nowTimestamp
          }, { merge: true });
        }
        transaction.set(memberRef, activeMember, { merge: true });
'''
changed |= replace_once("functions/index.js", old_callback_else, new_callback_else)

# Include benefit details in payment-created wellness history.
old_history_wellness = '''        } else {
          historyRecord.wellnessAccess = true;
          historyRecord.memberLevel = order.memberLevel;
        }
'''
new_history_wellness = '''        } else {
          historyRecord.wellnessAccess = true;
          historyRecord.memberLevel = order.memberLevel;
          historyRecord.articleAccess = activeMember.articleAccess === true;
          historyRecord.articleBenefitSource = activeMember.articleBenefitSource || "none";
          historyRecord.qualifyingSinglePurchaseAmount = Math.max(0, Number(activeMember.qualifyingSinglePurchaseAmount) || 0);
          historyRecord.articleBenefitReference = activeMember.articleBenefitReference || "";
        }
'''
changed |= replace_once("functions/index.js", old_history_wellness, new_history_wellness)

# Cache bust the three affected frontends.
changed |= regex_once("admin.html", r'(wellness-member-admin\.js\?v=)[^"\']+', r'\g<1>20260804-article-benefit-1')
changed |= regex_once("articles.html", r'(articles\.js\?v=)[^"\']+', r'\g<1>20260804-article-benefit-1')
changed |= regex_once("member-dashboard.html", r'(member-dashboard\.js\?v=)[^"\']+', r'\g<1>20260804-article-benefit-1')

print("Wellness article benefit management applied." if changed else "No changes required.")
