import { chromium } from "playwright";
import crypto from "node:crypto";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";
const url = base + "/articles.html?id=yuanshen-awakening-old-manuscript";
const browser = await chromium.launch({ headless: true });
const results = [];

for (let i = 1; i <= 5; i += 1) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    locale: "zh-TW",
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(String(err).slice(0, 500)));

  let navigationStatus = 0;
  let navigationError = "";
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    navigationStatus = response?.status() || 0;
  } catch (error) {
    navigationError = String(error);
  }

  try {
    await page.waitForSelector('.article-view[data-article-id="yuanshen-awakening-old-manuscript"]', { timeout: 12000 });
  } catch {}
  try {
    await page.waitForSelector('[data-paid-gate-restored], .article-paid-gate', { timeout: 8000 });
  } catch {}

  let responsive = false;
  try {
    responsive = await Promise.race([
      page.evaluate(() => new Promise(resolve => setTimeout(() => resolve(true), 120))),
      new Promise(resolve => setTimeout(() => resolve(false), 3000))
    ]);
  } catch {}

  const state = await page.evaluate(() => {
    const view = document.querySelector('.article-view[data-article-id="yuanshen-awakening-old-manuscript"]');
    const body = view?.querySelector(":scope > .article-body");
    const text = (body?.innerText || "").replace(/\s+/g, " ").trim();
    return {
      readyState: document.readyState,
      hasView: Boolean(view),
      articleAccess: view?.dataset.articleAccess || "",
      gateCount: (view?.querySelectorAll("[data-paid-gate-restored], .article-paid-gate").length || 0),
      privateBodyCount: view?.querySelectorAll("[data-paid-private-body]").length || 0,
      publicBodyText: text,
      bodyChars: text.length,
      navPresent: Boolean(document.querySelector("nav, .site-header"))
    };
  }).catch(() => ({
    readyState: "",
    hasView: false,
    articleAccess: "",
    gateCount: 0,
    privateBodyCount: 0,
    publicBodyText: "",
    bodyChars: 0,
    navPresent: false
  }));

  const bodyHash = crypto.createHash("sha256").update(state.publicBodyText).digest("hex");
  const passed = navigationStatus === 200
    && !navigationError
    && responsive
    && state.hasView
    && state.articleAccess === "paid"
    && state.gateCount === 1
    && state.privateBodyCount === 0
    && state.bodyChars > 900
    && state.publicBodyText.includes('他的老師已經「看過」了。')
    && state.navPresent
    && pageErrors.length === 0;

  results.push({
    run: i,
    passed,
    navigationStatus,
    navigationError,
    responsive,
    bodyHash,
    pageErrors,
    ...state,
    publicBodyText: undefined
  });
  await context.close();
}

await browser.close();

const hashes = new Set(results.map(r => r.bodyHash));
const allPassed = results.every(r => r.passed) && hashes.size === 1;

console.log(JSON.stringify({
  url,
  allPassed,
  stableBody: hashes.size === 1,
  uniqueBodyHashes: [...hashes],
  results
}, null, 2));

if (!allPassed) process.exit(2);
