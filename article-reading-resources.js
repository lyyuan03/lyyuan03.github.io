const BOOK_COVER_PROXY = "https://wsrv.nl/?w=480&output=webp&q=88&url=";

function booksCover(path) {
  return `${BOOK_COVER_PROXY}${encodeURIComponent(`https://www.books.com.tw/img/${path}.jpg`)}`;
}

/**
 * 文章結尾「延伸書籍」唯一書目來源。
 * 新增書目時必須同時提供可辨識書封、書名、作者與購書連結。
 */
export const recommendedBookCatalog = Object.freeze({
  yuanshenAwakening: Object.freeze({
    title: "我在人間的元神覺醒",
    author: "宇色 Osel",
    publisher: "柿子文化",
    purchaseUrl: "https://www.books.com.tw/products/0011060075?sloc=main",
    coverImage: booksCover("001/106/00/0011060075")
  }),
  lingxiuKeyReport: Object.freeze({
    title: "靈修人關鍵報告",
    author: "宇色 Osel",
    publisher: "柿子文化",
    purchaseUrl: "https://www.books.com.tw/products/0010784866?loc=P_0005_087",
    coverImage: booksCover("001/078/48/0010784866")
  }),
  goodFortune: Object.freeze({
    title: "喚醒天生好命",
    author: "宇色 Osel",
    publisher: "高寶",
    purchaseUrl: "https://www.books.com.tw/products/0011003625?loc=P_br_r0vq68ygz_D_2aabd0_B_1",
    coverImage: booksCover("001/100/36/0011003625")
  }),
  wealth: Object.freeze({
    title: "請問財富",
    author: "無極瑤池金母、宇色 Osel",
    publisher: "橡樹林",
    purchaseUrl: "https://www.kingstone.com.tw/basic/2012990002443/?lid=search&actid=WISE",
    coverImage: booksCover("001/102/93/0011029320")
  }),
  ghosts: Object.freeze({
    title: "請問鬼怪",
    author: "宇色 Osel",
    publisher: "橡樹林",
    purchaseUrl: "https://www.kingstone.com.tw/basic/2012990002313/?lid=search&actid=WISE",
    coverImage: booksCover("001/102/93/0011029318")
  }),
  love: Object.freeze({
    title: "請問愛：愛的真諦（上冊）",
    author: "宇色 Osel",
    publisher: "柿子文化",
    purchaseUrl: "https://www.books.com.tw/products/0011022589",
    coverImage: booksCover("001/102/25/0011022589")
  }),
  reincarnation: Object.freeze({
    title: "請問輪迴",
    author: "宇色 Osel",
    publisher: "柿子文化",
    purchaseUrl: "https://www.books.com.tw/products/0011002849",
    coverImage: booksCover("001/100/28/0011002849")
  }),
  lingxiuMaze: Object.freeze({
    title: "我在人間的靈修迷藏",
    author: "宇色 Osel",
    publisher: "柿子文化",
    purchaseUrl: "https://www.books.com.tw/products/0010719221",
    coverImage: booksCover("001/071/92/0010719221")
  }),
  spiritDialogue: Object.freeze({
    title: "我在人間與靈界對話",
    author: "宇色 Osel",
    purchaseUrl: "https://www.books.com.tw/products/0010944208",
    coverImage: booksCover("001/094/42/0010944208")
  }),
  worship: Object.freeze({
    title: "靈視拜拜",
    author: "宇色 Osel",
    purchaseUrl: "https://www.books.com.tw/products/0011015834",
    coverImage: booksCover("001/101/58/0011015834")
  }),
  faith: Object.freeze({
    title: "透視靈驗",
    author: "宇色 Osel",
    purchaseUrl: "https://www.books.com.tw/products/0010992671",
    coverImage: booksCover("001/099/26/0010992671")
  }),
  awakening: Object.freeze({
    title: "請問覺醒",
    author: "無極瑤池金母、宇色 Osel",
    purchaseUrl: "https://www.books.com.tw/products/0010903175?sloc=main",
    coverImage: booksCover("001/090/31/0010903175")
  }),
  fearOfDeath: Object.freeze({
    title: "你可以不怕死【暢銷23週年紀念版】",
    author: "一行禪師；胡因夢譯",
    publisher: "橡樹林文化",
    purchaseUrl: "https://www.books.com.tw/products/0011056002",
    coverImage: "assets/articles/you-can-not-fear-death/book-cover.webp"
  }),
  spiritualGoodDeath: Object.freeze({
    title: "靈性善終：臨終時刻的心靈轉化與陪伴指南",
    author: "凱思林．辛（Kathleen Dowling Singh）",
    publisher: "心靈工坊",
    purchaseUrl: "https://reurl.cc/1lKXqm",
    coverImage: booksCover("001/105/74/0011057470")
  }),
  wealthDiscipline: Object.freeze({
    title: "致富的定力",
    author: "陳韋峰",
    publisher: "橡樹林文化",
    purchaseUrl: "https://www.books.com.tw/products/0011056698",
    coverImage: "assets/articles/wealth-discipline/book-cover-photo.jpg"
  }),
  quantumPractice: Object.freeze({
    title: "「量子力學式」願望實現法則／「量子力學式」工作術",
    author: "村松大輔",
    coverImage: "assets/articles/quantum-frequency-work-wish/cover.webp",
    purchaseUrl: "https://search.books.com.tw/search/query/key/%E6%9D%91%E6%9D%BE%E5%A4%A7%E8%BC%94/adv_author/1/",
    coverStyle: "landscape"
  })
});

