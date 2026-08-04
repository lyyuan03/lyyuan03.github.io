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

# 1. Member center: three explicit states — active, verified former, no record.
member_anchor = '''function hasMemberCenterAccess(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(isActiveWellnessMember(member) || Number(member.cashbackBalance) > 0 || hasCourses);
}
'''
member_helpers = member_anchor + '''
function wellnessHistorySchema(record = {}) {
  return record.memberType === "wellness-channel"
    && record.wellnessAccess === true
    && ["wellness", "lingji"].includes(record.memberLevel)
    && record.paymentStatus === "paid"
    && Boolean(toDate(record.startsAt || record.firstJoinedAt))
    && Boolean(toDate(record.expiresAt));
}

function sponsorHistorySchema(record = {}) {
  return record.memberType === "sponsor-member"
    && record.paymentStatus === "paid"
    && record.articleAccess === true
    && record.accessScope === "sponsor-paid-articles"
    && Number(record.accessVersion || 0) >= 2
    && Boolean(String(record.lastOrderNo || "").trim())
    && Boolean(toDate(record.startsAt || record.firstJoinedAt))
    && Boolean(toDate(record.expiresAt));
}

function formerPeriodEnded(record = {}, explicitHistory = false) {
  const end = toDate(record.endedAt || record.expiresAt);
  if (!end) return false;
  if (explicitHistory && record.verified !== true) return false;
  return record.historicalStatus === "ended" || end <= new Date();
}

function formerMembershipLabel(record = {}) {
  if (record.memberType === "sponsor-member") return "贊助專屬文章會員";
  return record.memberLevel === "lingji"
    ? "養生療癒頻道｜靈極會員"
    : "養生療癒頻道｜一般會員";
}

function findFormerMembership(member, sponsorMember, history = {}) {
  const candidates = [];
  const add = (record, kind, explicitHistory = false) => {
    if (!record) return;
    const validSchema = kind === "sponsor"
      ? sponsorHistorySchema(record)
      : wellnessHistorySchema(record);
    if (!validSchema || !formerPeriodEnded(record, explicitHistory)) return;
    const endedAt = toDate(record.endedAt || record.expiresAt);
    candidates.push({ record, endedAt });
  };

  add(history.wellness, "wellness", true);
  add(history.sponsor, "sponsor", true);
  add(member, "wellness", false);
  add(sponsorMember, "sponsor", false);
  candidates.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
  return candidates[0]?.record || null;
}

function showFormerMembership(record) {
  const start = formatDate(record.startsAt || record.firstJoinedAt);
  const end = formatDate(record.endedAt || record.expiresAt);
  const label = formerMembershipLabel(record);
  showAccessState(
    "前期會員資格已結束",
    `此帳號曾登記為「${label}」。前期資格期間：${start}至${end}。目前尚無有效會員資格。`,
    '<a class="access-link" href="/membership.html">查看會員制度</a>'
  );
}
'''
changed |= replace_once("member-dashboard.js", member_anchor, member_helpers)

old_auth = '''    const [snapshot, sponsorSnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email))
    ]);
    const member = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    const sponsorMember = sponsorSnapshot.exists() ? { id: sponsorSnapshot.id, ...sponsorSnapshot.data() } : null;
    const sponsorActive = Boolean(sponsorMember && isActiveSponsorMember(sponsorMember));
    const primaryMember = member && hasMemberCenterAccess(member)
      ? member
      : sponsorActive
        ? sponsorMember
        : null;
    if (!primaryMember) {
      const latestRecord = sponsorMember || member;
      const expired = latestRecord?.expiresAt ? `目前紀錄的資格到期日為 ${formatDate(latestRecord.expiresAt)}。` : "系統目前查無可顯示的會員資格、文章權限或已購課程。";
      showAccessState("目前沒有有效的會員資料", `${expired} 如需確認資料，請聯繫靈元院行政團隊。`, '<a class="access-link" href="/membership.html">查看會員制度</a>');
      return;
    }
    renderDashboard(primaryMember, user, sponsorMember);
'''
new_auth = '''    const [snapshot, sponsorSnapshot, historySnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email)),
      getDoc(doc(db, "membershipHistory", email))
    ]);
    const member = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    const sponsorMember = sponsorSnapshot.exists() ? { id: sponsorSnapshot.id, ...sponsorSnapshot.data() } : null;
    const history = historySnapshot.exists() ? historySnapshot.data() : {};
    const sponsorActive = Boolean(sponsorMember && isActiveSponsorMember(sponsorMember));
    const primaryMember = member && hasMemberCenterAccess(member)
      ? member
      : sponsorActive
        ? sponsorMember
        : null;
    if (!primaryMember) {
      const former = findFormerMembership(member, sponsorMember, history);
      if (former) {
        showFormerMembership(former);
      } else {
        showAccessState(
          "此帳號目前沒有會員資料",
          "您登入的 Google 帳號尚未登記任何靈元院會員資格。如曾使用其他 Email 登記，請登出後改用原登記帳號登入。",
          '<a class="access-link" href="/membership.html">查看會員制度</a>'
        );
      }
      return;
    }
    renderDashboard(primaryMember, user, sponsorMember);
'''
changed |= replace_once("member-dashboard.js", old_auth, new_auth)

