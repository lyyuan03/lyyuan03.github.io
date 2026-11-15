"""2027 丁未年生肖頁：專屬全文閱讀狀態與閱讀元件的隔離測試（不連 Firebase、不需任何憑證）。

以 Playwright 攔截 firebase-config.js 與 Firebase SDK，換成本機假模組，
讓 zodiac-lamp-reader.js（真實程式碼）在各種登入／權限狀態下執行，檢查：
  - 未登入、未授權、其他生肖、網路錯誤、授權、管理員預覽、登出後 的畫面與 DOM
  - 未授權狀態下 DOM 與目錄不含任何專屬文字
  - 授權後目錄、節氣時間軸、年度總結、引言、章節進場、閱讀進度、錨點不被導覽列遮住
  - 390px 無橫向溢出、prefers-reduced-motion
專屬內容使用 scripts/tests/zodiac-reader-fixture.txt 的版型測試資料（非正式文章）。
Firestore 規則本身的權限測試在 dingwei-zodiac-rules.test.mjs（模擬器）。

用法：在 repo 根目錄啟動 `python3 -m http.server 8123 --bind 127.0.0.1`，再執行
  python3 scripts/tests/zodiac-reader-states.py [截圖輸出資料夾]
"""
import asyncio, json, sys, pathlib
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123"
PAGE = f"{BASE}/2027-zodiac-rat.html"
ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURE = (ROOT / "scripts/tests/zodiac-reader-fixture.txt").read_text(encoding="utf-8")
MARK = "版型測試資料"            # 只出現在專屬測試正文
PRIVATE_HEADS = ["測試章節一", "十二節氣月（測試）", "年度總結與修行建議（測試）"]
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/zodiac-reader-shots")
OUT.mkdir(parents=True, exist_ok=True)

MOCK_CONFIG = """
export const auth = { get currentUser(){ return window.__MOCK__.user; } };
export const db = {}; export const provider = {};
export const ADMIN_EMAILS = ["lyyuan03@gmail.com"];
export function isAdminEmail(e){ return String(e||"").trim().toLowerCase() === "lyyuan03@gmail.com"; }
"""
MOCK_AUTH = """
export function onAuthStateChanged(a, cb){ window.__authCb = cb; setTimeout(() => cb(window.__MOCK__.user), 30); return () => {}; }
"""
MOCK_FS = """
export const doc = (db, c, id) => ({ c, id });
export async function getDoc(ref){
  window.__MOCK__.calls.push(ref.c + "/" + ref.id);
  const r = window.__MOCK__.handle(ref);
  if (r && r.error) { const e = new Error(r.error); e.code = r.error; throw e; }
  return { exists: () => !!(r && r.data), data: () => r && r.data };
}
"""

def scenario(user, body=None, ent=None):
    """body/ent：{"data":{...}} 或 {"error":"permission-denied"} 或 None（不存在）。"""
    return f"""
    window.__MOCK__ = {{
      user: {json.dumps(user)},
      calls: [],
      handle(ref) {{
        if (ref.c === "eventArticleBodies") return {json.dumps(body)};
        if (ref.c === "memberEntitlements") return {json.dumps(ent)};
        return null;
      }}
    }};"""

USER = {"email": "a@gmail.com", "uid": "u-a"}
ADMIN = {"email": "lyyuan03@gmail.com", "uid": "u-admin"}
DENIED = {"error": "permission-denied"}
GRANTED_BODY = {"data": {"status": "published", "active": True, "requiredPermission": "dingwei-2027-rat", "content": FIXTURE}}
SCENARIOS = {
    "signedOut": scenario(None),
    "noAccess": scenario(USER, DENIED, None),
    "otherZodiac": scenario(USER, DENIED, {"data": {"permissions": ["dingwei-2027-ox"]}}),
    "network": scenario(USER, {"error": "unavailable"}),
    "authExpired": scenario(USER, {"error": "unauthenticated"}),
    "notReady": scenario(USER, {"data": {"status": "published", "active": True, "requiredPermission": "dingwei-2027-ox", "content": FIXTURE}}),
    "granted": scenario(USER, GRANTED_BODY),
    "adminPreview": scenario(ADMIN, {"data": {"status": "published", "active": False, "requiredPermission": "dingwei-2027-rat", "content": FIXTURE}}),
    "adminEmpty": scenario(ADMIN, None),
}
XSS = '## <img src=x onerror="window.__xss=1">標題\n\n<script>window.__xss=2</script>段落\n\n> <b onmouseover="window.__xss=3">引言</b>\n\n**<img src=x onerror="window.__xss=4">粗體包住的注入**'
XSS_SCENARIO = scenario(USER, {"data": {"status": "published", "active": True, "requiredPermission": "dingwei-2027-rat", "content": XSS}})

