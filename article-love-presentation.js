// Presentation for the love article and the unpublished abundance draft.
// Never reads, writes or changes membership access.
const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const ABUNDANCE_ARTICLE_ID = 'market-crash-abundance-consciousness-20261122';
const QUOTES = new Map([
  ['「情愛並非始終專一不變。」', '無極瑤池金母靈訊｜《請問愛》'],
  ['「人類並非天生具備自我約束的能力。」', '無極瑤池金母靈訊｜《請問愛》'],
  ['「宇色！我想告訴你一個關於愛的真相：愛就像滔滔洪水，它擁有無比強大的力量，一個已經擁有愛的人，不可能僅對單一對象投注全部的愛。沒有任何一個人與對象能夠包容另一個全部的愛。」', '無極瑤池金母靈訊｜《請問愛》第一章'],
  ['「宇色！情感是我們在意識層面與特定對象產生的連結，它有一定的範圍和限制。然而，愛卻超越了這些界限。」', '無極瑤池金母靈訊｜《請問愛》第二章']
]);
const STYLE_ID = 'love-article-presentation-20261115';
const css = `
/* Isolated to this article's eight verified WebP photographs. */
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-cover,
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body img,
#article-root .article-card[data-article-id="${ARTICLE_ID}"] .article-card-media > img,
#article-root .article-card[data-article-id="${ARTICLE_ID}"] .article-card-media[data-photo-thumbnail="true"] > img,
#inline-image-list img[src*="/${ARTICLE_ID}/"],
#thumbnail-preview-media img[src*="/${ARTICLE_ID}/"],
#preview img[src*="/${ARTICLE_ID}/"] {
  filter: brightness(1.045) saturate(1.075) contrast(1.025) !important;
}
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-cover,
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body img {
  box-shadow: 0 7px 24px rgba(25,19,11,.14);
}
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body p.love-source-quote {
  box-sizing: border-box;
  max-width: 790px;
  margin: 34px auto !important;
  padding: 27px clamp(18px, 5vw, 48px) 30px !important;
  text-align: center !important;
  font-family: 'Source Han Serif TC', 'Noto Serif TC', 'Songti TC', serif;
  font-size: clamp(17px, 2.8vw, 21px);
  font-weight: 600;
  line-height: 2.05;
  letter-spacing: .035em;
  color: #493724;
  border: 1px solid rgba(165,130,84,.48);
  border-top: 2px solid #A58254;
  border-radius: 4px;
  background: linear-gradient(150deg, rgba(255,250,239,.86), rgba(229,216,188,.28));
  box-shadow: 0 10px 30px rgba(66,47,19,.075);
}
#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body p.love-source-quote::before {
  content: attr(data-source-label);
  display: block;
  margin-bottom: 13px;
  color: #886536;
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: .10em;
}
@media (max-width: 700px) {
  #article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body p.love-source-quote { margin: 26px auto !important; }
}
`;
function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
function prepareParagraph(p) {
  // Rendering older cached drafts must not re-display Markdown ** decoration.
  for (const strong of [...p.querySelectorAll('strong')]) strong.replaceWith(...strong.childNodes);
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue.includes('**')) node.nodeValue = node.nodeValue.replaceAll('**', '');
  }
  const content = (p.textContent || '').trim();
  const label = QUOTES.get(content);
  if (label && (p.dataset.sourceLabel !== label || !p.classList.contains('love-source-quote'))) {
    p.dataset.sourceLabel = label;
    p.classList.add('love-source-quote');
  }
}
let scheduled = false;
function update() {
  scheduled = false;
  prepareAbundanceQuotes();
  document.querySelectorAll(`#article-root .article-view[data-article-id="${ARTICLE_ID}"] .article-body p`).forEach(prepareParagraph);
}
function scheduleUpdate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(update);
}
installStyle();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleUpdate, { once: true });
else scheduleUpdate();
const root = document.getElementById('article-root');
if (root && [ARTICLE_ID, ABUNDANCE_ARTICLE_ID].includes(new URLSearchParams(location.search).get("id"))) {
  new MutationObserver(scheduleUpdate).observe(root, { childList: true, subtree: true });
}

