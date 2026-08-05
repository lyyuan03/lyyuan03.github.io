from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all_exact(path: str, old: str, new: str, expected: int) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text and old not in text:
        return
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} exact matches, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")


def sub_once(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}")
    p.write_text(updated, encoding="utf-8")


# 1. Offer settings now carry a 24-hour reservation window.
replace_once(
    "functions/membership-plans.js",
    '    regularPrice3: positiveInteger(settings.sponsorRegularPrice3, SPONSOR_REGULAR_PLANS[3]),\n    paymentDays: positiveInteger(settings.paymentDays, 3)\n',
    '    regularPrice3: positiveInteger(settings.sponsorRegularPrice3, SPONSOR_REGULAR_PLANS[3]),\n    paymentDays: positiveInteger(settings.paymentDays, 3),\n    reservationHours: positiveInteger(settings.sponsorReservationHours, 24)\n'
)

# 2. Admin UI: two fixed ECPay links and a reservation-hours setting.
replace_once(
    "admin.html",
    '''                <div class="field"><label for="payment-days">付款期限（天）</label><input id="payment-days" type="number" min="1" max="30" value="3"></div>
              </div>
              <div class="field"><label for="ecpay-url">綠界付款連結</label><input id="ecpay-url" type="url" placeholder="https://..."></div>
              <button class="btn primary" type="submit">儲存方案設定</button>
              <p class="membership-help">綠界若為不同金額提供不同連結，可在建立單一會員時改填該筆專用網址。</p>
''',
    '''                <div class="field"><label for="sponsor-reservation-hours">優惠名額保留期限（小時）</label><input id="sponsor-reservation-hours" type="number" min="1" max="168" value="24"></div>
              </div>
              <div class="field"><label for="ecpay-url">前200名優惠付款連結</label><input id="ecpay-url" type="url" placeholder="https://p.ecpay.com.tw/..."></div>
              <div class="field"><label for="regular-ecpay-url">第201名起一般價格付款連結</label><input id="regular-ecpay-url" type="url" placeholder="https://p.ecpay.com.tw/..."></div>
              <button class="btn primary" type="submit">儲存方案設定</button>
              <p class="membership-help">兩個綠界連結內都需可選擇一個月與三個月方案。系統會在會員按下付款時重新確認名額，前200人次導向優惠連結，第201人次起自動導向一般價格連結。</p>
'''
)

