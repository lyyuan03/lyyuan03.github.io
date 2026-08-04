from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> bool:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


changed = False

old_dashboard = '''function isActiveWellnessMember(member = {}) {
  if (member.memberType === "sponsor-member") return false;
  const isWellness = member.wellnessAccess === true || member.memberType === "wellness-channel" || ["wellness", "lingji"].includes(member.memberLevel);
  const expiry = toDate(member.expiresAt);
  return isWellness && member.status === "active" && Boolean(expiry && expiry > new Date());
}
'''
new_dashboard = '''function isWellnessMemberRecord(member = {}) {
  return member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt;
}

function isActiveWellnessMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return isWellnessMemberRecord(member)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && Boolean(expiry && expiry > new Date());
}
'''
changed |= replace_once("member-dashboard.js", old_dashboard, new_dashboard)

old_center_access = '''function hasMemberCenterAccess(member = {}) {
  if (!member) return false;
  const expiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!expiry || expiry > new Date());
  return Boolean(activeQualification || Number(member.cashbackBalance) > 0 || (Array.isArray(member.purchasedCourses) && member.purchasedCourses.length));
}
'''
new_center_access = '''function hasMemberCenterAccess(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(isActiveWellnessMember(member) || Number(member.cashbackBalance) > 0 || hasCourses);
}
'''
changed |= replace_once("member-dashboard.js", old_center_access, new_center_access)

old_nav = '''function isActiveWellnessMember(member = {}) {
  if (member.memberType === "sponsor-member") return false;
  const isWellness = member.wellnessAccess === true || member.memberType === "wellness-channel" || ["wellness", "lingji"].includes(member.memberLevel);
  const expiry = toDate(member.expiresAt);
  return isWellness && member.status === "active" && Boolean(expiry && expiry > new Date());
}
'''
new_nav = '''function isWellnessMemberRecord(member = {}) {
  return member.memberType === "wellness-channel"
    && member.wellnessAccess === true
    && ["wellness", "lingji"].includes(member.memberLevel)
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt;
}

function isActiveWellnessMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  return isWellnessMemberRecord(member)
    && member.status === "active"
    && member.paymentStatus === "paid"
    && Boolean(expiry && expiry > new Date());
}
'''
changed |= replace_once("site-auth-nav.js", old_nav, new_nav)

old_nav_member = '''function isActiveMember(member = {}) {
  const expiry = toDate(member.expiresAt);
  const activeQualification = member.status === "active" && (!expiry || expiry > new Date());
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(activeQualification || Number(member.cashbackBalance) > 0 || hasCourses);
}
'''
new_nav_member = '''function isActiveMember(member = {}) {
  if (!isWellnessMemberRecord(member)) return false;
  const hasCourses = Array.isArray(member.purchasedCourses) && member.purchasedCourses.length > 0;
  return Boolean(isActiveWellnessMember(member) || Number(member.cashbackBalance) > 0 || hasCourses);
}
'''
changed |= replace_once("site-auth-nav.js", old_nav_member, new_nav_member)

old_admin_filter = '''    .filter((item) => item.wellnessAccess === true || item.memberType === "wellness-channel" || ["wellness", "lingji"].includes(item.memberLevel))
'''
new_admin_filter = '''    .filter((item) => item.memberType === "wellness-channel"
      && item.wellnessAccess === true
      && ["wellness", "lingji"].includes(item.memberLevel))
'''
changed |= replace_once("wellness-member-admin.js", old_admin_filter, new_admin_filter)

old_rules = '''        && wellnessMember().data.expiresAt > request.time
        && wellnessMember().data.memberType != "sponsor-member"
        && wellnessMember().data.disabled != true
        && wellnessMember().data.suspended != true
        && (wellnessMember().data.wellnessAccess == true
          || wellnessMember().data.memberType == "wellness-channel"
          || wellnessMember().data.memberLevel in ["wellness", "lingji"]);
'''
new_rules = '''        && wellnessMember().data.expiresAt > request.time
        && wellnessMember().data.memberType == "wellness-channel"
        && wellnessMember().data.wellnessAccess == true
        && wellnessMember().data.memberLevel in ["wellness", "lingji"]
        && wellnessMember().data.disabled != true
        && wellnessMember().data.suspended != true
        && wellnessMember().data.revokedAt == null;
'''
changed |= replace_once("firestore.rules", old_rules, new_rules)

# Bust browser caches everywhere this shared member navigation is loaded.
for file in Path(".").glob("*.html"):
    text = file.read_text(encoding="utf-8")
    updated = re.sub(
        r'(site-auth-nav\.js\?v=)[^"\']+',
        r'\g<1>20260804-strict-wellness-1',
        text,
    )
    if file.name == "member-dashboard.html":
        updated = re.sub(
            r'(member-dashboard\.js\?v=)[^"\']+',
            r'\g<1>20260804-strict-wellness-1',
            updated,
        )
    if updated != text:
        file.write_text(updated, encoding="utf-8")
        changed = True

if not changed:
    print("Strict wellness member-center patch already applied.")
else:
    print("Strict wellness member-center patch applied.")