results = []
def check(name, ok, info=""):
    results.append(("PASS" if ok else "FAIL", name, info))

async def open_page(browser, key, *, mobile=False, reduced=False):
    ctx = await browser.new_context(
        viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1,
        reduced_motion="reduce" if reduced else "no-preference")
    async def js(route, body):
        await route.fulfill(status=200, content_type="text/javascript", body=body)
    await ctx.route("**/firebase-config.js*", lambda r: js(r, MOCK_CONFIG))
    await ctx.route("https://www.gstatic.com/firebasejs/**/firebase-auth.js", lambda r: js(r, MOCK_AUTH))
    await ctx.route("https://www.gstatic.com/firebasejs/**/firebase-firestore.js", lambda r: js(r, MOCK_FS))
    await ctx.route("**/site-auth-nav.js*", lambda r: js(r, "export {};"))
    await ctx.route("**/analytics*.js", lambda r: js(r, ""))
    await ctx.route(lambda u: "fonts.g" in u, lambda r: r.abort())
    await ctx.add_init_script(SCENARIOS[key])
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(PAGE, wait_until="networkidle")
    await page.wait_for_function("document.querySelector('[data-lamp-reader]')?.dataset.lampState")
    await page.wait_for_timeout(200)
    return ctx, page, errors

async def stitched(page, name):
    """逐屏截圖再拼接：固定背景層在每一屏都依視窗大小呈現（整頁截圖只會畫在第一屏）。"""
    from PIL import Image
    import io
    await page.evaluate("document.documentElement.classList.remove('zm-ready'); document.querySelectorAll('.zm-progress').forEach(e=>e.remove())")
    total = await page.evaluate("document.documentElement.scrollHeight")
    vh = await page.evaluate("innerHeight")
    vw = await page.evaluate("innerWidth")
    scale = await page.evaluate("devicePixelRatio")
    canvas = Image.new("RGB", (int(vw * scale), int(total * scale)), "white")
    y, hidden = 0, False
    while y < total:
        await page.evaluate(f"window.scrollTo(0,{y})")
        await page.wait_for_timeout(250)
        real = await page.evaluate("scrollY")
        img = Image.open(io.BytesIO(await page.screenshot()))
        canvas.paste(img, (0, int(real * scale)))
        if not hidden:  # 固定導覽列只保留在第一屏
            await page.add_style_tag(content=".global-site-nav,#site-auth-bar{visibility:hidden!important}@media(min-width:1360px){.zm-toc{visibility:hidden!important}}")
            hidden = True
        y += vh
    await page.evaluate("document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('visibility:hidden!important')) s.remove(); })")
    canvas.save(str(OUT / name))
    await page.evaluate("window.scrollTo(0,0)")

async def lamp_state(page):
    return await page.evaluate("document.querySelector('[data-lamp-reader]').dataset.lampState")

async def leaks(page):
    return await page.evaluate("""(args) => {
      const html = document.documentElement.outerHTML;
      const toc = document.querySelector('.zm-toc')?.textContent || '';
      return { inDom: html.includes(args.mark), inToc: args.heads.some(h => toc.includes(h)) };
    }""", {"mark": MARK, "heads": PRIVATE_HEADS})