# 3. Admin logic: manage both URLs, preserve the current URL as the promo URL, and group pending/formal members.
replace_once(
    "membership-admin.js",
    '''  sponsorRegularPrice3: 400,
  paymentDays: 3,
  ecpayUrl: ""
''',
    '''  sponsorRegularPrice3: 400,
  paymentDays: 3,
  reservationHours: 24,
  sponsorPromoPaymentUrl: "",
  sponsorRegularPaymentUrl: "",
  ecpayUrl: ""
'''
)
replace_once(
    "membership-admin.js",
    '  if (!paymentUrlEl.value) paymentUrlEl.value = settings.ecpayUrl || "";\n',
    '  if (!paymentUrlEl.value) paymentUrlEl.value = currentTier() === "promo" ? settings.sponsorPromoPaymentUrl : settings.sponsorRegularPaymentUrl;\n'
)
replace_once(
    "membership-admin.js",
    '  paymentUrlEl.value = settings.ecpayUrl || "";\n',
    '  paymentUrlEl.value = currentTier() === "promo" ? settings.sponsorPromoPaymentUrl : settings.sponsorRegularPaymentUrl;\n'
)
replace_once(
    "membership-admin.js",
    '''    sponsorRegularPrice3: positiveInteger(stored.sponsorRegularPrice3, 400),
    sponsorPromoLimit: positiveInteger(stored.sponsorPromoLimit, 200)
  };
''',
    '''    sponsorRegularPrice3: positiveInteger(stored.sponsorRegularPrice3, 400),
    sponsorPromoLimit: positiveInteger(stored.sponsorPromoLimit, 200),
    reservationHours: positiveInteger(stored.sponsorReservationHours, 24),
    sponsorPromoPaymentUrl: String(stored.sponsorPromoPaymentUrl || stored.ecpayUrl || "").trim(),
    sponsorRegularPaymentUrl: String(stored.sponsorRegularPaymentUrl || "").trim()
  };
'''
)
replace_once(
    "membership-admin.js",
    '''  document.getElementById("sponsor-promo-limit").value = String(settings.sponsorPromoLimit);
  document.getElementById("payment-days").value = settings.paymentDays || 3;
  document.getElementById("ecpay-url").value = settings.ecpayUrl || "";
''',
    '''  document.getElementById("sponsor-promo-limit").value = String(settings.sponsorPromoLimit);
  document.getElementById("sponsor-reservation-hours").value = String(settings.reservationHours || 24);
  document.getElementById("ecpay-url").value = settings.sponsorPromoPaymentUrl || "";
  document.getElementById("regular-ecpay-url").value = settings.sponsorRegularPaymentUrl || "";
'''
)
replace_once(
    "membership-admin.js",
    '''    sponsorPromoLimit: positiveInteger(document.getElementById("sponsor-promo-limit").value, 200),
    paymentDays: positiveInteger(document.getElementById("payment-days").value, 3),
    ecpayUrl: document.getElementById("ecpay-url").value.trim(),
    updatedAt: serverTimestamp()
''',
    '''    sponsorPromoLimit: positiveInteger(document.getElementById("sponsor-promo-limit").value, 200),
    sponsorReservationHours: positiveInteger(document.getElementById("sponsor-reservation-hours").value, 24),
    sponsorPromoPaymentUrl: document.getElementById("ecpay-url").value.trim(),
    sponsorRegularPaymentUrl: document.getElementById("regular-ecpay-url").value.trim(),
    ecpayUrl: document.getElementById("ecpay-url").value.trim(),
    updatedAt: serverTimestamp()
'''
)
replace_once(
    "membership-admin.js",
    '  statusEl.textContent = "方案與前200名優惠設定已儲存";\n',
    '  statusEl.textContent = "方案、優惠名額與兩組綠界付款連結已儲存";\n'
)
replace_once(
    "membership-admin.js",
    '''      planMonths: selectedMonths(),
      note: document.getElementById("member-note").value.trim()
''',
    '''      planMonths: selectedMonths(),
      pendingOrderNo: members.find((item) => item.email === normalizeEmail(document.getElementById("member-email").value))?.pendingOrderNo || "",
      note: document.getElementById("member-note").value.trim()
'''
)
replace_once(
    "membership-admin.js",
    '''function paymentDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + Number(settings.paymentDays || 3));
  return formatDate(date);
}
''',
    '''function paymentDeadline() {
  const date = new Date(Date.now() + Number(settings.reservationHours || 24) * 60 * 60 * 1000);
  return formatDate(date);
}
'''
)
replace_once(
    "membership-admin.js",
    '  paymentUrlEl.value = member.paymentUrl || settings.ecpayUrl || "";\n',
    '  paymentUrlEl.value = member.pendingPaymentUrl || member.paymentUrl || (member.pendingPriceTier === "regular" ? settings.sponsorRegularPaymentUrl : settings.sponsorPromoPaymentUrl) || "";\n'
)

