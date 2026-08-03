from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    write(path, text.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex expected one match, found {count}")
    write(path, updated)


def replace_collection_all(path, old, new, minimum=1):
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path}: expected at least {minimum} occurrences of {old}, found {count}")
    write(path, text.replace(old, new))


# 付費文章必須只讀取獨立的贊助會員資料，不再接受養生會員或舊 memberAccess 紀錄。
replace_once(
    "articles.js",
    "let currentMemberAccess = null;\n",
    "let currentMemberAccess = null;\nlet currentSponsorAccess = null;\n",
)

regex_once(
    "articles.js",
    r'function hasPaidAccess\(articleId = ""\) \{.*?\n\}\n\nasync function loadMemberAccess',
    '''function hasPaidAccess(articleId = "") {
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

async function loadMemberAccess''',
)

regex_once(
    "articles.js",
    r'async function loadMemberAccess\(user\) \{.*?\n\}\n\nasync function eventArticleKey',
    '''async function loadMemberAccess(user) {
  currentMemberAccess = null;
  currentSponsorAccess = null;
  if (!user?.email || isAdminEmail(user.email)) return;
  try {
    const email = user.email.trim().toLowerCase();
    const [memberSnapshot, sponsorSnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email))
    ]);

    if (memberSnapshot.exists()) {
      const record = memberSnapshot.data() || {};
      const recordEmail = String(record.email || memberSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentMemberAccess = { ...record, email: recordEmail };
      else console.warn("一般會員資料 Email 與登入帳號不一致，已拒絕載入。");
    }

    if (sponsorSnapshot.exists()) {
      const record = sponsorSnapshot.data() || {};
      const recordEmail = String(record.email || sponsorSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentSponsorAccess = { ...record, email: recordEmail };
      else console.warn("贊助會員資料 Email 與登入帳號不一致，已拒絕授權。");
    }
  } catch (error) {
    console.warn("會員閱讀資格暫時無法確認。", error);
    currentMemberAccess = null;
    currentSponsorAccess = null;
  }
}

async function eventArticleKey''',
)

# 贊助會員後台改用單一權威資料表。
replace_collection_all("membership-admin.js", '"memberAccess"', '"sponsorMemberAccess"', minimum=3)
replace_once(
    "membership-admin.js",
    'function renderMembers() {\n',
    '''function hasAuthoritativeSponsorAccess(member = {}) {
  const expiry = dateValue(member.expiresAt);
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

function renderMembers() {
''',
)
replace_once(
    "membership-admin.js",
    "    listEl.innerHTML = '<div class=\"empty\">目前尚無贊助會員資料</div>';\n",
    "    listEl.innerHTML = '<div class=\"empty\">目前尚無贊助會員資料；此時任何一般登入帳號都不會取得贊助文章閱讀權限。</div>';\n",
)
regex_once(
    "membership-admin.js",
    r'    const expiry = dateValue\(member\.expiresAt\);\n    const active = member\.status === "active".*?&& expiry > now;',
    '''    const expiry = dateValue(member.expiresAt);
    const active = hasAuthoritativeSponsorAccess(member);''',
)

# 養生療癒會員不再共用贊助文章權限欄位。
regex_once(
    "wellness-member-admin.js",
    r'function syncArticleAccess\(\) \{.*?\n\}',
    '''function syncArticleAccess() {
  articleAccessEl.checked = false;
  articleAccessEl.disabled = true;
}''',
)
replace_once(
    "wellness-member-admin.js",
    "  articleAccessEl.checked = true;\n  articleAccessEl.disabled = false;\n",
    "  articleAccessEl.checked = false;\n  articleAccessEl.disabled = true;\n",
)
replace_once(
    "wellness-member-admin.js",
    "    articleAccess: level === \"lingji\" || articleAccessEl.checked,\n",
    "    articleAccess: false,\n",
)
replace_once(
    "wellness-member-admin.js",
    "      articleAccess: levelEl.value === \"lingji\" || articleAccessEl.checked\n",
    "      articleAccess: false\n",
)
replace_once(
    "wellness-member-admin.js",
    '  statusEl.textContent = "養生療癒會員資料已儲存，文章權限已同步";\n',
    '  statusEl.textContent = "養生療癒會員資料已儲存；贊助文章權限由贊助會員名單獨立管理";\n',
)
replace_once(
    "wellness-member-admin.js",
    '    const articleLabel = member.articleAccess === true || level === "lingji" ? "可閱讀付費文章" : "未開放付費文章";\n',
    '    const articleLabel = "不含贊助文章權限";\n',
)
replace_once(
    "wellness-member-admin.js",
    '  articleAccessEl.checked = member.articleAccess === true || levelEl.value === "lingji";\n',
    '  articleAccessEl.checked = false;\n',
)

