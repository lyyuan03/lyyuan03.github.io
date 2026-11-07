import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block", locale: "zh-TW" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push("PAGEERROR " + String(error).slice(0, 500)));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE " + msg.text().slice(0, 300)); });
page.on("requestfailed", (req) => errors.push("REQUEST " + req.url().slice(0, 200) + " " + (req.failure()?.errorText || "")));
await page.goto(base + "/admin.html", { waitUntil: "domcontentloaded", timeout: 30000 });
try {
  await page.waitForFunction(() => document.getElementById("admin-login")?.disabled === false, null, { timeout: 18000 });
} catch {}
const result = await page.evaluate(() => ({
  enabled: document.getElementById("admin-login")?.disabled === false,
  label: document.getElementById("admin-login")?.textContent?.trim(),
  status: document.getElementById("gate-status")?.textContent?.trim(),
  appHidden: document.getElementById("admin-app")?.classList.contains("hidden"),
  ready: document.readyState
}));
console.log(JSON.stringify({ result, errors: errors.slice(0, 30) }, null, 2));

// 靜態文章模組缺失或被阻擋時，後台的登入仍必須啟用。
const failedContext = await browser.newContext({ serviceWorkers: "block", locale: "zh-TW" });
await failedContext.route(/\\/static-articles\\.js(?:\\?|$)/, (route) => route.abort("failed"));
const failedPage = await failedContext.newPage();
const degradedErrors = [];
failedPage.on("pageerror", (error) => degradedErrors.push(String(error).slice(0, 300)));
await failedPage.goto(base + "/admin.html", { waitUntil: "domcontentloaded", timeout: 30000 });
try {
  await failedPage.waitForFunction(() => document.getElementById("admin-login")?.disabled === false, null, { timeout: 18000 });
} catch {}
const degraded = await failedPage.evaluate(() => ({
  enabled: document.getElementById("admin-login")?.disabled === false,
  appHidden: document.getElementById("admin-app")?.classList.contains("hidden"),
  status: document.getElementById("gate-status")?.textContent?.trim()
}));
console.log(JSON.stringify({ degraded, degradedErrors }, null, 2));
await failedContext.close();
await browser.close();
if (!result.enabled || !degraded.enabled || !degraded.appHidden) process.exit(2);
