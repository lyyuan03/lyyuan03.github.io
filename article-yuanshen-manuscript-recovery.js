import { auth, db, isAdminEmail } from "./firebase-config.js";
import { yuanshenAwakeningOldManuscriptArticle } from "./article-yuanshen-awakening-old-manuscript.js?v=20260829-full-chapter-images-recovery-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_SLUG = "yuanshen-awakening-old-manuscript";
const PAID_MARKER = "<!-- paid-only -->";
const REVISION = "20260829-full-chapter-images-recovery-1";

function splitRestoredContent(value = "") {
  const text = String(value || "").trim();
  const index = text.indexOf(PAID_MARKER);
  if (index < 0) throw new Error("PAID_MARKER_NOT_FOUND");
  const publicContent = text.slice(0, index).trim();
  const privateContent = text.slice(index + PAID_MARKER.length).trim();
  if (publicContent.length < 500) throw new Error("PUBLIC_CONTENT_TOO_SHORT");
  if (privateContent.length < 2000) throw new Error("PRIVATE_CONTENT_TOO_SHORT");
  return { publicContent, privateContent };
}

async function sha256(value = "") {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveArticleDoc() {
  const directRef = doc(db, "articles", ARTICLE_SLUG);
  const directSnapshot = await getDoc(directRef);
  if (directSnapshot.exists()) {
    return { id: directSnapshot.id, ref: directRef, snapshot: directSnapshot };
  }

  const slugSnapshot = await getDocs(query(collection(db, "articles"), where("slug", "==", ARTICLE_SLUG)));
  const match = slugSnapshot.docs[0];
  if (!match) return null;
  return { id: match.id, ref: match.ref, snapshot: match };
}

function setStatus(message, state = "") {
  const status = document.getElementById("save-status-inline") || document.getElementById("save-status");
  if (!status) return;
  status.textContent = message;
  if (state) status.dataset.state = state;
}

async function restoreFullChapter() {
  const resolved = await resolveArticleDoc();
  if (!resolved) throw new Error("ARTICLE_NOT_FOUND");

  const article = resolved.snapshot.data() || {};
  if (article.fullChapterRecoveryRevision === REVISION) return;

  const restored = splitRestoredContent(yuanshenAwakeningOldManuscriptArticle.content || "");
  const paidRef = doc(db, "paidArticleBodies", resolved.id);
  const paidSnapshot = await getDoc(paidRef);
  const paid = paidSnapshot.exists() ? paidSnapshot.data() || {} : {};
  const nextVersion = Math.max(
    0,
    Number(paid.contentVersion || 0),
    Number(article.paidContentVersion || 0)
  ) + 1;
  const hash = await sha256(restored.privateContent);

  setStatus("正在完整找回這篇文章全章文字…", "saving");

  await setDoc(paidRef, {
    articleId: resolved.id,
    title: article.title || yuanshenAwakeningOldManuscriptArticle.title,
    status: article.status === "draft" ? "draft" : "published",
    content: restored.privateContent,
    contentHash: hash,
    contentVersion: nextVersion,
    source: "full-chapter-recovery",
    active: true,
    fullChapterRecoveryRevision: REVISION,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(resolved.ref, {
    content: (restored.publicContent + "\n\n" + PAID_MARKER).trim(),
    accessType: "paid",
    privatePaidContent: true,
    paidContentHash: hash,
    paidContentVersion: nextVersion,
    fullChapterRecoveryRevision: REVISION,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const [verifyArticle, verifyPaid] = await Promise.all([
    getDoc(resolved.ref),
    getDoc(paidRef)
  ]);

  if (
    !verifyArticle.exists()
    || !verifyPaid.exists()
    || verifyArticle.data()?.fullChapterRecoveryRevision !== REVISION
    || verifyPaid.data()?.fullChapterRecoveryRevision !== REVISION
    || String(verifyPaid.data()?.content || "") !== restored.privateContent
  ) {
    throw new Error("FULL_CHAPTER_VERIFY_FAILED");
  }

  setStatus("全章已找回｜後台人工修改已補回｜前台將同步更新", "success");

  if (sessionStorage.getItem("yuanshen-full-chapter-recovery") !== REVISION) {
    sessionStorage.setItem("yuanshen-full-chapter-recovery", REVISION);
    window.setTimeout(() => location.reload(), 900);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  void restoreFullChapter().catch((error) => {
    console.error("元神書外手記全章復原失敗：", error);
    setStatus("全章復原失敗，系統未再覆寫其他文章", "error");
  });
});