sub_once(
    "membership-admin.js",
    r'function renderMembers\(\) \{.*?\n\}\n\nfunction editMember',
    '''function renderMembers() {
  if (!members.length) {
    listEl.innerHTML = '<div class="empty">目前尚無贊助會員資料；此時任何一般登入帳號都不會取得贊助文章閱讀權限。</div>';
    return;
  }
  const pendingMembers = members.filter((member) => member.paymentStatus === "pending" || member.status === "pending");
  const formalMembers = members.filter((member) => !pendingMembers.includes(member));
  const renderRow = (member, pending = false) => {
    const active = hasAuthoritativeSponsorAccess(member);
    const label = pending ? "待核對付款" : active ? "有效" : member.status === "active" ? "權限資料不完整" : "已到期";
    const months = Number(pending ? member.pendingPlanMonths || member.planMonths : member.planMonths || 0);
    const amount = Number(pending ? member.pendingAmount || member.amount : member.amount || 0);
    const priceTier = pending ? member.pendingPriceTier || member.priceTier : member.priceTier;
    const sequence = pending ? member.pendingPromotionSequence || member.promotionSequence : member.promotionSequence;
    const tier = priceTier === "regular" ? "一般價" : sequence ? `優惠第${Number(sequence)}名` : "優惠價／舊資料";
    const deadline = pending && member.pendingPaymentDeadline ? `｜名額保留至 ${escapeHtml(formatDate(member.pendingPaymentDeadline))}` : "";
    return `<div class="member-row">
      <div>
        <strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(label)}</strong>
        <small>${escapeHtml(member.email)}｜${months}個月｜NT$${amount.toLocaleString("zh-TW")}｜${escapeHtml(tier)}${deadline}${pending ? "" : `｜到期 ${escapeHtml(formatDate(member.expiresAt))}`}</small>
      </div>
      <div class="member-row-actions">
        <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">${pending ? "核對／開通" : "編輯"}</button>
        <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>
      </div>
    </div>`;
  };
  const section = (title, note, items, pending) => `
    <section style="margin-bottom:24px">
      <h4 style="margin:0 0 6px;color:#CBAA77;font-size:17px">${title}（${items.length}）</h4>
      <p class="membership-help" style="margin-top:0">${note}</p>
      ${items.length ? items.map((member) => renderRow(member, pending)).join("") : '<div class="empty">目前沒有資料</div>'}
    </section>`;
  listEl.innerHTML = section("待核對付款", "收到綠界付款通知後，按「核對／開通」，確認 Email、方案及金額，再按「確認付款並開通」。", pendingMembers, true)
    + section("正式會員名單", "只有完成付款確認的會員，才會取得贊助文章閱讀權限與會員卡。", formalMembers, false);
  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));
  listEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.delete)));
}

function editMember'''
)

# 4. Public checkout: reserve the tier, record the request, then redirect to the configured fixed ECPay link.
replace_once(
    "functions/public-sponsor-checkout-functions.js",
    'const ecpayConfig = defineJsonSecret("ECPAY_CONFIG");\nconst smtpConfig = defineJsonSecret("SMTP_CONFIG");\n',
    'const smtpConfig = defineJsonSecret("SMTP_CONFIG");\n'
)
replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '''function cleanText(value = "", maximum = 100) {
  return String(value).replace(/[\\u0000-\\u001f\\u007f<>]/g, " ").trim().slice(0, maximum);
}
''',
    '''function cleanText(value = "", maximum = 100) {
  return String(value).replace(/[\\u0000-\\u001f\\u007f<>]/g, " ").trim().slice(0, maximum);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safePaymentUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
'''
)
replace_all_exact(
    "functions/public-sponsor-checkout-functions.js",
    '付款成功後，系統會自動開通閱讀資格。請使用本信收件 Email 登入靈元院官網。',
    '付款完成後，靈元院行政團隊會核對款項並開通閱讀資格。請使用本信收件 Email 登入靈元院官網。',
    2
)
replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '''  const settings = normalizeSponsorOfferSettings(settingsSnapshot.data() || {});
  const now = Date.now();
''',
    '''  const rawSettings = settingsSnapshot.data() || {};
  const settings = {
    ...normalizeSponsorOfferSettings(rawSettings),
    reservationHours: positiveInteger(rawSettings.sponsorReservationHours, 24),
    promoPaymentUrl: safePaymentUrl(rawSettings.sponsorPromoPaymentUrl || rawSettings.ecpayUrl),
    regularPaymentUrl: safePaymentUrl(rawSettings.sponsorRegularPaymentUrl)
  };
  const now = Date.now();
'''
)
sub_once(
    "functions/public-sponsor-checkout-functions.js",
    r'function paymentUrlFor\(tradeNo, paymentToken\) \{.*?\n\}',
    '''function paymentUrlForTier(settings, priceTier) {
  return priceTier === "promo" ? settings.promoPaymentUrl : settings.regularPaymentUrl;
}'''
)

