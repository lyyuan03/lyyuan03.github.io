import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONSTRUCTION_CONTENT_VERSION = 2;

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
    excerpt: "一念護持，共同成院。此頁為建院總功德主專屬紀錄，完整更新靈元院建院進度、空間設計、施工實景，以及宇色老師親自說明的建院近況。",
    tier: "patron",
    coverImage: "images/dizhi-render-exterior.jpg",
    thumbnailImage: "images/dizhi-render-garden.jpg",
    content: `## 一念護持，讓一座道院真正落地

靈元院從來不只是要完成一棟建築。

從最初的發願，到尋地、規劃、設計，再到今天真正進入工程，每一步都在回答同一件事：我們希望留下的，究竟是一間房子，還是一處能讓人走進來之後，願意慢下來、安住下來，重新與自己、與元神、與神明相遇的地方？

過去靈元院一路尋找適合的道場，我們在意的從來不只是坪數。真正重要的是，一個人來到這裡之後，能不能散步、靜坐、沉澱；能不能在不同角落找到一處屬於自己的清靜。因為一座靈修道院存在的意義，不只是讓人前來參拜，而是讓心真正有地方安住。

建院也是一件很慢、很實際的事。圖面上的一條線，到了現場，就是尺寸、材料、結構、工序與一次又一次的取捨。也因為如此，總功德主所護持的，從來不只是某一筆工程費用，而是在共同成就一處未來能承接修行、共修、法儀與法脈延續的空間。

這一頁將作為總功德主的專屬建院紀錄。工程每往前一步，我們都會把重要的進度、設計與現場實況留在這裡，讓這份護持不是停留在一個名字，而是能真正看見它如何一步一步成為一座道院。

![靈元院建院整體配置與空間規劃示意](images/dizhi-blueprint.jpg)

## 宇色老師｜建院近況親自說明

建院真正困難的地方，往往不是把圖畫出來，而是在每一次現場條件、工程取捨與使用需求之間，找到最適合靈元院長久使用的答案。

這一區將由宇色老師親自說明目前建院走到哪裡、這一階段為什麼這樣規劃，以及接下來最重要的方向。比起只看一張完成示意圖，我更希望總功德主能知道：這座道院，是怎麼一步一步被做出來的。

【宇色老師建院影音｜即將於本頁更新】

## 建院目前走到哪裡

最新更新｜2026 年 8 月

靈元院建院已經從紙上的規劃，真正走進現場工程。

從目前留下的施工紀錄可以看到，工程已歷經整地與基礎開挖，並陸續推進到基礎鋼筋、模板及混凝土基礎等工序。這些在完成之後往往看不見的部分，反而決定了一座建築往後能不能穩穩站住，因此我們寧可把時間花在前面的基礎，也不急著追求表面上「看起來很快」。

現階段仍以主殿棟與必要使用空間為優先，並同步規劃香客住宿、園藝、水井與周邊動線。整體原則很清楚：先把真正承接修行與使用需求的核心空間做好，再逐步完成外觀、景觀與後續細節。

目前的階段目標，是讓主殿與必要設施先能逐步具備使用條件；其餘工程則依現場進度與實際需求分階段完成。建院不追求一次把所有東西塞進土地裡，而是要讓每一個空間都有它存在的理由。

## 從土地，到真正可以站立的結構

下面這些現場紀錄，對我們而言非常重要。

因為幾年之後，當大殿、庭園與廊道都完成時，人們看到的會是一座已經成形的道院；但總功德主此刻所見證的，是它還埋在土裡、還只看得見鋼筋與混凝土的時候。

![靈元院建院現場工程紀錄](assets/yaochi-building-witness-20260818.webp)

![靈元院建院施工階段紀錄](images/dizhi-build-pause.jpg)

每一道基礎、每一處結構，最後都會被新的空間覆蓋。但正是這些看不見的部分，承接了日後所有看得見的部分。

## 建築設計｜我們想留下的，不只是「廟的樣子」

靈元院未來的空間，不希望只是複製一座傳統宮廟，也不希望把宗教空間做成純粹的展示場所。

我們一直想做的，是一處真正適合靈修人的道院：保有東方宗教空間應有的莊嚴，但不以繁複堆疊製造神聖；讓木質、庭園、光線、水、植物與人的行走動線彼此相連，使人在還沒有開始任何儀式之前，心就先慢下來。

以下為目前建院空間的設計與規劃示意。實際工程仍會依結構、安全、材料與現場條件持續調整，但整體精神不變。

![靈元院新道場外觀設計示意](images/dizhi-render-exterior.jpg)

![靈元院新道場庭園設計示意](images/dizhi-render-garden.jpg)

![靈元院道場內部空間規劃示意](images/dizhi-space.jpg)

## 一間靈修道院，為什麼需要庭園與留白

過去在尋找新址時，我們一直有一個很清楚的想法：來到靈元院的人，不應該只是上香、參拜，然後立刻離開。

我們希望有人可以在樹下坐一會兒，可以沿著小徑走一段，可以在法儀之前先讓自己安靜，也可以在結束之後，不必急著回到外面的速度。

所以庭園、廊道、留白與光線並不是附加的裝飾。對一座靈修道院而言，它們本身就是修行的一部分。

當一個空間能讓人的呼吸自然慢下來，那個地方才真正開始具有道場的意義。

![靈元院建院空間與庭園規劃](images/dizhi-hero.jpg)

## 建院歷程｜一個願，如何一步一步變成現實

靈元院的建院不是突然發生的。

從舊址畫下句點之後，我們花了很長的時間尋找下一個真正能長久安住的地方。期間看過許多土地，也一次又一次因為格局、交通、環境、價格與使用條件而重新評估。

2024 年｜持續尋地與評估。從交通、地形、周邊環境到既有建物條件，一處一處實際走訪。

2025 年｜建院方向逐漸清楚。除了主殿本身，也把「可以散步、靜坐、沉澱」納入道場整體規劃，確認未來不是只蓋一棟建築，而是建立一個完整的修行環境。

2026 年｜建院由規劃正式走入工程階段。從基地整理、基礎開挖，到鋼筋、模板與混凝土基礎，開始留下真正可以被看見的建院軌跡。

接下來｜依工程次序推進主殿、必要設施與相關空間，再逐步完成庭園、動線、住宿與整體環境。

這條路仍然在進行中，而總功德主所參與的，正是這段最難得、也最無法重來的「從無到有」。

## 下一階段｜先把核心做好，再讓整座道院慢慢完整

接下來的工作，仍會以主殿與必要設施為最優先。

建院過程中，我們會持續在「理想的樣子」與「現場真正能做到的方式」之間做調整。這不是退讓，而是任何一座要長久存在的建築都必須經過的過程。

我們希望最後留下的，不只是漂亮的完成照，而是一座真正能用、能住、能修、也能在很長的時間裡繼續承接人的道院。

每一份護持，最後都會變成一道梁、一段路、一處可以安靜坐下來的角落，或是一個未來有人在其中重新找回自己的空間。

謝謝您在這座道院還沒有完全成形之前，就已經選擇站在它的起點。

一念連靈山，十方聚願力；我們會把這一段建院歷程，繼續好好記錄下去。`
  },
  {
    id: "2026-lineage-lamp-building-record",
    slug: "2026-lineage-lamp-building-record",
    title: "護法續脈・建院近況專屬紀錄",
    eventId: "2026-yaochi-lineage-lamp",
    eventName: "丙午護法續脈燈首",
    excerpt: "此頁為護法續脈燈首專屬建院近況，提供靈元院目前建院方向、階段性進度，以及精選空間設計圖。",
    tier: "lamp",
    coverImage: "images/dizhi-render-garden.jpg",
    thumbnailImage: "images/dizhi-render-exterior.jpg",
    content: `## 護法續脈，不只是一次法儀

感謝您於本次法儀中發心護持「丙午護法續脈燈首」。

「續脈」的意義，不只是在一場法儀中點起一盞燈，而是讓一條修行的路、一道法脈，以及一處未來可以承接眾人修持的道院，能夠繼續往下走。

靈元院奉無極瑤池金母之旨而立，最初的目的，就是希望為靈修人保留一處能共修、修法、沉思、冥想與會靈的地方。現在，這個願正在由過去的道場經驗，一步一步走向新的建院階段。

此頁將提供護法續脈燈首觀看靈元院目前的建院方向、階段性進度，以及部分已完成的空間規劃。內容會隨建院進度不定期更新。

## 建院目前進度

最新更新｜2026 年 8 月

目前建院已從規劃逐步進入實際工程階段。

現階段以主殿與必要使用空間為優先，並同步處理後續住宿、庭園、水井與周邊動線等規劃。整體不追求一次完成所有項目，而是依工程順序與實際使用需求，一階段一階段把核心做好。

對靈元院而言，建院不是把一塊土地填滿，而是把一個願，慢慢變成一個真正可以讓人走進去、安住下來、修行的地方。

## 空間設計｜從法脈，走進可以安住的地方

未來的靈元院，希望保有道院應有的莊嚴，但不以繁複裝飾來製造距離。

整體空間以木質、庭園、自然光、水與植物作為重要元素，讓建築與人的行走、停留、靜坐彼此連結。人在進入主殿之前，先經過庭園與廊道；在法儀之外，也能有地方讓自己慢慢沉澱。

以下為目前建院的設計與空間規劃示意。實際完成樣貌仍會依工程、結構與現場條件調整。

![靈元院建院整體配置示意](images/dizhi-blueprint.jpg)

![靈元院新道場外觀設計示意](images/dizhi-render-exterior.jpg)

![靈元院新道場庭園設計示意](images/dizhi-render-garden.jpg)

![靈元院道場空間規劃示意](images/dizhi-space.jpg)

## 為什麼我們保留庭園、廊道與留白

我們一直希望，未來來到靈元院的人，不只是完成一次參拜。

有人可以散步，有人可以靜坐，有人只是在一棵樹下待一會兒；法儀之前有地方整理自己，法儀之後也不需要立刻回到外面的喧囂。

所以庭園與留白不是附屬景觀，而是整個修行空間的一部分。道場真正要承接的，不只是儀式，也包括一個人願意安靜下來的那一刻。

## 下一階段

接下來仍會依工程次序，先推進主殿與必要設施，再逐步完成其他使用空間與整體環境。

建院是一條很長的路。護法續脈燈首所護持的，也正是讓這條路能夠持續延伸的願力之一。

一念護持，皆是建院願力的一部分。

願我們共同見證，靈元院如何從一個願，慢慢成為一處真正可以承接修行與法脈的地方。`
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

function articleBaseRecord(article) {
  return {
    title: article.title,
    slug: article.slug,
    category: "spiritual",
    status: "draft",
    excerpt: article.excerpt,
    coverImage: article.coverImage,
    thumbnailImage: article.thumbnailImage,
    bookTitle: "",
    bookAuthor: "",
    bookPublisher: "",
    bookPurchaseUrl: "",
    bookCoverImage: "",
    accessType: "event",
    eventId: article.eventId,
    eventName: article.eventName,
    content: article.content,
    specialLayout: "construction-record",
    constructionTier: article.tier,
    constructionContentVersion: CONSTRUCTION_CONTENT_VERSION,
    updatedAt: serverTimestamp()
  };
}

async function ensureRecordArticles() {
  let changed = 0;
  for (const article of RECORD_ARTICLES) {
    const ref = doc(db, "articles", article.id);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      await setDoc(ref, {
        ...articleBaseRecord(article),
        encryptedContent: "",
        eventIv: "",
        contentIv: "",
        encryption: "",
        magicLinkAccess: {},
        createdAt: serverTimestamp()
      }, { merge: false });
      changed += 1;
      continue;
    }

    const current = snapshot.data() || {};
    if (Number(current.constructionContentVersion || 0) >= CONSTRUCTION_CONTENT_VERSION) continue;

    await setDoc(ref, {
      ...articleBaseRecord(article),
      encryptedContent: "",
      eventIv: "",
      contentIv: "",
      encryption: ""
    }, { merge: true });
    changed += 1;
  }
  return changed;
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
    const changed = await ensureRecordArticles();
    installEventIvCompatibility();
    installSpecialAdminMode();
    if (changed > 0) {
      window.setTimeout(() => location.reload(), 180);
    }
  } catch (error) {
    console.error("建院專屬紀錄初始化失敗：", error);
  }
});
