from pathlib import Path
import re

js = Path('sponsor-checkout.js')
text = js.read_text(encoding='utf-8')
text, count1 = re.subn(r'\n\s*\.sponsor-offer-sync\{[^\n]*\}\n\s*\.sponsor-offer-sync::before\{[^\n]*\}\n\s*\.sponsor-offer-sync\.is-live::before\{[^\n]*\}', '', text, count=1)
text, count2 = re.subn(r'\n\s*const syncText = offerIsLive \? "名額與付款連結已同步" : "正在取得最新名額與付款連結";', '', text, count=1)
text, count3 = re.subn(r'\n\s*<small class="sponsor-offer-sync\$\{offerIsLive \? " is-live" : ""\}">\$\{syncText\}</small>', '', text, count=1)
if (count1, count2, count3) != (1, 1, 1):
    raise SystemExit(f'expected 1/1/1 removals, got {count1}/{count2}/{count3}')
js.write_text(text, encoding='utf-8')

html = Path('articles.html')
html_text = html.read_text(encoding='utf-8')
html_text, count4 = re.subn(r'(sponsor-checkout\.js\?v=)[^"\']+', r'\g<1>20260806-remove-sync-text-2', html_text, count=1)
if count4 != 1:
    raise SystemExit(f'expected one cache version update, got {count4}')
html.write_text(html_text, encoding='utf-8')

print('Removed sponsor sync text and related styling.')