public_checkout = r'''exports.createPublicSponsorCheckout = onCall(
  {
    region: REGION,
    secrets: [smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    const email = normalizeEmail(request.auth?.token?.email);
    const uid = cleanText(request.auth?.uid, 128);
    const name = cleanText(request.data?.name || request.auth?.token?.name || "", 60);
    const planMonths = Number(request.data?.planMonths);

    if (!request.auth || !email || !email.includes("@")) {
      throw new HttpsError("unauthenticated", "請先使用將來閱讀文章的 Email 登入會員帳號。");
    }
    if (request.auth.token.email_verified === false) {
      throw new HttpsError("failed-precondition", "請先完成 Email 驗證後再建立付款申請。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "目前僅提供一個月或三個月方案。");
    }

    const memberRef = db.doc(`sponsorMemberAccess/${email}`);
    const newTradeNo = createMerchantTradeNo();
    const newOrderRef = db.doc(`membershipOrders/${newTradeNo}`);

    const checkout = await db.runTransaction(async (transaction) => {
      const memberSnapshot = await transaction.get(memberRef);
      const member = memberSnapshot.data() || {};
      const existingOrderNo = cleanText(member.pendingOrderNo, 20);
      let existingOrderSnapshot = null;
      let existingOrder = null;

      if (existingOrderNo) {
        existingOrderSnapshot = await transaction.get(db.doc(`membershipOrders/${existingOrderNo}`));
        existingOrder = existingOrderSnapshot.exists ? existingOrderSnapshot.data() : null;
      }

      const existingIsReusable = Boolean(
        existingOrder
        && existingOrder.memberType === "sponsor-member"
        && existingOrder.email === email
        && existingOrder.status === "pending"
        && millis(existingOrder.paymentLinkExpiresAt) > Date.now()
        && Number(existingOrder.planMonths) === planMonths
        && safePaymentUrl(existingOrder.externalPaymentUrl)
      );

      if (existingIsReusable) {
        const status = await readOfferStatus(transaction);
        return {
          merchantTradeNo: existingOrderNo,
          paymentUrl: safePaymentUrl(existingOrder.externalPaymentUrl),
          amount: Number(existingOrder.amount),
          planMonths: Number(existingOrder.planMonths),
          priceTier: existingOrder.priceTier || "regular",
          promotionSequence: existingOrder.promotionSequence || null,
          paymentLinkExpiresAt: existingOrder.paymentLinkExpiresAt,
          offerRemaining: status.remaining,
          reused: true
        };
      }

      const excludeExistingOrder = existingOrder
        && existingOrder.status === "pending"
        && millis(existingOrder.paymentLinkExpiresAt) > Date.now()
        ? existingOrderNo
        : "";
      const status = await readOfferStatus(transaction, excludeExistingOrder);
      const priceTier = status.promotionAvailable ? "promo" : "regular";
      const paymentUrl = paymentUrlForTier(status.settings, priceTier);
      if (!paymentUrl) {
        throw new HttpsError(
          "failed-precondition",
          priceTier === "promo" ? "優惠價綠界付款連結尚未設定。" : "一般價綠界付款連結尚未設定。"
        );
      }
      const amount = sponsorPlanAmount(planMonths, priceTier, status.settings);
      const now = Timestamp.now();
      const paymentLinkExpiresAt = Timestamp.fromMillis(
        now.toMillis() + status.settings.reservationHours * 60 * 60 * 1000
      );
      const promotionSequence = priceTier === "promo" ? status.occupiedCount + 1 : null;
      const existingExpiry = dateValue(member.expiresAt);
      const preserveActiveMembership = member.status === "active"
        && existingExpiry
        && existingExpiry > now.toDate();

      if (existingOrderSnapshot?.exists && existingOrder?.status === "pending") {
        transaction.update(existingOrderSnapshot.ref, {
          status: millis(existingOrder.paymentLinkExpiresAt) > Date.now() ? "cancelled" : "expired",
          replacedByOrderNo: newTradeNo,
          updatedAt: now
        });
      }

      transaction.create(newOrderRef, {
        merchantTradeNo: newTradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: false,
        wellnessAccess: false,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "pending",
        manualPaymentReview: true,
        paymentProvider: "ecpay-fixed-link",
        externalPaymentUrl: paymentUrl,
        paymentLinkExpiresAt,
        createdBy: `self-service:${uid || email}`,
        createdAt: now,
        updatedAt: now
      });

      const pendingMember = {
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: preserveActiveMembership,
        wellnessAccess: false,
        pendingPlanMonths: planMonths,
        pendingAmount: amount,
        pendingPriceTier: priceTier,
        pendingPromotionSequence: promotionSequence,
        pendingOrderNo: newTradeNo,
        pendingPaymentUrl: paymentUrl,
        pendingPaymentDeadline: paymentLinkExpiresAt,
        updatedAt: now
      };
      if (!preserveActiveMembership) {
        Object.assign(pendingMember, {
          planMonths,
          amount,
          priceTier,
          promotionSequence,
          paymentStatus: "pending",
          status: "pending"
        });
      }
      transaction.set(memberRef, pendingMember, { merge: true });

      return {
        merchantTradeNo: newTradeNo,
        paymentUrl,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        paymentLinkExpiresAt,
        offerRemaining: Math.max(0, status.remaining - (priceTier === "promo" ? 1 : 0)),
        reused: false
      };
    });

    let emailSent = false;
    if (!checkout.reused) {
      try {
        await sendReservationEmail({
          email,
          name,
          amount: checkout.amount,
          months: checkout.planMonths,
          paymentUrl: checkout.paymentUrl,
          priceTier: checkout.priceTier,
          promotionSequence: checkout.promotionSequence,
          expiresAt: checkout.paymentLinkExpiresAt.toDate()
        });
        emailSent = true;
        await db.doc(`membershipOrders/${checkout.merchantTradeNo}`).update({
          emailStatus: "sent",
          emailSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Public sponsor reservation email failed", {
          tradeNo: checkout.merchantTradeNo,
          error
        });
        await db.doc(`membershipOrders/${checkout.merchantTradeNo}`).update({
          emailStatus: "error",
          emailError: cleanText(error.message, 300),
          updatedAt: FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }

    return {
      merchantTradeNo: checkout.merchantTradeNo,
      paymentUrl: checkout.paymentUrl,
      amount: checkout.amount,
      planMonths: checkout.planMonths,
      priceTier: checkout.priceTier,
      promotionSequence: checkout.promotionSequence,
      offerRemaining: checkout.offerRemaining,
      paymentDeadline: checkout.paymentLinkExpiresAt.toDate().toISOString(),
      manualPaymentReview: true,
      reused: checkout.reused,
      emailSent
    };
  }
);'''
sub_once(
    "functions/public-sponsor-checkout-functions.js",
    r'exports\.createPublicSponsorCheckout = onCall\(.*?\n\);\n\nexports\.expireSponsorCheckoutReservations = onSchedule',
    public_checkout + '\n\nexports.expireSponsorCheckoutReservations = onSchedule'
)

