#!/usr/bin/env node
// 實體課程共用「報名與洽詢」區塊同步：內容設定於 partials/course-contact.config.json。
// 頁面內以 <!-- course-contact:start --> … <!-- course-contact:end --> 標記範圍。
// 用法：node scripts/sync-course-contact.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const config = JSON.parse(readFileSync(join(root, 'partials/course-contact.config.json'), 'utf8'));
const css = readFileSync(join(root, 'course-contact.css'));
const FACEBOOK = 'https://www.facebook.com/lyy.taiwan';
const TELEGRAM = 'https://t.me/lyyuan';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const keepBr = (s) => esc(s).replace(/&lt;br>/g, '<br>');

const render = (c) => {
  const id = c.id;
  const actions = [];
  if (c.facebook !== false) actions.push(`<a class="cc-btn" href="${FACEBOOK}" target="_blank" rel="noopener noreferrer">查看開課公告</a>`);
  actions.push(`<a class="cc-btn${c.facebook === false ? '' : ' is-ghost'}" href="${TELEGRAM}" target="_blank" rel="noopener noreferrer">詢問課務</a>`);
  return `<section class="course-contact" id="${id}" aria-labelledby="${id}-title">
  <div class="cc-wrap">
    <div class="cc-main">
      <h2 class="cc-title" id="${id}-title">${keepBr(c.title)}</h2>
      <p class="cc-lead">${esc(c.lead)}</p>
      <div class="cc-actions">${actions.join('')}</div>
      <a class="cc-cross" href="${c.cross.href}">${esc(c.cross.text)}</a>
    </div>
    <aside class="cc-info" aria-label="報名與洽詢資訊">
      <p class="cc-state">${esc(c.state)}</p>
      <dl>
        <div><dt>場次與費用</dt><dd>${esc(c.fee)}</dd></div>
        <div><dt>參與資格</dt><dd>${esc(c.qualification)}</dd></div>
        <div><dt>行政聯絡</dt><dd><a href="${TELEGRAM}" target="_blank" rel="noopener noreferrer">Telegram｜靈元院行政窗口 ↗</a><small>服務時間 09:00–17:00，假日不回覆。</small></dd></div>
      </dl>${c.note ? `\n      <p class="cc-note">${esc(c.note)}</p>` : ''}
    </aside>
  </div>
</section>`;
};

const blocks = Object.entries(config).map(([page, c]) => [page, render(c)]);
const version = createHash('sha1').update(css).update(blocks.map((b) => b[1]).join('')).digest('hex').slice(0, 8);
const linkTag = `<link rel="stylesheet" href="/course-contact.css?v=${version}">`;
const re = /<!-- course-contact:start -->[\s\S]*?<!-- course-contact:end -->/;
const bad = []; let changed = 0;
for (const [page, html] of blocks) {
  const file = join(root, page);
  const src = readFileSync(file, 'utf8');
  if (!re.test(src)) { bad.push(`${page}：找不到 course-contact 標記`); continue; }
  let out = src.replace(re, () => `<!-- course-contact:start -->\n${html}\n<!-- course-contact:end -->`);
  if (/<link[^>]+course-contact\.css[^>]*>/.test(out)) out = out.replace(/<link[^>]+course-contact\.css[^>]*>/, linkTag);
  else out = out.replace(/<\/head>/i, `${linkTag}\n</head>`);
  if (out !== src) { changed++; if (check) bad.push(`${page}：洽詢區塊與設定不一致`); else writeFileSync(file, out); }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(check ? '課程洽詢區塊檢查通過' : `已同步 ${changed} 個課程頁`);