/** 已發布文章的主題對應。未知的新文章仍會依分類取得預設書目。 */
export const recommendedBookByArticle = Object.freeze({
  "2058-future-person-prophecy": "goodFortune",
  "collective-unconscious-election": "awakening",
  "quantum-frequency-work-wish": "quantumPractice",
  "this-book-took-thirty-years": "yuanshenAwakening",
  "yuanshen-destiny-archetype": "yuanshenAwakening",
  "love-beyond-filial-piety-and-ancestor-worship": "love",
  "how-to-judge-true-lingxiu-understanding": "lingxiuKeyReport",
  "reading-you-can-not-fear-death": "fearOfDeath",
  "wealth-as-water": "wealth",
  "fantasy-intuition-or-yuanshen": "lingxiuKeyReport",
  "celebrity-death-dream-spirit-five-checks": "ghosts",
  "wealth-discipline-investing-and-self-mastery": "wealthDiscipline",
  "spiritual-good-death-last-visit": "spiritualGoodDeath",
  "lingxiu-ghosts-past-lives-supernatural-knowing": "spiritualGoodDeath",
  "japan-temple-faith-and-decline": "faith",
  "spiritual-practice-cannot-be-outsourced-to-gods": "awakening",
  "jitong-leader-discernment": "lingxiuMaze",
  "jitong-discernment-before-exorcism": "ghosts",
  "good-fortune-believe-in-yourself-choices": "goodFortune",
  "yuanshen-awakening-eleven-principles": "yuanshenAwakening",
  "seven-twenty-five-election-shift": "awakening",
  "tonglingren-wufa-huifu-putongren": "lingxiuMaze",
  "market-crash-money-self-control": "wealth",
  "jitong-shenming-fushen": "spiritDialogue",
  "lingxiu-yuanshen-reality": "yuanshenAwakening",
  "lingxiu-zouhuo-rumo": "lingxiuMaze",
  "2026-yaochi-birthday-morning": "awakening",
  "reconciliation-absolution-heart": "reincarnation",
  "2026-building-patron-record": "faith",
  "2026-lineage-lamp-building-record": "faith",
  "blessing-teacher-discernment": "lingxiuMaze",
  "2026-guanyin-vow-lamp-record": "worship",
  "2026-guanyin-vow-lamp-record-v2": "worship"
});

const recommendedBookByCategory = Object.freeze({
  spiritual: "yuanshenAwakening",
  worldly: "goodFortune",
  "spirit-world": "ghosts",
  reading: "lingxiuKeyReport"
});

const titleAliases = Object.freeze([
  ["我在人間的元神覺醒", "yuanshenAwakening"],
  ["靈修人關鍵報告", "lingxiuKeyReport"],
  ["關鍵報告", "lingxiuKeyReport"],
  ["喚醒天生好命", "goodFortune"],
  ["請問財富", "wealth"],
  ["請問鬼怪", "ghosts"],
  ["請問愛", "love"],
  ["請問輪迴", "reincarnation"],
  ["靈修迷藏", "lingxiuMaze"],
  ["我在人間與靈界對話", "spiritDialogue"],
  ["靈視拜拜", "worship"],
  ["透視靈驗", "faith"],
  ["請問覺醒", "awakening"],
  ["你可以不怕死", "fearOfDeath"],
  ["致富的定力", "wealthDiscipline"],
  ["靈性善終", "spiritualGoodDeath"],
  ["量子力學式", "quantumPractice"]
]);

function articleKey(article = {}) {
  return article.id || article.slug || "";
}

