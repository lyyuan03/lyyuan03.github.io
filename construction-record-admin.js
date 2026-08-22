import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const RECORD_EVENTS = [
  {
    id: "2026-yaochi-building-patron",
    name: "丙午建院總功德主",
    status: "active"
  },
  {
    id: "2026-yaochi-lineage-lamp",
    name: "丙午護法續脈燈首",
    status: "active"
  }
];

const RECORD_ARTICLES = [
  {
    id: "2026-building-patron-record",
    slug: "2026-building-patron-record",
    title: "靈元院建院・總功德主專屬紀錄",
    eventId: "2026-yaochi-building-patron",
    eventName: "丙午建院總功德主",
    excerpt: "一念護持，共同見證。此頁為建院總功德主專屬建院紀錄，持續更新靈元院目前工程進度、實景紀錄、設計規劃，以及宇色老師親自說明的建院近況。",
    tier: "patron",
    content: `## 一念護持・共同見證

感謝您以「丙午建院總功德主」之願心，共同護持靈元院建院聖業。

這一頁將持續記錄靈元院從規劃、設計、施工到逐步成形的過程，讓每一份護持都能清楚看見：一座道場，如何從願心一步一步走向實現。

## 宇色老師｜建院近況親自說明

【影音待補】請放入宇色老師本階段建院說明影音，並於影音下方整理三項重點：本階段完成事項、目前最重要工作、下一階段方向。

## 建院目前進度

最新更新｜【請填日期】

目前已完成｜【請填寫】
目前進行中｜【請填寫】
下一階段｜【請填寫】

## 建院實景紀錄

【照片待補】建議依工程階段分組，每一階段使用一張主照片與二至四張輔助照片，並附日期與簡短紀錄。

## 建築設計與未來樣貌

【設計圖待補】可放建築外觀、主殿、空間配置、神尊安座位置、園區或其他已確認設計。

## 建院歷程

【時間軸待補】建議依「發願 → 規劃 → 設計 → 工程 → 現況」整理重要節點。

## 下一階段

【內容待補】說明接下來預計推進的工程、重要工作與階段目標。

感謝每一份護持與願心。這不只是一份工程進度，更是一段共同參與、共同見證的建院歷程。`
  },
  {
    id: "2026-lineage-lamp-building-record",
    slug: "2026-lineage-lamp-building-record",
    title: "護法續脈・建院近況專屬紀錄",
    eventId: "2026-yaochi-lineage-lamp",
    eventName: "丙午護法續脈燈首",
    excerpt: "此頁為護法續脈燈首專屬建院近況，提供靈元院目前建院方向、階段性進度、精選設計圖與實景紀錄。",
    tier: "lamp",
    content: `## 護法續脈・共同見證建院

感謝您於本次法儀中發心護持「丙午護法續脈燈首」。

此頁將不定期更新靈元院建院規劃與階段性進度，讓每一位護持者，都能看見目前正在共同成就的方向。

## 建院目前進度

最新更新｜【請填日期】

目前已完成｜【請填寫】
目前進行中｜【請填寫】
下一階段｜【請填寫】

## 精選設計圖

【設計圖待補】建議放三至六張代表性圖稿，例如建築外觀、主殿、空間配置或其他已確認設計。

## 精選建院紀錄

【照片待補】建議放五至八張代表性實景照片，每組附上日期與簡短說明。

## 階段說明

【影音或文字待補】可放二至四分鐘簡短影音，或以文字整理本階段最重要的三項進度。

一念護持，皆是建院願力的一部分。願我們共同見證靈元院一步一步從願心走向成就。`
  }
];

const settingsRef = doc(db, "membershipSettings", "eventManagement");
const specialEventIds = new Set(RECORD_EVENTS.map((item) => item.id));
const specialArticleIds = new Set(RECORD_ARTICLES.map((item) => item.id));
let ivCompatibilityUnsubscribe = null;

async function ensureRecordEvents() {
  const snapshot = await getDoc(settingsRef);
  const saved = snapshot.exists() && Array.isArray(snapshot.data().events) ? snapshot.data().events : [];
  const existingIds = new Set(saved.map((item) => item.id));
  const missing = RECORD_EVENTS.filter((item) => !existingIds.has(item.id));
  if (!missing.length) return false;
  const events = [...saved, ...missing];
  await setDoc(settingsRef, { events, updatedAt: serverTimestamp() }, { merge: true });
  window.dispatchEvent(new CustomEvent("activity-events-updated", { detail: { events } }));
  return true;
}

