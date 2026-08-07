from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# articles.js
path = Path("articles.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";',
    'import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";',
    "articles import",
)
text = replace_once(
    text,
    "const limitedReadingDeadlines = new Map();",
    '''const limitedReadingDeadlines = new Map();
const ARTICLE_STATUS_INDEX_ID = "__article-publication-status";
// 這篇已由 Firestore 後台接管；索引首次建立前也不得退回顯示靜態 published 版本。
const LEGACY_FIRESTORE_MANAGED_IDS = new Set(["yuanshen-destiny-archetype"]);''',
    "articles constants",
)
helpers = '''function publicationStatusMap(snapshot) {
  const statuses = {};
  snapshot.docs.forEach((item) => {
    const article = item.data() || {};
    if (article.systemType === "article-thumbnail-settings") return;
    statuses[item.id] = {
      status: article.status === "published" ? "published" : "draft",
      hidden: article.hidden === true,
      systemRecord: article.systemRecord === true
    };
  });
  return statuses;
}

async function writePublicationStatusIndex(statuses) {
  const indexRef = doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID);
  const current = await getDoc(indexRef);
  if (!current.exists()) {
    // 先以符合既有公開建立規則的統計格式建立，再由管理員寫入狀態索引。
    await setDoc(indexRef, {
      articleId: ARTICLE_STATUS_INDEX_ID,
      views: 1,
      shares: 0,
      copies: 0,
      updatedAt: serverTimestamp()
    });
  }
  await setDoc(indexRef, {
    articleId: ARTICLE_STATUS_INDEX_ID,
    views: 0,
    shares: 0,
    copies: 0,
    statuses,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function syncPublicationStatusIndexForAdmin() {
  if (!isAdminEmail(auth.currentUser?.email)) return false;
  const snapshot = await getDocs(collection(db, "articles"));
  await writePublicationStatusIndex(publicationStatusMap(snapshot));
  return true;
}

'''
text = replace_once(text, "async function loadArticles() {", helpers + "async function loadArticles() {", "articles helpers")
start = text.index('  let articles = [];', text.index('async function loadArticles()'))
end_marker = '  const merged = [...mergedById.values()];'
end = text.index(end_marker, start) + len(end_marker)
new_merge = '''  const publishedRequest = getDocs(
    query(collection(db, "articles"), where("status", "==", "published"))
  );
  const statusRequest = getDoc(doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID));
  const [publishedResult, statusResult] = await Promise.allSettled([
    publishedRequest,
    statusRequest
  ]);

  const firestoreArticles = publishedResult.status === "fulfilled"
    ? publishedResult.value.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((article) => article.hidden !== true && article.systemRecord !== true)
    : [];
  if (publishedResult.status === "rejected") {
    console.warn("Firebase 已發布文章暫時無法載入，改顯示靜態文章。", publishedResult.reason);
  }

  const indexedStatuses = statusResult.status === "fulfilled" && statusResult.value.exists()
    ? statusResult.value.data().statuses || {}
    : {};
  const statusById = new Map(Object.entries(indexedStatuses));
  if (statusResult.status === "rejected") {
    console.warn("文章狀態索引暫時無法載入。", statusResult.reason);
  }

  // Firestore 有同 ID 文件時，靜態資料不得回補；靜態檔只備援尚未進入 Firestore 的文章。
  const mergedById = new Map();
  staticArticles.forEach((article) => {
    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);
    if (!managedByFirestore) mergedById.set(article.id, article);
  });
  firestoreArticles.forEach((article) => mergedById.set(article.id, article));
  statusById.forEach((status, articleId) => {
    if (status.status !== "published" || status.hidden === true || status.systemRecord === true) {
      mergedById.delete(articleId);
    }
  });
  const merged = [...mergedById.values()].filter((article) =>
    article.status === "published"
    && article.hidden !== true
    && article.systemRecord !== true
  );'''
text = text[:start] + new_merge + text[end:]
text = replace_once(
    text,
    '    articleMetrics = new Map(snapshot.docs.map((item) => [item.id, item.data()]));',
    '''    articleMetrics = new Map(snapshot.docs
      .filter((item) => item.id !== ARTICLE_STATUS_INDEX_ID)
      .map((item) => [item.id, item.data()]));''',
    "articles metrics filter",
)
text = replace_once(
    text,
    '''onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadMemberAccess(user);''',
    '''onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadMemberAccess(user);
  if (isAdminEmail(user?.email)) {
    try {
      if (await syncPublicationStatusIndexForAdmin()) await loadArticles();
    } catch (error) {
      console.warn("文章狀態索引同步失敗。", error);
    }
  }''',
    "articles auth sync",
)
path.write_text(text.rstrip() + "\n", encoding="utf-8")


# article-admin.js
path = Path("article-admin.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'const SYSTEM_ARTICLE_IDS = new Set(["__article-thumbnail-settings"]);',
    '''const SYSTEM_ARTICLE_IDS = new Set(["__article-thumbnail-settings"]);
const ARTICLE_STATUS_INDEX_ID = "__article-publication-status";''',
    "admin constant",
)
admin_helpers = '''function publicationStatusMap(snapshot) {
  const statuses = {};
  snapshot.docs.forEach((item) => {
    const article = item.data() || {};
    if (SYSTEM_ARTICLE_IDS.has(item.id) || article.systemType === "article-thumbnail-settings") return;
    statuses[item.id] = {
      status: article.status === "published" ? "published" : "draft",
      hidden: article.hidden === true,
      systemRecord: article.systemRecord === true
    };
  });
  return statuses;
}

async function syncPublicationStatusIndex(snapshot) {
  const indexRef = doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID);
  const current = await getDoc(indexRef);
  if (!current.exists()) {
    await setDoc(indexRef, {
      articleId: ARTICLE_STATUS_INDEX_ID,
      views: 1,
      shares: 0,
      copies: 0,
      updatedAt: serverTimestamp()
    });
  }
  await setDoc(indexRef, {
    articleId: ARTICLE_STATUS_INDEX_ID,
    views: 0,
    shares: 0,
    copies: 0,
    statuses: publicationStatusMap(snapshot),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

'''
text = replace_once(text, "async function syncRevisedStaticArticles(snapshot) {", admin_helpers + "async function syncRevisedStaticArticles(snapshot) {", "admin helpers")
text = replace_once(
    text,
    '''    try {
      const metricsSnapshot = await getDocs(collection(db, "articleMetrics"));''',
    '''    await syncPublicationStatusIndex(snapshot);
    try {
      const metricsSnapshot = await getDocs(collection(db, "articleMetrics"));''',
    "admin index sync",
)
text = replace_once(
    text,
    '      metricsByArticle = new Map(metricsSnapshot.docs.map((item) => [item.id, item.data()]));',
    '''      metricsByArticle = new Map(metricsSnapshot.docs
        .filter((item) => item.id !== ARTICLE_STATUS_INDEX_ID)
        .map((item) => [item.id, item.data()]));''',
    "admin metrics filter",
)
path.write_text(text.rstrip() + "\n", encoding="utf-8")

print("Client article status patch applied.")
