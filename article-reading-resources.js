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
  "japan-temple-faith-and-decline": "faith",
  "spiritual-practice-cannot-be-outsourced-to-gods": "awakening",
  "jitong-leader-discernment": "lingxiuMaze",
  "jitong-discernment-before-exorcism": "ghosts",
  "good-fortune-believe-in-yourself-choices": "goodFortune",
  "yuanshen-awakening-eleven-principles": "yuanshenAwakening",
  "seven-twenty-five-election-shift": "goodFortune",
  "tonglingren-wufa-huifu-putongren": "lingxiuMaze",
  "market-crash-money-self-control": "wealth",
  "jitong-shenming-fushen": "spiritDialogue",
  "lingxiu-yuanshen-reality": "yuanshenAwakening",
  "lingxiu-zouhuo-rumo": "lingxiuMaze",
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
  const key = mappedArticleKey
    || knownTitleKey
    || recommendedBookByCategory[article.category]
    || "yuanshenAwakening";
  const fallback = recommendedBookCatalog[key] || recommendedBookCatalog.yuanshenAwakening;
  const hasCustomCover = Boolean(String(article.bookCoverImage || "").trim());
  // 已核對的文章對應優先於舊 Firestore 欄位，避免歷史錯誤連結覆蓋正確書目。
  const mayUseExplicitText = hasCustomCover
    || (!mappedArticleKey && (!explicitTitle || Boolean(knownTitleKey)));

  return {
    ...fallback,
    title: mayUseExplicitText && explicitTitle ? explicitTitle : fallback.title,
    author: mayUseExplicitText && article.bookAuthor ? article.bookAuthor : fallback.author,
    publisher: mayUseExplicitText && article.bookPublisher ? article.bookPublisher : fallback.publisher,
    purchaseUrl: mayUseExplicitText && article.bookPurchaseUrl ? article.bookPurchaseUrl : fallback.purchaseUrl,
    coverImage: hasCustomCover ? article.bookCoverImage : fallback.coverImage
  };
}
