import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";
const source = "https://raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/fab40ab2e214f5a70bf7d7f49ab575cb3dbaa900/courses/male-yoga-energy.html";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block", locale: "zh-TW" });
const page = await context.newPage();

const originalStory = Array.from({ length: 12 }, (_, i) =>
  "<p>" + (i === 4 ? "男性身體的課程說明" : "歷史段落-" + i) + "</p>").join("");
const fixture = "<section id='workshop'><div class='workshop-story'>" + originalStory + "</div></section>";
await page.route(source, async (route) => {
  await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8",
    headers: { "access-control-allow-origin": "*" }, body: fixture });
});
await page.goto(base + "/courses/male-yoga-energy.html", { waitUntil: "domcontentloaded", timeout: 30000 });
const result = await page.evaluate(async () => {
  const { recoverLegacyMaleYogaBody } = await import("/courses/male-yoga-legacy-recovery.js");
  const html = await recoverLegacyMaleYogaBody();
  return { hasRecoveredHeading: html.includes("課程詳細內容"),
    hasDetail: html.includes("男性身體的課程說明"),
    paragraphCount: (html.match(/<p>/g) || []).length,
    hasScript: /<script/i.test(html) };
});
console.log(JSON.stringify(result));
await context.close();
await browser.close();
if (!result.hasRecoveredHeading || !result.hasDetail || result.paragraphCount !== 12 || result.hasScript) process.exit(2);