# 5. Manual activation consumes the existing reservation instead of recalculating it as a new customer.
manual_activation = r'''exports.activateSponsorMembershipManually = onCall(
  {
    region: REGION,
    secrets: [smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    if (!isAdminRequest(request)) {
      throw new HttpsError("permission-denied", "僅限靈元院管理員手動開通會員。");
    }

    const email = normalizeEmail(request.data?.email);
    const name = cleanText(request.data?.name, 60);
    const note = cleanText(request.data?.note, 500);
    const planMonths = Number(request.data?.planMonths);
    const requestedPendingOrderNo = cleanText(request.data?.pendingOrderNo, 20);
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "請填寫有效的會員 Email。");
    }
    if (![1, 3].includes(planMonths)) {
      throw new HttpsError("invalid-argument", "贊助會員目前僅提供一個月或三個月方案。");
    }

    const fallbackTradeNo = createMerchantTradeNo();
    const memberRef = db.doc(`sponsorMemberAccess/${email}`);

    const activation = await db.runTransaction(async (transaction) => {
      const memberSnapshot = await transaction.get(memberRef);
      const member = memberSnapshot.data() || {};
      const pendingOrderNo = requestedPendingOrderNo || cleanText(member.pendingOrderNo, 20);
      const pendingOrderRef = pendingOrderNo ? db.doc(`membershipOrders/${pendingOrderNo}`) : null;
      const pendingOrderSnapshot = pendingOrderRef ? await transaction.get(pendingOrderRef) : null;
      const pendingOrder = pendingOrderSnapshot?.exists ? pendingOrderSnapshot.data() : null;
      const lockedReservation = Boolean(
        pendingOrder
        && pendingOrder.memberType === "sponsor-member"
        && normalizeEmail(pendingOrder.email) === email
        && ["pending", "expired"].includes(pendingOrder.status)
      );
      const status = await readSponsorOfferStatus(transaction);
      const priceTier = lockedReservation
        ? (pendingOrder.priceTier === "regular" ? "regular" : "promo")
        : (status.promotionAvailable ? "promo" : "regular");
      const amount = sponsorPlanAmount(planMonths, priceTier, status.settings);
      const promotionSequence = lockedReservation
        ? (pendingOrder.promotionSequence || null)
        : (priceTier === "promo" ? status.occupiedCount + 1 : null);
      const tradeNo = lockedReservation ? pendingOrderNo : fallbackTradeNo;
      const orderRef = lockedReservation ? pendingOrderRef : db.doc(`membershipOrders/${tradeNo}`);
      const now = new Date();
      const existingExpiry = dateValue(member.expiresAt);
      const startAt = existingExpiry && existingExpiry > now ? existingExpiry : now;
      const expiresAt = addMonths(startAt, planMonths);
      const nowTimestamp = Timestamp.fromDate(now);
      const expiryTimestamp = Timestamp.fromDate(expiresAt);

      const paidOrder = {
        merchantTradeNo: tradeNo,
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "paid",
        paidAt: nowTimestamp,
        paymentType: lockedReservation ? "manual-confirm-fixed-link" : "manual-admin",
        manualActivation: true,
        manualPaymentReview: lockedReservation,
        confirmedBy: normalizeEmail(request.auth.token.email),
        updatedAt: nowTimestamp
      };
      if (lockedReservation) {
        transaction.set(orderRef, paidOrder, { merge: true });
      } else {
        transaction.create(orderRef, {
          ...paidOrder,
          createdBy: normalizeEmail(request.auth.token.email),
          createdAt: nowTimestamp
        });
      }

      transaction.set(memberRef, {
        email,
        name,
        memberType: "sponsor-member",
        articleAccess: true,
        wellnessAccess: false,
        accessScope: "sponsor-paid-articles",
        accessVersion: 2,
        planMonths,
        amount,
        priceTier,
        promotionSequence,
        paymentStatus: "paid",
        status: "active",
        disabled: false,
        suspended: false,
        revokedAt: FieldValue.delete(),
        firstJoinedAt: member.firstJoinedAt || nowTimestamp,
        startsAt: nowTimestamp,
        expiresAt: expiryTimestamp,
        paidAt: nowTimestamp,
        lastOrderNo: tradeNo,
        pendingOrderNo: FieldValue.delete(),
        pendingPlanMonths: FieldValue.delete(),
        pendingAmount: FieldValue.delete(),
        pendingPriceTier: FieldValue.delete(),
        pendingPromotionSequence: FieldValue.delete(),
        pendingPaymentUrl: FieldValue.delete(),
        pendingPaymentDeadline: FieldValue.delete(),
        note,
        updatedAt: nowTimestamp
      }, { merge: true });
      transaction.set(db.doc(`membershipHistory/${email}`), {
        email,
        sponsor: {
          memberType: "sponsor-member",
          articleAccess: true,
          accessScope: "sponsor-paid-articles",
          accessVersion: 2,
          paymentStatus: "paid",
          startsAt: nowTimestamp,
          expiresAt: expiryTimestamp,
          lastOrderNo: tradeNo,
          verified: true,
          historicalStatus: "verified",
          verificationSource: lockedReservation ? "manual-confirm-fixed-link" : "manual-admin",
          recordedAt: nowTimestamp
        },
        updatedAt: nowTimestamp
      }, { merge: true });

      return {
        email,
        name,
        expiresAt,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        offerRemaining: lockedReservation ? status.remaining : Math.max(0, status.remaining - (priceTier === "promo" ? 1 : 0)),
        merchantTradeNo: tradeNo
      };
    });

    const orderRef = db.doc(`membershipOrders/${activation.merchantTradeNo}`);
    try {
      await sendSponsorActivationEmail(activation);
      await orderRef.update({
        activationEmailStatus: "sent",
        activationEmailSentAt: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Manual sponsor activation email failed", { tradeNo: activation.merchantTradeNo, error });
      await orderRef.update({
        activationEmailStatus: "error",
        activationEmailError: cleanText(error.message, 300)
      });
    }

    return activation;
  }
);'''
sub_once(
    "functions/sponsor-offer-functions.js",
    r'exports\.activateSponsorMembershipManually = onCall\(.*?\n\);\s*$',
    manual_activation + '\n'
)

