#!/usr/bin/env node
// 課程共用「課程督導」區塊同步：內容設定於 partials/course-instructor.config.json，樣式在 course-instructor.css。
// 頁面內以 <!-- course-instructor:start --> … <!-- course-instructor:end --> 標記範圍。
// 用法：node scripts/sync-course-instructor.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const c = JSON.parse(readFileSync(join(root, 'partials/course-instructor.config.json'), 'utf8'));
const css = readFileSync(join(root, 'course-instructor.css'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const render = (extra) => `<section class="ci" id="instructor" aria-label="${esc(c.label)}">
  <div class="ci-in">
    <figure class="ci-ph"><img src="${c.image}" alt="${esc(c.alt)}" width="2560" height="1440" loading="lazy"></figure>
    <div class="ci-copy">
      <span class="ci-label">${esc(c.label)}</span>
      <h2>${esc(c.name)}</h2>
      <p class="ci-role">${esc(c.role)}</p>
${c.paragraphs.map((p) => `      <p>${esc(p)}</p>`).join('\n')}${extra ? `\n      <div class="ci-extra">${extra}</div>` : ''}
    </div>
  </div>
</section>`;
const version = createHash('sha1').update(css).update(JSON.stringify(c)).digest('hex').slice(0, 8);
const linkTag = `<link rel="stylesheet" href="/course-instructor.css?v=${version}">`;
const re = /<!-- course-instructor:start -->[\s\S]*?<!-- course-instructor:end -->/;
const bad = []; let changed = 0;
for (const [page, opt] of Object.entries(c.pages)) {
  const file = join(root, page);
  const src = readFileSync(file, 'utf8');
  if (!re.test(src)) { bad.push(`${page}：找不到 course-instructor 標記`); continue; }
  let out = src.replace(re, () => `<!-- course-instructor:start -->\n${render(opt.extra)}\n<!-- course-instructor:end -->`);
  if (/<link[^>]+course-instructor\.css[^>]*>/.test(out)) out = out.replace(/<link[^>]+course-instructor\.css[^>]*>/, linkTag);
  else out = out.replace(/<\/head>/i, `${linkTag}\n</head>`);
  if (out !== src) { changed++; if (check) bad.push(`${page}：課程督導區塊與設定不一致`); else writeFileSync(file, out); }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(check ? '課程督導區塊檢查通過' : `已同步 ${changed} 個課程頁`);
