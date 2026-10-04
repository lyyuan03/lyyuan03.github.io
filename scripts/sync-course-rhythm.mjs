#!/usr/bin/env node
// 課程頁共用版面尺度：確保所有課程頁在 </head> 前最後載入 /course-rhythm.css。
// 用法：node scripts/sync-course-rhythm.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const pages = [
  'courses/spiritual-awakening.html',
  'courses/spiritual-awakening-advanced.html',
  'courses/refined-dialogue.html',
  'courses/male-yoga-energy.html',
  'courses/male-yoga-energy-advanced.html',
  'courses/lingji-practice.html',
];
const version = createHash('sha1').update(readFileSync(join(root, 'course-rhythm.css'))).digest('hex').slice(0, 8);
const tag = `<link rel="stylesheet" href="/course-rhythm.css?v=${version}">`;
const bad = []; let changed = 0;
for (const page of pages) {
  const file = join(root, page);
  const src = readFileSync(file, 'utf8');
  let out = src.replace(/\s*<link[^>]+course-rhythm\.css[^>]*>/g, '');
  out = out.replace(/<\/head>/i, `${tag}\n</head>`);
  if (out !== src) { changed++; if (check) bad.push(`${page}：未載入最新的 course-rhythm.css`); else writeFileSync(file, out); }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(check ? '課程頁版面尺度檢查通過' : `已同步 ${changed} 個課程頁`);
