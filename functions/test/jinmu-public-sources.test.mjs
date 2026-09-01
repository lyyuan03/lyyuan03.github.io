import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
test("retired construction previews and injectors cannot expose protected bodies", async () => {
  for (const file of ["construction-record-admin.js", "construction-record-page.js", "construction-cover-lock.js", "construction-record-extra-images.js"]) {
    assert.ok((await read(file)).length < 500, `${file} must stay retired`);
  }
  const preview = await read("construction-preview.html");
  assert.ok(preview.length < 1000);
  assert.equal(preview.includes('class="article-body"'), false);
  assert.equal((await read("articles.html")).includes('src="/construction-record-extra-images.js'), false);
});
test("four event articles cannot be recovered from a historical public commit", async () => {
  const source = await read("functions/jinmu-series-sync.mjs");
  assert.equal(source.includes("raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/"), false);
  for (const file of ["article-2026-yaochi-birthday-morning.js", "article-reconciliation-absolution-heart.js"]) {
    const module = await read(file);
    assert.equal(module.includes("String.raw`"), false);
    assert.equal(module.includes("content: `"), false);
  }
});
