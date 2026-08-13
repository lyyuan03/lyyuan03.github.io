import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(label);
};

const publishedArticleIds = [
  "2058-future-person-prophecy",
  "quantum-frequency-work-wish",
  "this-book-took-thirty-years",
  "yuanshen-destiny-archetype",
  "love-beyond-filial-piety-and-ancestor-worship",
  "how-to-judge-true-lingxiu-understanding",
  "reading-you-can-not-fear-death",
  "wealth-as-water",
  "fantasy-intuition-or-yuanshen",
  "celebrity-death-dream-spirit-five-checks",
  "wealth-discipline-investing-and-self-mastery",
  "japan-temple-faith-and-decline",
  "spiritual-practice-cannot-be-outsourced-to-gods",
  "jitong-leader-discernment",
  "jitong-discernment-before-exorcism",
  "good-fortune-believe-in-yourself-choices",
  "yuanshen-awakening-eleven-principles",
  "seven-twenty-five-election-shift",
  "tonglingren-wufa-huifu-putongren",
  "market-crash-money-self-control",
  "jitong-shenming-fushen",
  "lingxiu-yuanshen-reality",
  "lingxiu-zouhuo-rumo",
  "2026-guanyin-vow-lamp-record-v2"
];

const resources = read("article-reading-resources.js");
const core = read("articles-core-20260810-v6.js");
const page = read("articles.html");
const admin = read("admin.html");
const adminCore = read("article-admin-core.js");
const standalone = read("article/this-book-took-thirty-years-v5.html");

publishedArticleIds.forEach((id) => {
  requireText(resources, `"${id}":`, `缺少已發布文章書目對應：${id}`);
});

[
  "function firstArticleImage(article)",
  "function relatedArticleFor(article)",
  "function renderNextReading(article)",
  "function renderRecommendedBook(article)",
  "recommendedBookForArticle(article)",
  "next-reading-thumbnail",
  "recommended-book-cover",
  "延伸閱讀",
  "延伸書籍"
].forEach((text) => requireText(core, text, `核心缺少：${text}`));

[
  ".next-reading-thumbnail img",
  ".recommended-book-link",
  ".recommended-book-cover img",
  ".recommended-book-cover.is-landscape img"
].forEach((text) => requireText(page, text, `前台樣式缺少：${text}`));

[
  'id="bookTitle"',
  'id="bookPurchaseUrl"',
  'id="bookCoverImage"',
  "每篇必填"
].forEach((text) => requireText(admin, text, `後台欄位缺少：${text}`));
requireText(adminCore, "bookCoverImage", "後台資料流程未保存書封欄位");

[
  "next-reading-thumbnail",
  "recommended-book",
  "recommended-book-cover",
  "延伸閱讀",
  "延伸書籍"
].forEach((text) => requireText(standalone, text, `獨立文章頁缺少：${text}`));

if (resources.match(/coverImage:/g)?.length < 15) {
  failures.push("延伸書籍書目封面數量不足");
}

if (read("article-wealth-as-water.js").includes("0011029318")) {
  failures.push("《請問財富》仍錯誤連到《請問鬼怪》");
}

if (read("article-how-to-judge-true-lingxiu-understanding-display.js").includes("next-reading")) {
  failures.push("〈如何判斷真正靈修〉仍會重複插入延伸閱讀");
}

if (failures.length) {
  console.error(`文章固定結尾稽核失敗（${failures.length} 項）`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`文章固定結尾稽核通過：${publishedArticleIds.length} 篇已發布文章皆有書目對應，延伸閱讀與書封元件完整。`);
}
