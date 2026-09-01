// 公開卡片 metadata。專屬全文只存於 Firestore eventArticleBodies。
export const JINMU_SERIES = "丙午無極瑤池金母聖誕｜專屬文選";
export const jinmuEventArticles = [
  {
    id: "2026-yaochi-birthday-morning",
    title: "【丙午無極瑤池金母聖誕｜專屬文選①】上午祝壽・慈示靈修心法：渡化",
    requiredPermission: "2026-jinmu-am",
    accessBadge: "上午場登記者專屬",
    accessDeniedMessage: "此篇為丙午無極瑤池金母聖誕上午場登記者專屬內容。",
    excerpt: "無極瑤池金母聖誕上午場紀錄：從召請、元神點化，到無極瑤池金母所示「人心難渡、安住本心」的修行方向。",
    coverImage: "assets/articles/yaochi-birthday-morning/01-long-life-lamps.jpeg?v=20260829-2",
    publishedAt: "2026-08-29T00:00:00.000Z"
  },
  {
    id: "reconciliation-absolution-heart",
    title: "【丙午無極瑤池金母聖誕｜專屬文選②】下午解冤赦業・真正要化解的，不只是冤，而是人心",
    requiredPermission: "2026-jinmu-pm",
    accessBadge: "下午場登記者專屬",
    accessDeniedMessage: "此篇為下午解冤赦業登記者專屬內容。",
    excerpt: "解冤赦業不是消滅誰、趕走誰，而是讓元神、因緣與人心重新獲得整理，使生命不再被恩怨牽著走。",
    coverImage: "assets/articles/reconciliation-absolution-heart/01-flower-candle.jpg?v=20260829-2",
    publishedAt: "2026-08-29T14:30:00.000Z"
  },
  {
    id: "2026-building-patron-record",
    title: "【丙午無極瑤池金母聖誕｜專屬文選③】建院願心見證・丙午建院總功德主專屬",
    requiredPermission: "2026-jinmu-build-patron",
    accessBadge: "建院總功德主專屬",
    accessDeniedMessage: "此篇為丙午建院總功德主專屬內容。",
    excerpt: "靈元院停工兩年半後重新往前。這不是一篇工程報告，而是一段關於承接、取捨、信眾等待與道場重新起步的建院紀錄。",
    coverImage: "images/dizhi-render-exterior.jpg",
    thumbnailImage: "images/dizhi-render-garden.jpg"
  },
  {
    id: "2026-lineage-lamp-building-record",
    title: "【丙午無極瑤池金母聖誕｜專屬文選④】建院願心見證・建院護持信眾專屬",
    requiredPermission: "2026-jinmu-build-supporter",
    accessBadge: "建院護持信眾專屬",
    accessDeniedMessage: "此篇為本次建院／點燈護持信眾專屬內容。",
    excerpt: "讓每一份建院與點燈護持，共同見證靈元院目前的建院方向、階段性進度與空間設計。",
    coverImage: "images/dizhi-render-garden.jpg",
    thumbnailImage: "images/dizhi-render-exterior.jpg"
  }
].map((article) => ({
  ...article,
  slug: article.id,
  series: JINMU_SERIES,
  category: "spiritual",
  displayCategory: "靈修",
  accessType: "event",
  eventId: article.requiredPermission,
  eventName: JINMU_SERIES,
  status: "published",
  thumbnailImage: article.thumbnailImage || article.coverImage,
  readingLevel: "深度",
  topics: ["無極瑤池金母", "法會紀錄", "建院護持"],
  content: ""
}));