# 2. Wellness administration: maintain verified history only for paid/formal records.
wellness_anchor = '''function coursesToText(courses = []) {
  return (Array.isArray(courses) ? courses : []).map((course) => [course.title, course.startsAt, course.expiresAt, course.url].join("｜")).join("\\n");
}
'''
wellness_helpers = wellness_anchor + '''
function wellnessHistoryRecord(member = {}, historicalStatus = "verified") {
  const startsAt = member.startsAt || member.firstJoinedAt || null;
  if (member.memberType !== "wellness-channel"
      || member.wellnessAccess !== true
      || !["wellness", "lingji"].includes(member.memberLevel)
      || member.paymentStatus !== "paid"
      || !startsAt
      || !member.expiresAt) return null;
  const record = {
    memberType: "wellness-channel",
    memberLevel: member.memberLevel,
    wellnessAccess: true,
    paymentStatus: "paid",
    startsAt,
    expiresAt: member.expiresAt,
    lastOrderNo: member.lastOrderNo || "",
    verified: true,
    historicalStatus,
    verificationSource: member.lastOrderNo ? "payment" : "admin",
    recordedAt: serverTimestamp()
  };
  if (historicalStatus === "ended") record.endedAt = serverTimestamp();
  return record;
}

async function writeWellnessHistory(email, member, historicalStatus = "verified") {
  const record = wellnessHistoryRecord(member, historicalStatus);
  if (!record) return;
  await setDoc(doc(db, "membershipHistory", email), {
    email,
    wellness: record,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
'''
changed |= replace_once("wellness-member-admin.js", wellness_anchor, wellness_helpers)

old_wellness_save = '''  await setDoc(doc(db, "memberAccess", data.email), data, { merge: true });
  if (originalEmail && originalEmail !== data.email) {
    await deleteDoc(doc(db, "memberAccess", originalEmail));
  }
'''
new_wellness_save = '''  await setDoc(doc(db, "memberAccess", data.email), data, { merge: true });
  await writeWellnessHistory(data.email, data, "verified");
  if (originalEmail && originalEmail !== data.email) {
    await deleteDoc(doc(db, "memberAccess", originalEmail));
  }
'''
changed |= replace_once("wellness-member-admin.js", old_wellness_save, new_wellness_save)

old_wellness_delete = '''async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的養生療癒會員資料嗎？`)) return;
  await deleteDoc(doc(db, "memberAccess", email));
  statusEl.textContent = "養生療癒會員資料已刪除";
  await loadMembers();
}
'''
new_wellness_delete = '''async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的養生療癒會員資料嗎？`)) return;
  const member = members.find((item) => item.email === email);
  if (member) await writeWellnessHistory(email, member, "ended");
  await deleteDoc(doc(db, "memberAccess", email));
  statusEl.textContent = "養生療癒會員資料已刪除；符合條件的前期資格已保留於歷史紀錄";
  await loadMembers();
}
'''
changed |= replace_once("wellness-member-admin.js", old_wellness_delete, new_wellness_delete)

# 3. Sponsor administration: archive formal paid records before deletion.
sponsor_format_anchor = '''function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未開通";
}
'''
sponsor_helpers = sponsor_format_anchor + '''
function sponsorHistoryRecord(member = {}, historicalStatus = "verified") {
  const startsAt = member.startsAt || member.firstJoinedAt || null;
  if (member.memberType !== "sponsor-member"
      || member.paymentStatus !== "paid"
      || member.articleAccess !== true
      || member.accessScope !== "sponsor-paid-articles"
      || Number(member.accessVersion || 0) < 2
      || !String(member.lastOrderNo || "").trim()
      || !startsAt
      || !member.expiresAt) return null;
  const record = {
    memberType: "sponsor-member",
    articleAccess: true,
    accessScope: "sponsor-paid-articles",
    accessVersion: 2,
    paymentStatus: "paid",
    startsAt,
    expiresAt: member.expiresAt,
    lastOrderNo: member.lastOrderNo,
    verified: true,
    historicalStatus,
    verificationSource: "payment",
    recordedAt: serverTimestamp()
  };
  if (historicalStatus === "ended") record.endedAt = serverTimestamp();
  return record;
}

async function writeSponsorHistory(email, member, historicalStatus = "verified") {
  const record = sponsorHistoryRecord(member, historicalStatus);
  if (!record) return;
  await setDoc(doc(db, "membershipHistory", email), {
    email,
    sponsor: record,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
'''
changed |= replace_once("membership-admin.js", sponsor_format_anchor, sponsor_helpers)

