from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "functions/sponsor-offer-functions.js",
    '''function publicOfferPayload(status) {
  const { settings } = status;
  return {
    promoLimit: settings.promoLimit,
''',
    '''function publicOfferPayload(status) {
  const { settings } = status;
  return {
    manualPaymentReview: true,
    promoLimit: settings.promoLimit,
'''
)

replace_once(
    "sponsor-checkout.js",
    '''    if (!response.ok || data.ready !== true) throw new Error("offer-not-ready");
    offer = data;
    enhancePaidGates();
''',
    '''    if (!response.ok || data.ready !== true) throw new Error("offer-not-ready");
    if (data.manualPaymentReview !== true) {
      offer = null;
      console.warn("贊助閱讀新版後端尚未發布，暫時保留原本的聯絡申請方式。");
      return;
    }
    offer = data;
    enhancePaidGates();
'''
)

print("Sponsor checkout backend gate applied.")