function knownBookKeyFromTitle(title = "") {
  return titleAliases.find(([alias]) => title.includes(alias))?.[1] || "";
}

export function recommendedBookForArticle(article = {}) {
  const explicitTitle = String(article.bookTitle || "").trim();
  const knownTitleKey = knownBookKeyFromTitle(explicitTitle);
  const mappedArticleKey = recommendedBookByArticle[articleKey(article)] || "";
  const key = knownTitleKey
    || mappedArticleKey
    || recommendedBookByCategory[article.category]
    || "yuanshenAwakening";
  const fallback = recommendedBookCatalog[key] || recommendedBookCatalog.yuanshenAwakening;

  // Firestore 後台是文章書目欄位的唯一權威來源；
  // 後台有填值就直接使用，只有空白欄位才採用既有預設。
  return {
    ...fallback,
    title: explicitTitle || fallback.title,
    author: String(article.bookAuthor || "").trim() || fallback.author,
    publisher: String(article.bookPublisher || "").trim() || fallback.publisher,
    purchaseUrl: String(article.bookPurchaseUrl || "").trim() || fallback.purchaseUrl,
    coverImage: String(article.bookCoverImage || "").trim() || fallback.coverImage
  };
}

/**
 * 文章結尾「延伸閱讀」的編輯指定。依文章內容串成閱讀路線：
 * 同一系列依序銜接、避免兩篇互指繞圈，一般文章不導向活動限定文章。
 * 優先順序：後台文章欄位 nextReadingId ＞ 這份對應 ＞ 自動比對。
 * 新文章可以不填，pickNextReading() 會自動挑出主題最相近的一篇。
 */
export const nextReadingByArticle = Object.freeze({
  // 丙午無極瑤池金母聖誕專屬文選①→④，最後回到公開的建院植樹文章
  "2026-yaochi-birthday-morning": "reconciliation-absolution-heart",
  "reconciliation-absolution-heart": "2026-building-patron-record",
  "2026-building-patron-record": "2026-lineage-lamp-building-record",
  "2026-lineage-lamp-building-record": "tree-spirits-nature-karma-reincarnation",
  // 元神
  "this-book-took-thirty-years": "yuanshen-destiny-archetype",
  "yuanshen-destiny-archetype": "lingxiu-yuanshen-reality",
  "lingxiu-yuanshen-reality": "this-book-took-thirty-years",
  "yuanshen-awakening-eleven-principles": "lingxiu-yuanshen-reality",
  "yuanshen-awakening-old-manuscript": "this-book-took-thirty-years",
  "religious-light-inner-person-yuanshen": "yuanshen-destiny-archetype",
  "dragon-chant-youtube-awakening": "lingxiu-zouhuo-rumo",
  // 靈修辨識
  "how-to-judge-true-lingxiu-understanding": "fantasy-intuition-or-yuanshen",
  "fantasy-intuition-or-yuanshen": "yuanshen-awakening-eleven-principles",
  "lingxiu-zouhuo-rumo": "lingdong-mitochondria-energy",
  "lingdong-mitochondria-energy": "reading-mitochondria-medicine-energy",
  "reading-mitochondria-medicine-energy": "lingdong-mitochondria-energy",
  "2058-future-person-prophecy": "good-fortune-believe-in-yourself-choices",
  // 宮壇、靈乩與老師的辨識
  "blessing-teacher-discernment": "jitong-leader-discernment",
  "jitong-leader-discernment": "tonglingren-wufa-huifu-putongren",
  "tonglingren-wufa-huifu-putongren": "jitong-shenming-fushen",
  "jitong-shenming-fushen": "jitong-discernment-before-exorcism",
  "jitong-discernment-before-exorcism": "celebrity-death-dream-spirit-five-checks",
  "spiritual-practice-cannot-be-outsourced-to-gods": "jitong-leader-discernment",
  "shenming-yinlu-ganying-budengyu-xiuwei": "jitong-leader-discernment",
  // 信仰、土地與因果
  "japan-temple-faith-and-decline": "spiritual-practice-cannot-be-outsourced-to-gods",
  "tree-spirits-nature-karma-reincarnation": "japan-temple-faith-and-decline",
  "yuanqin-debt-heart": "love-beyond-filial-piety-and-ancestor-worship",
  "2026-guanyin-vow-lamp-record": "japan-temple-faith-and-decline",
  "2026-guanyin-vow-lamp-record-v2": "japan-temple-faith-and-decline",
  // 亡者、死亡與未知
  "celebrity-death-dream-spirit-five-checks": "lingxiu-ghosts-past-lives-supernatural-knowing",
  "lingxiu-ghosts-past-lives-supernatural-knowing": "spiritual-good-death-last-visit",
  "spiritual-good-death-last-visit": "reading-you-can-not-fear-death",
  "reading-you-can-not-fear-death": "spiritual-good-death-last-visit",
  // 愛與關係
  "love-universal-emotion-and-fidelity": "love-beyond-filial-piety-and-ancestor-worship",
  "love-beyond-filial-piety-and-ancestor-worship": "love-universal-emotion-and-fidelity",
  // 金錢、命運與選擇
  "wealth-as-water": "market-crash-money-self-control",
  "market-crash-money-self-control": "wealth-discipline-investing-and-self-mastery",
  "wealth-discipline-investing-and-self-mastery": "wealth-as-water",
  "good-fortune-believe-in-yourself-choices": "quantum-frequency-work-wish",
  "quantum-frequency-work-wish": "good-fortune-believe-in-yourself-choices",
  // 集體意識與選舉
  "collective-unconscious-election": "collective-unconscious-election-2026-part-2",
  "collective-unconscious-election-2026-part-2": "collective-unconscious-election",
  "seven-twenty-five-election-shift": "collective-unconscious-election"
});