# 後端：養生與贊助會員分流；付款完成才建立正式贊助授權版本。
replace_once(
    "functions/index.js",
    '    const articleAccess = memberLevel === "lingji" || request.data?.articleAccess !== false;\n',
    '    const articleAccess = false;\n',
)
replace_once(
    "functions/index.js",
    '    await db.doc(`memberAccess/${email}`).set({\n      email,\n      name,\n      memberType: "sponsor-member",\n',
    '    await db.doc(`sponsorMemberAccess/${email}`).set({\n      email,\n      name,\n      memberType: "sponsor-member",\n',
)
replace_once(
    "functions/index.js",
    '        const memberRef = db.doc(`memberAccess/${order.email}`);\n',
    '        const memberCollection = order.memberType === "sponsor-member" ? "sponsorMemberAccess" : "memberAccess";\n        const memberRef = db.doc(`${memberCollection}/${order.email}`);\n',
)
replace_once(
    "functions/index.js",
    '''        if (order.memberType === "sponsor-member") {
          activeMember.articleAccess = true;
          activeMember.wellnessAccess = false;
        } else {
''',
    '''        if (order.memberType === "sponsor-member") {
          activeMember.articleAccess = true;
          activeMember.wellnessAccess = false;
          activeMember.accessScope = "sponsor-paid-articles";
          activeMember.accessVersion = 2;
        } else {
''',
)
replace_once(
    "functions/index.js",
    '          activeMember.articleAccess = order.memberLevel === "lingji" || order.articleAccess === true;\n',
    '          activeMember.articleAccess = false;\n',
)

replace_collection_all("functions/sponsor-offer-functions.js", "memberAccess", "sponsorMemberAccess", minimum=3)
replace_once(
    "functions/sponsor-offer-functions.js",
    '''        articleAccess: true,
        wellnessAccess: false,
        planMonths,
''',
    '''        articleAccess: true,
        wellnessAccess: false,
        accessScope: "sponsor-paid-articles",
        accessVersion: 2,
        planMonths,
''',
)
replace_collection_all("functions/public-sponsor-checkout-functions.js", "memberAccess", "sponsorMemberAccess", minimum=2)

# 導覽與會員中心同時讀取兩個資料表；贊助資格仍採嚴格條件。
replace_once(
    "site-auth-nav.js",
    'const AUTH_VERSION = "20260803-sponsor-offer-2";\n',
    'const AUTH_VERSION = "20260803-sponsor-authoritative-1";\n',
)
replace_once(
    "site-auth-nav.js",
    'function isActiveMember(member = {}) {\n',
    '''function isActiveSponsorMember(member = {}) {
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

function isActiveMember(member = {}) {
''',
)
replace_once(
    "site-auth-nav.js",
    '''    const snapshot = await getDoc(doc(db, "memberAccess", email));
    const member = snapshot.exists() ? snapshot.data() : null;
    if (auth.currentUser?.uid !== user.uid) return;
    hasWellnessAccess = Boolean(member && isActiveWellnessMember(member));
    hasMemberAccess = Boolean(member && isActiveMember(member));
''',
    '''    const [snapshot, sponsorSnapshot] = await Promise.all([
      getDoc(doc(db, "memberAccess", email)),
      getDoc(doc(db, "sponsorMemberAccess", email))
    ]);
    const member = snapshot.exists() ? snapshot.data() : null;
    const sponsorMember = sponsorSnapshot.exists() ? sponsorSnapshot.data() : null;
    if (auth.currentUser?.uid !== user.uid) return;
    hasWellnessAccess = Boolean(member && isActiveWellnessMember(member));
    hasMemberAccess = Boolean(
      (member && isActiveMember(member))
      || (sponsorMember && isActiveSponsorMember(sponsorMember))
    );
''',
)

