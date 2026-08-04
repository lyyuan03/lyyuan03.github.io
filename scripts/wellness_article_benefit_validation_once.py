from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


old_save = '''  const data = payload();
  if (!data.email) return;
  const originalEmail = normalizeEmail(document.getElementById("wellness-member-original-email").value);
'''
new_save = '''  const data = payload();
  if (!data.email) return;
  if (data.status === "active") {
    const startsAt = toDate(data.startsAt);
    const expiresAt = toDate(data.expiresAt);
    if (!startsAt || !expiresAt) {
      statusEl.textContent = "啟用會員前，請先填寫本次會期開始日與到期日。";
      return;
    }
    if (expiresAt <= startsAt) {
      statusEl.textContent = "到期日必須晚於本次會期開始日。";
      return;
    }
  }
  const originalEmail = normalizeEmail(document.getElementById("wellness-member-original-email").value);
'''
replace_once("wellness-member-admin.js", old_save, new_save)

old_active = '''    const active = member.status === "active" && (!expiry || expiry > now);
'''
new_active = '''    const active = member.status === "active" && Boolean(expiry && expiry > now);
'''
replace_once("wellness-member-admin.js", old_active, new_active)

old_benefit_call = '''    const benefit = articleBenefitDecision({
      memberLevel: level,
      status: member.status,
      qualifyingSinglePurchaseAmount: member.qualifyingSinglePurchaseAmount
    });
'''
new_benefit_call = '''    const benefit = articleBenefitDecision({
      memberLevel: level,
      status: active ? "active" : "pending",
      qualifyingSinglePurchaseAmount: member.qualifyingSinglePurchaseAmount
    });
'''
replace_once("wellness-member-admin.js", old_benefit_call, new_benefit_call)

print("Wellness article benefit validation applied.")
