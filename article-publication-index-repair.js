import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_STATUS_INDEX_ID = "__article-publication-status";
const THUMBNAIL_SETTINGS_ID = "__article-thumbnail-settings";
const SESSION_KEY = "lyyuan-article-index-repaired-20260823-1";

function buildCleanStatuses(snapshot) {
  const statuses = {};
  snapshot.docs.forEach((item) => {
    const data = item.data() || {};
    if (item.id === THUMBNAIL_SETTINGS_ID || data.systemType === "article-thumbnail-settings") return;
    if (!["published", "draft"].includes(data.status)) return;
    statuses[item.id] = {
      status: data.status,
      hidden: data.hidden === true,
      systemRecord: data.systemRecord === true
    };
  });
  return statuses;
}

async function repairIndex() {
  if (!isAdminEmail(auth.currentUser?.email)) return;
  if (sessionStorage.getItem(SESSION_KEY) === "done") return;
  const articlesSnapshot = await getDocs(collection(db, "articles"));
  const statuses = buildCleanStatuses(articlesSnapshot);
  const indexRef = doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID);
  const indexSnapshot = await getDoc(indexRef);
  const payload = {
    articleId: ARTICLE_STATUS_INDEX_ID,
    statuses,
    views: 0,
    shares: 0,
    copies: 0,
    updatedAt: serverTimestamp()
  };
  if (indexSnapshot.exists()) await updateDoc(indexRef, payload);
  else await setDoc(indexRef, payload);
  sessionStorage.setItem(SESSION_KEY, "done");
  window.setTimeout(() => location.reload(), 120);
}

onAuthStateChanged(auth, () => {
  repairIndex().catch((error) => console.warn("文章發布狀態索引自動修復失敗。", error));
});