async def shot_lamp(page, name):
    await page.evaluate("document.documentElement.classList.remove('zm-ready')")
    el = page.locator("[data-lamp-reader]")
    await el.scroll_into_view_if_needed()
    await page.wait_for_timeout(150)
    box = await el.bounding_box()
    await page.screenshot(path=str(OUT / name), clip={"x": max(0, box["x"] - 40), "y": box["y"] - 90 + (await page.evaluate("scrollY")),
                          "width": min(box["width"] + 80, 1440), "height": min(box["height"] + 140, 900)}, full_page=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # ---- 每一種權限狀態 ----
        expect_copy = {
            "signedOut": "登入閱讀年度點燈專屬內容", "noAccess": "目前尚未開通閱讀資格",
            "otherZodiac": "此生肖內容尚未開放閱讀", "network": "網路連線不穩定",
            "authExpired": "登入狀態已失效", "notReady": "本生肖專屬全文尚未開放",
            "granted": "年度點燈專屬解讀", "adminPreview": "管理員預覽", "adminEmpty": "尚未建立此生肖的限定正文",
        }
        for key in SCENARIOS:
            ctx, page, errors = await open_page(browser, key)
            state = await lamp_state(page)
            check(f"{key}：狀態正確", state == key, state)
            text = await page.locator("[data-lamp-reader]").inner_text()
            check(f"{key}：提示文字正確", expect_copy[key] in text)
            lk = await leaks(page)
            if key in ("granted", "adminPreview"):
                check(f"{key}：顯示專屬正文", lk["inDom"])
                check(f"{key}：目錄含專屬章節", lk["inToc"])
            else:
                check(f"{key}：DOM 不含任何專屬文字", not lk["inDom"])
                check(f"{key}：目錄不含專屬章節標題", not lk["inToc"])
            if key == "signedOut":
                calls = await page.evaluate("window.__MOCK__.calls")
                check("signedOut：未登入時不向資料庫讀取正文", calls == [], json.dumps(calls))
                check("signedOut：顯示登入按鈕", await page.locator(".zp-lamp-login").count() == 1)
            if key in ("network", "error"):
                check(f"{key}：提供重新載入按鈕", await page.locator(".zp-lamp-retry").count() == 1)
            check(f"{key}：無 JavaScript 錯誤", not errors, "; ".join(errors))
            if key in ("signedOut", "noAccess", "otherZodiac", "network"):
                await shot_lamp(page, f"state-{key}.png")
            await ctx.close()

        # ---- 正文含 HTML 時一律以文字呈現 ----
        SCENARIOS["xss"] = XSS_SCENARIO
        ctx, page, errors = await open_page(browser, "xss")
        x = await page.evaluate("""() => ({ flag: window.__xss, tags: document.querySelectorAll('.zr-exclusive img, .zr-exclusive script, .zr-exclusive b').length,
          shown: document.querySelector('.zr-exclusive').textContent.includes('<script>'),
          strongTags: document.querySelectorAll('.zr-exclusive strong').length,
          strongText: document.querySelector('.zr-exclusive strong')?.textContent || '' })""")
        check("正文含 HTML：不執行、不產生標籤，以純文字顯示", x["flag"] is None and x["tags"] == 0 and x["shown"], json.dumps(x))
        check("粗體包住 HTML 注入：只產生 <strong>，裡面是逐字顯示的文字，不會額外長出 <img>", x["strongTags"] >= 1 and "<img" in x["strongText"], json.dumps(x))
        await ctx.close()
        del SCENARIOS["xss"]

        # ---- 授權後：閱讀元件 ----
        ctx, page, errors = await open_page(browser, "granted")
        info = await page.evaluate("""() => ({
          h2: document.querySelectorAll('.zr-exclusive h2').length,
          months: document.querySelectorAll('.zr-timeline .zr-month').length,
          chips: document.querySelectorAll('.zr-month-nav a').length,
          summary: !!document.querySelector('.zr-summary h2'),
          quote: document.querySelectorAll('.zr-quote').length,
          tocGroups: [...document.querySelectorAll('.zm-toc .zm-toc-group')].map(e => e.textContent),
          tocLinks: document.querySelectorAll('.zm-toc a').length,
          tocOpen: document.querySelector('.zm-toc')?.open,
          tocFixed: getComputedStyle(document.querySelector('.zm-toc')).position,
          scriptInjected: document.querySelector('.zr-exclusive script, .zr-exclusive [onerror]') !== null,
          boldText: document.querySelector('.zr-exclusive strong')?.textContent || '',
          boldHtml: document.querySelector('.zr-exclusive strong')?.outerHTML || '',
          loneStarKept: document.querySelector('.zr-exclusive').textContent.includes('本句只有一個 * 符號')
        })""")
        check("授權：專屬章節 4 個（依測試原稿）", info["h2"] == 4, str(info["h2"]))
        check("授權：節氣時間軸 12 個月份，順序完整", info["months"] == 12, str(info["months"]))
        check("授權：月份導覽 12 個", info["chips"] == 12)
        check("授權：年度總結版面", info["summary"])
        check("授權：引言只來自原稿標記（1 則）", info["quote"] == 1)
        check("授權：目錄分為公開篇／點燈專屬", info["tocGroups"] == ["公開篇", "點燈專屬"], str(info["tocGroups"]))
        check("授權：桌面寬螢幕目錄固定於側邊", info["tocFixed"] == "fixed", info["tocFixed"])
        check("授權：正文不產生可執行標籤", not info["scriptInjected"])
        check("授權：成對 ** 轉為 <strong>，文字不增刪", info["boldText"] == "粗體測試：", info["boldText"])
        check("授權：<strong> 不含其他標籤或屬性", info["boldHtml"] == "<strong>粗體測試：</strong>", info["boldHtml"])
        check("授權：單獨的 * 原樣保留，不被誤判為粗體", info["loneStarKept"])
        order = await page.evaluate("[...document.querySelectorAll('.zr-month h3')].map(h => h.textContent.slice(0,2)).join('')")
        check("授權：月份順序與原稿一致", order == "寅月卯月辰月巳月午月未月申月酉月戌月亥月子月丑月", order)

        # 捲動進度與章節進場
        p0 = await page.evaluate("getComputedStyle(document.querySelector('.zm-progress')).getPropertyValue('--zm-progress')")
        await page.evaluate("document.querySelector('.zr-summary').scrollIntoView()")
        await page.wait_for_timeout(900)
        p1 = await page.evaluate("getComputedStyle(document.querySelector('.zm-progress')).getPropertyValue('--zm-progress')")
        check("閱讀進度隨捲動延伸", float(p1 or 0) > float(p0 or 0), f"{p0} → {p1}")
        revealed = await page.evaluate("document.querySelector('.zr-summary h2').classList.contains('zm-in')")
        check("動態載入的章節標題進場（zm-in）", revealed)
        current = await page.evaluate("document.querySelector('.zm-toc a[aria-current]')?.textContent")
        check("目錄標示目前章節", current and "年度總結" in current, str(current))

        # 錨點不被導覽列遮住
        await page.evaluate("window.scrollTo(0,0)")
        await page.click(".zm-toc a[href='#zr-s4']")
        await page.wait_for_timeout(800)
        top = await page.evaluate("document.getElementById('zr-s4').getBoundingClientRect().top")
        navb = await page.evaluate("document.querySelector('.global-site-nav').getBoundingClientRect().bottom")
        check("目錄跳轉後標題不被固定導覽列遮住", top >= navb, f"title top {top:.0f} / nav bottom {navb:.0f}")
        await page.click(".zr-month-nav a[href='#zr-m3']")
        await page.wait_for_timeout(800)
        top = await page.evaluate("document.getElementById('zr-m3').getBoundingClientRect().top")
        check("月份導覽跳轉後標題可見", top >= navb, f"{top:.0f}")

        await page.evaluate("window.scrollTo(0,0)")
        await stitched(page, "rat-granted-desktop-full.png")

        # 生肖切換 hover
        sw = page.locator(".zr-switch")
        await sw.scroll_into_view_if_needed()
        await page.hover(".zr-switch-next")
        await page.wait_for_timeout(350)
        box = await sw.bounding_box()
        await page.screenshot(path=str(OUT / "switch-hover.png"), clip={"x": box["x"] - 20, "y": box["y"] - 20 + await page.evaluate("scrollY"), "width": box["width"] + 40, "height": box["height"] + 50}, full_page=True)
        hrefs = await page.evaluate("[...document.querySelectorAll('.zr-switch a')].map(a => a.getAttribute('href'))")
        check("生肖切換連結：上一豬／總覽／下一牛", hrefs == ["/2027-zodiac-pig.html", "/2027-zodiac.html", "/2027-zodiac-ox.html"], str(hrefs))
        await page.click(".zr-switch-next")
        await page.wait_for_load_state("domcontentloaded")
        check("點擊下一生肖導向屬牛頁", page.url.endswith("/2027-zodiac-ox.html"), page.url)
        await page.go_back()
        await page.wait_for_function("document.querySelector('[data-lamp-reader]')?.dataset.lampState === 'granted'")

        # 登出：私人正文與目錄標題必須一併移除
        await page.evaluate("window.__MOCK__.user = null; window.__authCb(null)")
        await page.wait_for_timeout(200)
        lk = await leaks(page)
        check("登出後 DOM 不再含專屬文字", not lk["inDom"])
        check("登出後目錄移除專屬章節標題", not lk["inToc"])
        check("登出後回到登入提示", await lamp_state(page) == "signedOut")
        check("授權頁無 JavaScript 錯誤", not errors, "; ".join(errors))
        await ctx.close()

        # ---- 手機 390px ----
        ctx, page, errors = await open_page(browser, "granted", mobile=True)
        overflow = await page.evaluate("document.documentElement.scrollWidth")
        check("390px：無橫向溢出", overflow <= 390, str(overflow))
        fs = await page.evaluate("parseFloat(getComputedStyle(document.querySelector('.zr-exclusive p')).fontSize)")
        check("390px：正文字級不小於 16px", fs >= 16, str(fs))
        toc_pos = await page.evaluate("getComputedStyle(document.querySelector('.zm-toc')).position")
        check("390px：目錄為折疊式（不固定於側邊）", toc_pos != "fixed", toc_pos)
        is_open = await page.evaluate("document.querySelector('.zm-toc').open")
        check("390px：目錄預設收合", is_open is False)
        await page.evaluate("document.documentElement.classList.remove('zm-ready'); document.querySelectorAll('.zm-progress').forEach(e=>e.remove())")
        toc = page.locator(".zm-toc")
        await toc.scroll_into_view_if_needed()
        await page.wait_for_timeout(200)
        await toc.screenshot(path=str(OUT / "toc-mobile-closed.png"))
        await page.tap(".zm-toc summary")
        await page.wait_for_timeout(300)
        await toc.screenshot(path=str(OUT / "toc-mobile-open.png"))
        check("390px：點選後目錄展開", await page.evaluate("document.querySelector('.zm-toc').open"))
        await page.tap(".zm-toc a[href='#zr-s2']")
        await page.wait_for_timeout(700)
        check("390px：選取章節後目錄自動收合", await page.evaluate("!document.querySelector('.zm-toc').open"))
        await stitched(page, "rat-granted-mobile-full.png")
        check("390px：無 JavaScript 錯誤", not errors, "; ".join(errors))
        await ctx.close()

        ctx, page, errors = await open_page(browser, "signedOut", mobile=True)
        overflow = await page.evaluate("document.documentElement.scrollWidth")
        check("390px 未登入：無橫向溢出", overflow <= 390, str(overflow))
        await stitched(page, "rat-signedout-mobile-full.png")
        await ctx.close()
        ctx, page, errors = await open_page(browser, "signedOut")
        await stitched(page, "rat-signedout-desktop-full.png")
        await ctx.close()

        # ---- 減少動態 ----
        ctx, page, errors = await open_page(browser, "granted", reduced=True)
        r = await page.evaluate("""() => ({
          ready: document.documentElement.classList.contains('zm-ready'),
          progress: !!document.querySelector('.zm-progress'),
          op: getComputedStyle(document.querySelector('.zr-exclusive h2')).opacity,
          toc: !!document.querySelector('.zm-toc')
        })""")
        check("減少動態：不啟用進場動畫", not r["ready"])
        check("減少動態：不顯示進度動畫", not r["progress"])
        check("減少動態：標題完全可見", r["op"] == "1", r["op"])
        check("減少動態：目錄仍可使用", r["toc"])
        await ctx.close()

        await browser.close()

    for status, name, info in results:
        print(f"{status}  {name}" + (f"  〔{info}〕" if info and status == "FAIL" else ""))
    failed = sum(1 for r in results if r[0] == "FAIL")
    print(f"\n{len(results) - failed}/{len(results)} 通過；截圖：{OUT}")
    sys.exit(1 if failed else 0)

asyncio.run(main())
