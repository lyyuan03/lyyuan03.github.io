from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '''        memberType: "sponsor-member",
        articleAccess: true,
        amount,
''',
    '''        memberType: "sponsor-member",
        articleAccess: false,
        wellnessAccess: false,
        amount,
''',
)

replace_once(
    "functions/public-sponsor-checkout-functions.js",
    '''        memberType: "sponsor-member",
        articleAccess: true,
        pendingPlanMonths: planMonths,
''',
    '''        memberType: "sponsor-member",
        articleAccess: preserveActiveMembership,
        wellnessAccess: false,
        pendingPlanMonths: planMonths,
''',
)

replace_once(
    "functions/sponsor-offer-functions.js",
    '''        memberType: "sponsor-member",
        articleAccess: true,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "pending",
''',
    '''        memberType: "sponsor-member",
        articleAccess: false,
        wellnessAccess: false,
        amount,
        planMonths,
        priceTier,
        promotionSequence,
        sponsorPromoLimit: status.settings.promoLimit,
        status: "pending",
''',
)

replace_once(
    "functions/sponsor-offer-functions.js",
    '''        memberType: "sponsor-member",
        articleAccess: true,
        pendingPlanMonths: planMonths,
''',
    '''        memberType: "sponsor-member",
        articleAccess: preserveActiveMembership,
        wellnessAccess: false,
        pendingPlanMonths: planMonths,
''',
)

replace_once(
    "functions/sponsor-offer-functions.js",
    '''        memberType: "sponsor-member",
        articleAccess: true,
        planMonths,
        amount,
        priceTier,
        promotionSequence,
        paymentStatus: "paid",
        status: "active",
''',
    '''        memberType: "sponsor-member",
        articleAccess: true,
        wellnessAccess: false,
        planMonths,
        amount,
        priceTier,
        promotionSequence,
        paymentStatus: "paid",
        status: "active",
        disabled: false,
        suspended: false,
        revokedAt: FieldValue.delete(),
''',
)

replace_once(
    "functions/index.js",
    '''          paymentStatus: "paid",
          status: "active",
          firstJoinedAt: member.firstJoinedAt || nowTimestamp,
''',
    '''          paymentStatus: "paid",
          status: "active",
          disabled: false,
          suspended: false,
          revokedAt: FieldValue.delete(),
          firstJoinedAt: member.firstJoinedAt || nowTimestamp,
''',
)