replace_once(
    "member-dashboard.js",
    'function hasMemberCenterAccess(member = {}) {\n',
    '''function isActiveSponsorMember(member = {}) {
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

function hasMemberCenterAccess(member = {}) {
''',
)
replace_once(
    "member-dashboard.js",
    'function renderDashboard(member, user) {\n',
    'function renderDashboard(member, user, sponsorMember = null) {\n',
)
replace_once(
    "member-dashboard.js",
    '''  const wellnessActive = isActiveWellnessMember(member);
  const qualificationExpiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!qualificationExpiry || qualificationExpiry > new Date());
  const sponsorOnly = activeQualification && !wellnessActive;
  const articleActive = activeQualification && (sponsorOnly || member.articleAccess === true || isLingji);
''',
    '''  const wellnessActive = isActiveWellnessMember(member);
  const sponsorRecord = sponsorMember || (member.memberType === "sponsor-member" ? member : null);
  const sponsorActive = Boolean(sponsorRecord && isActiveSponsorMember(sponsorRecord));
  const sponsorOnly = sponsorActive && !wellnessActive;
  const articleActive = sponsorActive;
  const articleExpiry = sponsorActive ? formatDate(sponsorRecord.expiresAt) : "未設定";
''',
)
replace_once(
    "member-dashboard.js",
    '  document.getElementById("dashboard-article-access").textContent = articleActive ? `閱讀資格有效｜至 ${expiry}` : "尚未開通";\n',
    '  document.getElementById("dashboard-article-access").textContent = articleActive ? `閱讀資格有效｜至 ${articleExpiry}` : "尚未開通";\n',
)
regex_once(
    "member-dashboard.js",
    r'    const snapshot = await getDoc\(doc\(db, "memberAccess", email\)\);\n    const member = snapshot\.exists\(\) \? \{ id: snapshot\.id, \.\.\.snapshot\.data\(\) \} : null;\n    if \(!member \|\| !hasMemberCenterAccess\(member\)\) \{.*?\n    renderDashboard\(member, user\);',
    '''    const [snapshot, sponsorSnapshot] = await Promise.all([
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
    renderDashboard(primaryMember, user, sponsorMember);''',
)

# Firestore 規則：獨立贊助會員資料只能由本人讀取、管理員寫入。
replace_once(
    "firestore.rules",
    '''    match /memberAccess/{memberEmail} {
      allow read: if isAdmin()
        || (signedIn()
          && request.auth.token.email_verified == true
          && request.auth.token.email == memberEmail
          && resource.data.email == memberEmail);
      allow create, update, delete: if isAdmin();
    }

''',
    '''    match /memberAccess/{memberEmail} {
      allow read: if isAdmin()
        || (signedIn()
          && request.auth.token.email_verified == true
          && request.auth.token.email == memberEmail
          && resource.data.email == memberEmail);
      allow create, update, delete: if isAdmin();
    }

    match /sponsorMemberAccess/{memberEmail} {
      allow read: if isAdmin()
        || (signedIn()
          && request.auth.token.email_verified == true
          && request.auth.token.email == memberEmail
          && resource.data.email == memberEmail);
      allow create, update, delete: if isAdmin();
    }

''',
)

# 後台文字與快取版本。
replace_once(
    "admin.html",
    '''            <label class="check-field" for="wellness-member-article-access">
              <input id="wellness-member-article-access" type="checkbox" checked>
              <span><strong>開放付費文章閱讀權限</strong><small>儲存後，會員使用此 Gmail 登入即可閱讀付費文章；靈極會員會自動開啟。</small></span>
            </label>
''',
    '''            <label class="check-field" for="wellness-member-article-access">
              <input id="wellness-member-article-access" type="checkbox" disabled>
              <span><strong>贊助文章權限採獨立管理</strong><small>養生療癒會員不會自動取得贊助文章權限；如需開放，請至上方「贊助會員管理」完成付款與開通。</small></span>
            </label>
''',
)
replace_once(
    "admin.html",
    '此區專門管理「靈元院養生療癒頻道」的一般會員、靈極會員、會期與付費文章閱讀權限，不影響原本贊助會員管理。',
    '此區只管理「靈元院養生療癒頻道」的一般會員、靈極會員與會期；贊助文章閱讀權限一律由上方贊助會員名單獨立判讀。',
)
replace_once(
    "articles.html",
    'articles.js?v=20260803-paid-access-hardening-1',
    'articles.js?v=20260803-sponsor-authoritative-1',
)
replace_once(
    "admin.html",
    'membership-admin.js?v=20260803-paid-access-hardening-1',
    'membership-admin.js?v=20260803-sponsor-authoritative-1',
)
replace_once(
    "admin.html",
    'wellness-member-admin.js?v=20260802-unified-center-1',
    'wellness-member-admin.js?v=20260803-sponsor-authoritative-1',
)
regex_once(
    "member-dashboard.html",
    r'member-dashboard\.js\?v=[^"\']+',
    'member-dashboard.js?v=20260803-sponsor-authoritative-1',
)
