#!/usr/bin/env node
// 全站頁尾同步：以 partials/site-footer.html 為唯一範本，改寫所有頁面的 <footer>，並確保載入 site-footer.css。
// 用法：node scripts/sync-footer.mjs        同步（改寫檔案）
//       node scripts/sync-footer.mjs --check 只檢查，有不一致就以非 0 結束
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const template = readFileSync(join(root, 'partials/site-footer.html'), 'utf8').trim();
const css = readFileSync(join(root, 'site-footer.css'));
const version = createHash('sha1').update(css).update(template).digest('hex').slice(0, 8);
const linkTag = `<link rel="stylesheet" href="/site-footer.css?v=${version}">`;
// 預覽、後台與暫存頁不納入（沒有頁尾的頁面本來就不會被改）
const skip = /(^|\/)(node_modules|\.git|partials|previews|scripts)(\/|$)|preview|admin/i;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  const rel = relative(root, p);
  if (skip.test(rel)) return [];
  return statSync(p).isDirectory() ? walk(p) : rel.endsWith('.html') ? [rel] : [];
});

const bad = [];
let changed = 0;
for (const rel of walk(root)) {
  const file = join(root, rel);
  const src = readFileSync(file, 'utf8');
  const matches = src.match(/<footer\b[\s\S]*?<\/footer>/g) || [];
  if (!matches.length) continue;
  if (matches.length > 1) { bad.push(`${rel}：有 ${matches.length} 個 <footer>`); continue; }
  let out = src.replace(/<footer\b[\s\S]*?<\/footer>/, () => template);
  if (/<link[^>]+site-footer\.css[^>]*>/.test(out)) out = out.replace(/<link[^>]+site-footer\.css[^>]*>/, linkTag);
  else out = out.replace(/<\/head>/i, `${linkTag}\n</head>`);
  if (out !== src) { changed++; if (check) bad.push(`${rel}：頁尾與範本不一致`); else writeFileSync(file, out); }
}
if (bad.length) { console.error(bad.join('\n')); if (check) process.exit(1); }
console.log(check ? '頁尾檢查通過：所有頁面與範本一致' : `已同步 ${changed} 個頁面（CSS 版本 ${version}）`);