old_sponsor_delete = '''async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的會員資料嗎？`)) return;
  await deleteDoc(doc(db, "sponsorMemberAccess", email));
  statusEl.textContent = "會員資料已刪除；歷史付款人次仍會保留在訂單紀錄中";
  await Promise.all([loadMembers(), loadOfferStatus()]);
}
'''
new_sponsor_delete = '''async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的會員資料嗎？`)) return;
  const member = members.find((item) => item.email === email);
  if (member) await writeSponsorHistory(email, member, "ended");
  await deleteDoc(doc(db, "sponsorMemberAccess", email));
  statusEl.textContent = "會員資料已刪除；符合條件的前期資格已保留於歷史紀錄";
  await Promise.all([loadMembers(), loadOfferStatus()]);
}
'''
changed |= replace_once("membership-admin.js", old_sponsor_delete, new_sponsor_delete)

# 4. Payment callback: write the latest verified period to membershipHistory.
callback_anchor = '''        transaction.set(memberRef, activeMember, { merge: true });
        transaction.update(orderRef, {
'''
callback_replacement = '''        transaction.set(memberRef, activeMember, { merge: true });
        const historyKey = order.memberType === "sponsor-member" ? "sponsor" : "wellness";
        const historyRecord = {
          memberType: activeMember.memberType,
          paymentStatus: "paid",
          startsAt: nowTimestamp,
          expiresAt: expiryTimestamp,
          lastOrderNo: tradeNo,
          verified: true,
          historicalStatus: "verified",
          verificationSource: "payment",
          recordedAt: nowTimestamp
        };
        if (historyKey === "sponsor") {
          historyRecord.articleAccess = true;
          historyRecord.accessScope = "sponsor-paid-articles";
          historyRecord.accessVersion = 2;
        } else {
          historyRecord.wellnessAccess = true;
          historyRecord.memberLevel = order.memberLevel;
        }
        transaction.set(db.doc(`membershipHistory/${order.email}`), {
          email: order.email,
          [historyKey]: historyRecord,
          updatedAt: nowTimestamp
        }, { merge: true });
        transaction.update(orderRef, {
'''
changed |= replace_once("functions/index.js", callback_anchor, callback_replacement)

# 5. Manual sponsor activation: write verified history in the same transaction.
manual_anchor = '''      transaction.set(memberRef, {
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
        note,
        updatedAt: nowTimestamp
      }, { merge: true });

      return {
'''
manual_replacement = '''      transaction.set(memberRef, {
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
          verificationSource: "manual-admin",
          recordedAt: nowTimestamp
        },
        updatedAt: nowTimestamp
      }, { merge: true });

      return {
'''
changed |= replace_once("functions/sponsor-offer-functions.js", manual_anchor, manual_replacement)

# 6. Firestore: members may read only their own history; only admin writes from clients.
rules_anchor = '''    match /sponsorMemberAccess/{memberEmail} {
      allow read: if isAdmin()
        || (signedIn()
          && request.auth.token.email_verified == true
          && request.auth.token.email == memberEmail
          && resource.data.email == memberEmail);
      allow create, update, delete: if isAdmin();
    }
'''
rules_replacement = rules_anchor + '''
    match /membershipHistory/{memberEmail} {
      allow read: if isAdmin()
        || (signedIn()
          && request.auth.token.email_verified == true
          && request.auth.token.email == memberEmail
          && resource.data.email == memberEmail);
      allow create, update, delete: if isAdmin();
    }
'''
changed |= replace_once("firestore.rules", rules_anchor, rules_replacement)

# 7. Bust browser caches for member center and admin modules.
changed |= regex_once(
    "member-dashboard.html",
    r'(member-dashboard\.js\?v=)[^"\']+',
    r'\g<1>20260804-membership-states-1'
)
changed |= regex_once(
    "admin.html",
    r'(membership-admin\.js\?v=)[^"\']+',
    r'\g<1>20260804-membership-history-1'
)
changed |= regex_once(
    "admin.html",
    r'(wellness-member-admin\.js\?v=)[^"\']+',
    r'\g<1>20260804-membership-history-1'
)

print("Member center history states applied." if changed else "No changes required.")
