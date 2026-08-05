from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once('membership-admin.js', '''  await setDoc(doc(db, "articles", "sponsor-offer-status"), {
    status: "published",
    hidden: true,
    systemRecord: true,
    title: "贊助閱讀方案名額狀態",
    category: "system",
    content: "",
    excerpt: "",
    ...offerStatus,
    currentPaymentUrl: String(currentPaymentUrl || "").trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}''', '''  await setDoc(doc(db, "articles", "sponsor-offer-status"), {
    status: "published",
    hidden: true,
    systemRecord: true,
    publicVersion: 2,
    title: "贊助閱讀方案名額狀態",
    category: "system",
    content: "",
    excerpt: "",
    ...offerStatus,
    promoPaymentUrl: String(settings.sponsorPromoPaymentUrl || "").trim(),
    regularPaymentUrl: String(settings.sponsorRegularPaymentUrl || "").trim(),
    currentPaymentUrl: String(currentPaymentUrl || "").trim(),
    publicUpdatedAt: new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}''')

replace_once('membership-admin.js', '''    <p class="membership-help">優惠名額直接依「付款成功後，已加入正式名單的 Gmail 人數」計算。前200名使用優惠連結，第201名起使用一般價連結；同一個 Gmail 續期不會重複增加人數。</p>
  `);
}''', '''    <p class="membership-help">優惠名額直接依「付款成功後，已加入正式名單的 Gmail 人數」計算。前200名使用優惠連結，第201名起使用一般價連結；同一個 Gmail 續期不會重複增加人數。</p>
    <div class="top-actions" style="margin-top:12px">
      <button id="sync-sponsor-public-offer" class="btn" type="button">立即同步前台名額與付款連結</button>
    </div>
  `);
}''')

replace_once('membership-admin.js', '''async function loadOfferStatus() {
  offerStatus = calculateOfferStatus();
  renderOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
  try {
    await publishOfferStatus();
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
  }
}
''', '''async function syncPublicOfferStatus(showMessage = false) {
  offerStatus = calculateOfferStatus();
  await publishOfferStatus();
  renderOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
  if (showMessage) {
    statusEl.textContent = `前台已同步｜已加入 ${offerStatus.paidCount} 人｜尚餘 ${offerStatus.remaining} 名｜目前套用${offerStatus.promotionAvailable ? "優惠價" : "一般價"}付款連結`;
  }
}

async function loadOfferStatus() {
  try {
    await syncPublicOfferStatus(false);
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
    renderOfferStatus();
  }
}
''')

replace_once('membership-admin.js', '''  try {
    await publishOfferStatus();
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
  }
}

installOfferAdminUi();''', '''  try {
    await syncPublicOfferStatus(false);
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
  }
}

installOfferAdminUi();''')

replace_once('membership-admin.js', '''resetButton?.addEventListener("click", resetMemberForm);

function showError(error) {''', '''resetButton?.addEventListener("click", resetMemberForm);
document.getElementById("sync-sponsor-public-offer")?.addEventListener("click", () => {
  syncPublicOfferStatus(true).catch(showError);
});

function showError(error) {''')

replace_once('membership-admin.js', '''    await loadSettings();
    await loadMembers();
  } catch (error) {''', '''    await loadSettings();
    await loadMembers();
    await syncPublicOfferStatus(true);
  } catch (error) {''')

replace_once('admin.html', 'membership-admin.js?v=20260805-simple-manual-2', 'membership-admin.js?v=20260805-public-sync-1')
replace_once('articles.html', 'sponsor-checkout.js?v=20260805-sponsor-front-card-1', 'sponsor-checkout.js?v=20260805-public-sync-1')
print('Sponsor public offer synchronization repaired.')
