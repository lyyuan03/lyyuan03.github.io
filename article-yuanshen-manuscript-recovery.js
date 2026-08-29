import { auth, db, isAdminEmail } from "./firebase-config.js";
import { yuanshenAwakeningOldManuscriptArticle } from "./article-yuanshen-awakening-old-manuscript.js?v=20260829-thirty-years-practice-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_SLUG = "yuanshen-awakening-old-manuscript";
const PAID_MARKER = "<!-- paid-only -->";
const REVISION = "20260829-thirty-years-practice-1";
const RAW_BASE = "https://raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/ff0b24b28b9b77562beb9fd31d77e981d2b2b89e/assets/articles/yuanshen-awakening-old-manuscript";

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

function repairImageUrls(value = "") {
  let text = String(value || "");
  for (let i = 1; i <= 5; i += 1) {
    const absolute = `${RAW_BASE}/image-${i}.webp`;
    const relativePattern = new RegExp(
      `(?:https?:\\/\\/lyyuan\\.tw\\/)?assets\\/articles\\/yuanshen-awakening-old-manuscript\\/image-${i}\\.webp(?:\\?[^)\\s]*)?`,
      "g"
    );
    text = text.replace(relativePattern, absolute);
  }
  return text;
}

const PRACTICE_PARAGRAPH = `網路上的世界，本來就是真真假假、假假真真；其實人活在現實裡也是如此。看見的未必是全貌，聽見的也未必是真相。若一個人的心總是跟著外面的聲音起落，那麼別人的一句話，就足以把自己的心帶走。

修行不是讓人變得沒有感覺。該在意的仍然會在意，該判斷的仍然要判斷；只是事情進到心裡之後，不會停留那麼久。看清楚，處理該處理的，剩下的就讓它過去。很多當下看似很大的風波，時間一拉長，也不過是生命裡的一道波瀾。

真正困住人的，往往不是別人說了什麼，而是自己有多少東西非守不可：名聲、面子、輸贏、被肯定、被理解。愈在意這些，愈容易被外面的眼光牽著走。修行走得愈深，不是名利從此不存在，而是名利不能反過來牽動你的心。

走在靈修這條路上，很多事情其實會看得更清楚。看得清，不代表每一件事都要出手；知道，也不代表每一句話都要回應。真正的功夫，不是證明自己從此不起波瀾，而是波瀾起來的時候，心仍然有自己的位置；事情過去之後，也有能力讓它過去。`;

function insertPracticeParagraph(value = "") {
  let text = String(value || "");
  if (text.includes("網路上的世界，本來就是真真假假、假假真真")) return text;

  const anchor = "不是因為我不知道，而是因為我知道，卻已經不覺得有回應的必要。";
  if (!text.includes(anchor)) return text;

  return text.replace(anchor, anchor + "\n\n" + PRACTICE_PARAGRAPH);
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

async function repairChapterImages() {
  const resolved = await resolveArticleDoc();
  if (!resolved) throw new Error("ARTICLE_NOT_FOUND");

  const article = resolved.snapshot.data() || {};
  if (article.imageUrlRepairRevision === REVISION) return;

  const paidRef = doc(db, "paidArticleBodies", resolved.id);
  const paidSnapshot = await getDoc(paidRef);
  const paid = paidSnapshot.exists() ? paidSnapshot.data() || {} : {};

  let publicContent = String(article.content || "").trim();
  let privateContent = String(paid.content || "").trim();

  // 只有章節真的被截斷時，才用完整復原稿補回。
  // 正常情況一律保留目前 Firestore 文字，只修圖片網址。
  if (publicContent.length < 500 || privateContent.length < 2000) {
    const restored = splitRestoredContent(yuanshenAwakeningOldManuscriptArticle.content || "");
    publicContent = restored.publicContent + "\n\n" + PAID_MARKER;
    privateContent = restored.privateContent;
  }

  publicContent = repairImageUrls(publicContent);
  privateContent = repairImageUrls(privateContent);
  privateContent = insertPracticeParagraph(privateContent);

  const previousVersion = Math.max(
    0,
    Number(paid.contentVersion || 0),
    Number(article.paidContentVersion || 0)
  );
  const hash = await sha256(privateContent);
  const nextVersion = previousVersion + 1;

  setStatus("正在同步新增修行段落與五張原圖，現有文字不會被覆寫…", "saving");

  await setDoc(paidRef, {
    content: privateContent,
    contentHash: hash,
    contentVersion: nextVersion,
    imageUrlRepairRevision: REVISION,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(resolved.ref, {
    content: publicContent,
    paidContentHash: hash,
    paidContentVersion: nextVersion,
    imageUrlRepairRevision: REVISION,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const [verifyArticle, verifyPaid] = await Promise.all([
    getDoc(resolved.ref),
    getDoc(paidRef)
  ]);

  if (
    !verifyArticle.exists()
    || !verifyPaid.exists()
    || verifyArticle.data()?.imageUrlRepairRevision !== REVISION
    || verifyPaid.data()?.imageUrlRepairRevision !== REVISION
  ) {
    throw new Error("IMAGE_URL_REPAIR_VERIFY_FAILED");
  }

  setStatus("新段落已加入｜五張原圖正常｜現有文字已保留", "success");

  if (sessionStorage.getItem("yuanshen-image-url-repair") !== REVISION) {
    sessionStorage.setItem("yuanshen-image-url-repair", REVISION);
    window.setTimeout(() => location.reload(), 700);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  void repairChapterImages().catch((error) => {
    console.error("元神書外手記圖片修復失敗：", error);
    setStatus("圖片修復失敗，未覆寫目前文字", "error");
  });
});