async function ensureRecordArticles() {
  let created = 0;
  for (const article of RECORD_ARTICLES) {
    const ref = doc(db, "articles", article.id);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) continue;
    await setDoc(ref, {
      title: article.title,
      slug: article.slug,
      category: "spiritual",
      status: "draft",
      excerpt: article.excerpt,
      coverImage: "",
      thumbnailImage: "",
      bookTitle: "",
      bookAuthor: "",
      bookPublisher: "",
      bookPurchaseUrl: "",
      bookCoverImage: "",
      accessType: "event",
      eventId: article.eventId,
      eventName: article.eventName,
      content: article.content,
      encryptedContent: "",
      eventIv: "",
      contentIv: "",
      encryption: "",
      magicLinkAccess: {},
      specialLayout: "construction-record",
      constructionTier: article.tier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: false });
    created += 1;
  }
  return created;
}

function specialModeActive() {
  const eventId = document.getElementById("eventId")?.value || "";
  const selectedId = document.querySelector("#article-list .article-item.is-active")?.dataset?.id || "";
  return specialEventIds.has(eventId) || specialArticleIds.has(selectedId);
}

function applySpecialAdminMode() {
  const active = specialModeActive();
  const bookTitle = document.getElementById("bookTitle");
  const bookFields = ["bookTitle", "bookPurchaseUrl", "bookCoverImage"].map((id) => document.getElementById(id)).filter(Boolean);
  bookFields.forEach((field) => { field.required = !active; });
  const bookGrid = bookTitle?.closest(".grid");
  if (bookGrid) bookGrid.hidden = active;

  ["preview-article-notification", "notify-article-subscribers", "article-notification-status"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.hidden = active;
  });

  const form = document.getElementById("article-form");
  if (!form) return;
  let note = document.getElementById("construction-record-admin-note");
  if (active && !note) {
    note = document.createElement("div");
    note.id = "construction-record-admin-note";
    note.className = "membership-summary";
    note.innerHTML = "<strong style=\"display:block;color:#D8BD91;margin-bottom:4px\">建院專屬紀錄頁</strong><span>此篇沿用活動限定 Email 權限，但前台會以建院專區版型呈現；不顯示一般文章的延伸書籍、延伸閱讀與分享區。</span>";
    const excerptField = document.getElementById("excerpt")?.closest(".field");
    excerptField?.before(note);
  }
  if (note) note.hidden = !active;
}

function installSpecialAdminMode() {
  const eventSelect = document.getElementById("eventId");
  const list = document.getElementById("article-list");
  eventSelect?.addEventListener("change", applySpecialAdminMode);
  list?.addEventListener("click", () => window.setTimeout(applySpecialAdminMode, 0));
  document.getElementById("new-article")?.addEventListener("click", () => window.setTimeout(applySpecialAdminMode, 0));
  const actions = document.querySelector(".save-actions");
  if (actions) new MutationObserver(applySpecialAdminMode).observe(actions, { childList: true, subtree: true });
  applySpecialAdminMode();
}

function installEventIvCompatibility() {
  if (ivCompatibilityUnsubscribe) return;
  ivCompatibilityUnsubscribe = onSnapshot(collection(db, "articles"), (snapshot) => {
    snapshot.docs.forEach((item) => {
      const article = item.data() || {};
      if (article.accessType !== "event" || !article.eventIv || article.contentIv === article.eventIv) return;
      setDoc(item.ref, { contentIv: article.eventIv, updatedAt: serverTimestamp() }, { merge: true }).catch((error) => {
        console.warn("活動限定文章 IV 相容欄位同步失敗：", item.id, error);
      });
    });
  }, (error) => console.warn("活動限定文章 IV 相容監聽失敗：", error));
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    await ensureRecordEvents();
    const created = await ensureRecordArticles();
    installEventIvCompatibility();
    installSpecialAdminMode();
    if (created > 0) {
      window.setTimeout(() => location.reload(), 180);
    }
  } catch (error) {
    console.error("建院專屬紀錄初始化失敗：", error);
  }
});