function isEventArticle(article = {}) {
  return article.accessType === "event" || Boolean(article.eventId);
}

function isReadableCandidate(item, current) {
  if (!item || articleKey(item) === articleKey(current)) return false;
  if (item.status && item.status !== "published") return false;
  if (item.hidden === true || item.systemRecord === true) return false;
  // 一般讀者點進活動限定文章也看不到，只有活動文章之間可以互相銜接。
  return !isEventArticle(item) || isEventArticle(current);
}

// 幾乎每篇都會出現的虛詞，不能拿來判斷兩篇文章是否相近。
const COMMON_BIGRAMS = new Set(["不是", "真正", "自己", "我們", "一個", "什麼", "如何", "為什", "麼會", "還是", "可以", "這本", "的人", "一本", "之後", "而是", "如果", "時候", "已經", "開始", "能不", "不能", "是否", "究竟", "以為", "怎麼", "這件", "件事", "其實", "生命"]);

// 含這些常用字的詞組（如「的不」「只是」）同樣不具辨識力。
const COMMON_CHARS = /[的是不在了而只裡你我他她這那就也都會有要和與及或被把讓對從到很更]/;

function textBigrams(article = {}) {
  const text = `${article.title || ""}${article.excerpt || ""}`.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
  const grams = new Set();
  for (let i = 0; i < text.length - 1; i += 1) {
    const gram = text.slice(i, i + 2);
    if (COMMON_BIGRAMS.has(gram) || COMMON_CHARS.test(gram)) continue;
    grams.add(gram);
  }
  return grams;
}

function bookKeyOf(article = {}) {
  return knownBookKeyFromTitle(String(article.bookTitle || ""))
    || recommendedBookByArticle[articleKey(article)]
    || recommendedBookByCategory[article.category]
    || "";
}

/**
 * 挑出文章結尾的「延伸閱讀」。
 * topicsOf(article) 回傳該文章的主題標籤（由文章核心提供）。
 * 沒有任何指定時，依主題、書目、分類與標題摘要用詞的相近程度自動挑選。
 */
export function pickNextReading(article = {}, pool = [], { topicsOf = () => [] } = {}) {
  const candidates = pool.filter((item) => isReadableCandidate(item, article));
  if (!candidates.length) return null;
  const findById = (id) => (id ? candidates.find((item) => articleKey(item) === id || item.slug === id) : null);
  const explicit = findById(String(article.nextReadingId || "").trim())
    || findById(nextReadingByArticle[articleKey(article)]);
  if (explicit) return explicit;

  const topics = new Set(topicsOf(article));
  const book = bookKeyOf(article);
  const grams = textBigrams(article);
  let best = null;
  let bestScore = -1;
  candidates.forEach((item) => {
    let score = 0;
    topicsOf(item).forEach((topic) => { if (topics.has(topic)) score += 3; });
    if (book && bookKeyOf(item) === book) score += 2;
    if (item.category && item.category === article.category) score += 1;
    const itemGrams = textBigrams(item);
    let shared = 0;
    itemGrams.forEach((gram) => { if (grams.has(gram)) shared += 1; });
    const union = grams.size + itemGrams.size - shared;
    if (union) score += (shared / union) * 30;
    if (score > bestScore) { best = item; bestScore = score; }
  });
  return best;
}