# 6. Front-end: one confirmation click reserves the correct tier and immediately redirects.
replace_once(
    "sponsor-checkout.js",
    '    <p>系統將以您目前登入的 Email 建立專屬訂單，並在建立當下自動判斷是否仍在前 200 名優惠內。</p>',
    '    <p>系統會以您目前登入的 Email 保留方案，並在按下付款時重新確認是否仍在前 200 名優惠內；接著直接前往綠界付款。</p>'
)
replace_once(
    "sponsor-checkout.js",
    '    <div id="sponsor-checkout-status" class="sponsor-checkout-status">建立訂單後，系統會顯示您實際取得的價格與優惠序號。</div>\n    <button class="sponsor-checkout-primary" type="button" data-sponsor-confirm>建立專屬訂單並保留名額</button>',
    '    <div id="sponsor-checkout-status" class="sponsor-checkout-status">付款完成後，靈元院行政團隊核對款項，才會正式開通閱讀資格。</div>\n    <button class="sponsor-checkout-primary" type="button" data-sponsor-confirm>立即前往綠界付款</button>'
)
replace_once(
    "sponsor-checkout.js",
    '    <p style="margin-top:14px">請在期限內完成綠界付款。付款成功後，系統會自動開通文章閱讀資格；逾期未付款，優惠名額將自動釋出。</p>',
    '    <p style="margin-top:14px">請在期限內完成綠界付款。付款完成後，行政團隊核對款項並開通文章閱讀資格；逾期未付款，優惠名額將自動釋出。</p>'
)
replace_once(
    "sponsor-checkout.js",
    '''    const response = await createPublicSponsorCheckout({
      planMonths: activePlan,
      name: currentUser.displayName || ""
    });
    showCheckoutResult(response.data || {});
''',
    '''    const response = await createPublicSponsorCheckout({
      planMonths: activePlan,
      name: currentUser.displayName || ""
    });
    const result = response.data || {};
    if (!result.paymentUrl) throw new Error("系統尚未設定此方案的綠界付款連結。");
    if (status) status.textContent = `${result.priceTier === "promo" ? "優惠名額已保留" : "目前適用一般價格"}，正在前往綠界付款…`;
    window.location.assign(result.paymentUrl);
'''
)

