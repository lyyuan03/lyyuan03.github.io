from pathlib import Path

p = Path('membership-admin.js')
text = p.read_text(encoding='utf-8')
text = text.replace('''function isCountedSponsorMember(member = {}) {
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim());
}''', '''function isCountedSponsorMember(member = {}) {
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "paid";
}''')
text = text.replace('優惠名額上限（人次）', '優惠會員人數上限')
text = text.replace('前${limit}名優惠｜已占用 ${used} 人次', '前${limit}名優惠｜已加入 ${used} 人')
text = text.replace('''        const active = hasAuthoritativeSponsorAccess(member);
        const label = active ? "有效" : "已到期";''', '''        const active = hasAuthoritativeSponsorAccess(member);
        const expiry = dateValue(member.expiresAt);
        const label = active
          ? "有效"
          : member.status === "active" && expiry && expiry > new Date()
            ? "權限資料待補齊"
            : "已到期";''')
p.write_text(text, encoding='utf-8')
print('Sponsor count labels refined.')
