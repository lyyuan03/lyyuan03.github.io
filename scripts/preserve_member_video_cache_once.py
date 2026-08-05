from pathlib import Path
p = Path('admin.html')
text = p.read_text(encoding='utf-8')
old = 'member-video-admin.js?v=20260801-private-youtube-1'
new = 'member-video-admin.js?v=20260805-cover-upload-4'
if old not in text:
    raise SystemExit('expected member video cache version not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