# 7. Member center and global navigation recognize a pending payment-review state.
replace_once(
    "member-dashboard.js",
    '''function hasMemberCenterAccess(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
''',
    '''function isPendingSponsorReservation(member = {}) {
  const deadline = toDate(member.pendingPaymentDeadline);
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "pending"
    && member.status === "pending"
    && Boolean(String(member.pendingOrderNo || "").trim())
    && [1, 3].includes(Number(member.pendingPlanMonths || member.planMonths))
    && Number(member.pendingAmount || member.amount || 0) > 0
    && Boolean(deadline && deadline > new Date());
}

function showPendingSponsorReservation(member) {
  const months = Number(member.pendingPlanMonths || member.planMonths || 0);
  const amount = money.format(Number(member.pendingAmount || member.amount || 0));
  const tier = (member.pendingPriceTier || member.priceTier) === "promo" ? "前200名優惠" : "一般價格";
  const deadline = formatDate(member.pendingPaymentDeadline);
  const paymentUrl = String(member.pendingPaymentUrl || "");
  const action = paymentUrl.startsWith("https://")
    ? `<a class="access-link" href="${escapeHtml(paymentUrl)}">返回綠界付款頁面</a>`
    : '<a class="access-link" href="/articles.html">返回贊助文章</a>';
  showAccessState(
    "付款資料待核對",
    `您已選擇${months}個月贊助閱讀方案，金額為${amount}，本次適用${tier}。名額保留至${deadline}。完成付款後，行政團隊將於核對款項後開通閱讀資格。`,
    action
  );
}

function hasMemberCenterAccess(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
'''
)
replace_once(
    "member-dashboard.js",
    '''    if (!primaryMember) {
      const former = findFormerMembership(member, sponsorMember, history);
''',
    '''    if (!primaryMember) {
      if (sponsorMember && isPendingSponsorReservation(sponsorMember)) {
        showPendingSponsorReservation(sponsorMember);
        return;
      }
      const former = findFormerMembership(member, sponsorMember, history);
'''
)

