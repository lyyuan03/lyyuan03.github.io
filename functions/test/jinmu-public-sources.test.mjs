import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("retired construction previews and injectors cannot expose protected bodies", async () => {
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  for (const file of ["construction-record-admin.js", "construction-record-page.js", "construction-cover-lock.js", "construction-record-extra-images.js"]) {
    assert.ok((await read(file)).length < 500, `${file} must stay retired`);
  }
  const preview = await read("construction-preview.html");
  assert.ok(preview.length < 1000);
  assert.equal(preview.includes('class="article-body"'), false);
  assert.equal((await read("articles.html")).includes('src="/construction-record-extra-images.js'), false);
});
