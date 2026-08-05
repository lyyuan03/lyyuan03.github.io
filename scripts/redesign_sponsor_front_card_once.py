from pathlib import Path

articles = Path('articles.js')
text = articles.read_text(encoding='utf-8')
old = '''function renderPaidGate(article) {
  const subject = encodeURIComponent(`詢問付費閱讀｜${article.title || "靈元院文選"}`);
  const body = encodeURIComponent(`您好，我想詢問〈${article.title || "這篇文章"}〉的付費閱讀方式。`);
  return `
    <section class="member-lock-zone paid-lock-zone" aria-label="贊助會員專屬">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>本文為贊助會員專屬</h3>
        <p>本篇目前僅開放前段試閱。若希望閱讀全文，歡迎聯繫靈元院，了解贊助會員開放方式。</p>
        <div class="paid-inquiry-actions">
          <button class="paid-inquiry-primary" id="article-member-login-button" type="button">${currentUser ? "重新確認會員資格" : "會員登入"}</button>
          <a class="paid-inquiry-primary" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">詢問贊助閱讀方式</a>
          <a class="paid-inquiry-secondary" href="mailto:lyyuan03@gmail.com?subject=${subject}&body=${body}">使用 Email 詢問</a>
        </div>
        <small>完整內容不會在本頁直接展開</small>
      </div>
    </section>
  `;
}
'''
new = '''function renderPaidGate(article) {
  return `
    <section class="member-lock-zone paid-lock-zone" aria-label="贊助會員專屬">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card sponsor-join-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>閱讀全文｜加入贊助會員</h3>
        <p>本篇目前開放前段試閱。完成贊助方案付款並由行政團隊開通後，即可使用登記的 Gmail 閱讀全文。</p>
        <div data-sponsor-offer-slot>
          <div class="sponsor-offer-loading">方案與優惠名額載入中，請稍候。</div>
        </div>
        <div class="paid-member-return">
          <span>已是贊助會員？</span>
          <button class="paid-inquiry-primary" id="article-member-login-button" type="button">${currentUser ? "重新確認會員資格" : "會員登入"}</button>
        </div>
        <a class="paid-help-link" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">付款後尚未開通｜聯繫行政團隊</a>
        <small>完成開通後，使用登記的 Gmail 登入即可閱讀全文。</small>
      </div>
    </section>
  `;
}
'''
if old not in text:
    raise SystemExit('renderPaidGate block not found')
articles.write_text(text.replace(old, new, 1), encoding='utf-8')

html = Path('articles.html')
text = html.read_text(encoding='utf-8')
text = text.replace('articles.js?v=20260805-simple-links-1', 'articles.js?v=20260805-sponsor-front-card-1', 1)
text = text.replace('sponsor-checkout.js?v=20260805-simple-manual-2', 'sponsor-checkout.js?v=20260805-sponsor-front-card-1', 1)
html.write_text(text, encoding='utf-8')
print('Sponsor front card redesigned.')