const ABUNDANCE_STYLE_ID = 'abundance-mother-quote-20261122';
const abundanceSelector = '#article-root .article-view[data-article-id="' + ABUNDANCE_ARTICLE_ID + '"] .article-body';
const abundanceCss = [
  abundanceSelector + ' p.abundance-mother-quote {',
  '  box-sizing: border-box;',
  '  max-width: 790px;',
  '  margin: 34px auto !important;',
  '  padding: 27px clamp(18px, 5vw, 48px) 30px !important;',
  '  text-align: center !important;',
  "  font-family: 'Source Han Serif TC', 'Noto Serif TC', 'Songti TC', serif;",
  '  font-size: clamp(17px, 2.8vw, 21px);',
  '  font-weight: 600;',
  '  line-height: 2.05;',
  '  letter-spacing: .035em;',
  '  color: #493724;',
  '  border: 1px solid rgba(165,130,84,.48);',
  '  border-top: 2px solid #A58254;',
  '  border-radius: 4px;',
  '  background: linear-gradient(150deg, rgba(255,250,239,.86), rgba(229,216,188,.28));',
  '  box-shadow: 0 10px 30px rgba(66,47,19,.075);',
  '}',
  abundanceSelector + ' p.abundance-mother-quote::before {',
  '  content: attr(data-source-label);',
  '  display: block;',
  '  margin-bottom: 13px;',
  '  color: #886536;',
  "  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;",
  '  font-weight: 600;',
  '  font-size: 12px;',
  '  line-height: 1.6;',
  '  letter-spacing: .10em;',
  '}',
  abundanceSelector + ' p.abundance-mother-quote-marker,',
  abundanceSelector + ' p.abundance-mother-quote-citation {',
  '  display: none !important;',
  '}',
  '@media (max-width: 700px) {',
  '  ' + abundanceSelector + ' p.abundance-mother-quote { margin: 26px auto !important; }',
  '}'
].join('\n');

function installAbundanceStyle() {
  if (document.getElementById(ABUNDANCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ABUNDANCE_STYLE_ID;
  style.textContent = abundanceCss;
  document.head.appendChild(style);
}

function prepareAbundanceQuotes() {
  const view = document.querySelector('#article-root .article-view[data-article-id="' + ABUNDANCE_ARTICLE_ID + '"]');
  const body = view?.querySelector('.article-body');
  if (!body) return;
  const paragraphs = [...body.querySelectorAll(':scope > p')];
  for (let i = 0; i < paragraphs.length - 1; i += 1) {
    const marker = paragraphs[i];
    const markerText = (marker.textContent || '').trim();
    const markerMatch = markerText.match(/^【(?:無極瑤池金母|母娘)(靈訊|開示|慈示)[^】]*】$/);
    if (!markerMatch) continue;
    const markerKind = markerMatch[1];
    const quote = paragraphs[i + 1];
    if (!quote || quote.classList.contains('abundance-mother-quote')) continue;
    const quoteText = (quote.textContent || '').trim();
    if (!quoteText || (markerKind === '靈訊' && !quoteText.startsWith('「'))) continue;
    const next = paragraphs[i + 2];
    const citationText = (next?.textContent || '').trim();
    const hasCitation = /^——《[^》]+》(?:問題\d+)?$/.test(citationText);
    const sourceLabel = markerText.includes('非逐字')
      ? '無極瑤池金母慈示｜宇色依記憶轉述（非逐字）'
      : '無極瑤池金母' + markerKind + (hasCitation ? '｜' + citationText.replace(/^——/, '') : '');
    quote.dataset.sourceLabel = sourceLabel;
    quote.classList.add('abundance-mother-quote');
    quote.setAttribute('aria-label', sourceLabel + '。' + quoteText);
    marker.classList.add('abundance-mother-quote-marker');
    if (hasCitation) next.classList.add('abundance-mother-quote-citation');
  }
}
installAbundanceStyle();