replace_once(
    "site-auth-nav.js",
    '''function isActiveMember(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
''',
    '''function isPendingSponsorReservation(member = {}) {
  const deadline = toDate(member.pendingPaymentDeadline);
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "pending"
    && member.status === "pending"
    && Boolean(String(member.pendingOrderNo || "").trim())
    && Boolean(deadline && deadline > new Date());
}

function isActiveMember(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
'''
)
replace_once(
    "site-auth-nav.js",
    '''      (member && isActiveMember(member))
      || (sponsorMember && isActiveSponsorMember(sponsorMember))
''',
    '''      (member && isActiveMember(member))
      || (sponsorMember && (isActiveSponsorMember(sponsorMember) || isPendingSponsorReservation(sponsorMember)))
'''
)

# 8. Load the checkout module explicitly and bust caches.
replace_once(
    "articles.html",
    '''<script type="module" src="articles.js?v=20260804-article-benefit-1"></script>
<script type="module" src="/site-auth-nav.js?v=20260804-strict-wellness-1"></script>
''',
    '''<script type="module" src="articles.js?v=20260805-manual-ecpay-1"></script>
<script type="module" src="/sponsor-checkout.js?v=20260805-manual-ecpay-1"></script>
<script type="module" src="/site-auth-nav.js?v=20260805-manual-ecpay-1"></script>
'''
)
replace_once(
    "member-dashboard.html",
    '''<script type="module" src="/site-auth-nav.js?v=20260804-strict-wellness-1"></script>
<script type="module" src="/member-dashboard.js?v=20260804-article-benefit-1"></script>
''',
    '''<script type="module" src="/site-auth-nav.js?v=20260805-manual-ecpay-1"></script>
<script type="module" src="/member-dashboard.js?v=20260805-manual-ecpay-1"></script>
'''
)
replace_once(
    "admin.html",
    '<script type="module" src="membership-admin.js?v=20260804-membership-history-1"></script>',
    '<script type="module" src="membership-admin.js?v=20260805-manual-ecpay-1"></script>'
)

print("Manual fixed-link ECPay sponsor flow applied.")
