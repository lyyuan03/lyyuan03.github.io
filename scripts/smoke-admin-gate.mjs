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
await browser.close();
if (!result.enabled) process.exit(2);
