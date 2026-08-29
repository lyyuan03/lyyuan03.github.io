import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_ID = "yuanshen-awakening-old-manuscript";
const PAID_MARKER = "<!-- paid-only -->";
const RECOVERY_REVISION = "20260829-restore-missing-user-paragraphs-2";
const HISTORY_SOURCE =
  "https://raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/5269e63adb24a3a17a82d9409ffeaba38e22122f/article-yuanshen-awakening-old-manuscript.js";

const markdownBase64Image =
  /!\[[^\]]*\]\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi;
const orphanBase64Image =
  /\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi;
const bareBase64Image =
  /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+/gi;
const IMAGE_MARKER = "[圖片待重新上傳]";

function cleanBase64Images(value = "") {
  let removed = 0;
  const replacement = () => {
    removed += 1;
    return "\n\n" + IMAGE_MARKER + "\n\n";
  };
  let text = String(value || "")
    .replace(markdownBase64Image, replacement)
    .replace(orphanBase64Image, replacement)
    .replace(bareBase64Image, replacement)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
    .trim();
  return { text, removed };
}

function splitPaidContent(value = "") {
  const text = String(value || "");
  const index = text.indexOf(PAID_MARKER);
  if (index < 0) return { publicContent: text.trim(), privateContent: "" };
  return {
    publicContent: text.slice(0, index).trim(),
    privateContent: text.slice(index + PAID_MARKER.length).trim()
  };
}

const USER_MISSING_BLOCK_ONE = `也因為這件事，讓我更加確定了一個觀念：**通靈，終究抵不過法律。**

嘴上說得再玄、講得再神，鬼神之事說得天花亂墜，都不代表一個人可以凌駕現實世界的規則。當事情真正走進法律、證據與責任的範圍裡，所有無法被證明的神通與說法，都必須退到一旁。

因為人活在人間，就必須面對人間的法則。`;

const USER_MISSING_BLOCK_TWO = `雖然他後來沉默了，但他的老師依然持續在網路上關注我的文章，甚至試圖以匿名的方式，影射、批判我的教導與觀點。

只是到了那個時候，這些事情對我而言，早已沒有什麼殺傷力了。

你沒有指名道姓，我也不需要對號入座；你有你的立場，我有我的觀點。再多的影射與暗示，如果始終只能躲在匿名的背後，其實也沒有什麼值得我回應的。

所以後來，我選擇不再理會。

不是因為我不知道，而是因為我知道，卻已經不覺得有回應的必要。`;

function restoreKnownUserParagraphs(value = "") {
  let text = String(value || "").trim();

  if (!text.includes("通靈，終究抵不過法律")) {
    const anchor = "後來，對方就沒有再來了。";
    if (text.includes(anchor)) {
      text = text.replace(
        anchor,
        anchor + "\n\n" + USER_MISSING_BLOCK_ONE
      );
    }
  }

  if (!text.includes("雖然他後來沉默了，但他的老師依然持續在網路上關注我的文章")) {
    const heading = "## 母娘後來給我的提醒";
    if (text.includes(heading)) {
      text = text.replace(
        heading,
        USER_MISSING_BLOCK_TWO + "\n\n" + heading
      );
    } else {
      text = text + "\n\n" + USER_MISSING_BLOCK_TWO;
    }
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function decodeHistoricalTemplate(rawSource = "") {
  const match = String(rawSource).match(/content:\s*`([\s\S]*?)`\s*\n};/);
  if (!match) throw new Error("HISTORICAL_CONTENT_NOT_FOUND");
  return match[1]
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\`/g, "`");
}

async function historicalFallback() {
  const response = await fetch(HISTORY_SOURCE, { cache: "no-store" });
  if (!response.ok) throw new Error("HISTORICAL_SOURCE_FETCH_FAILED");
  const fullContent = decodeHistoricalTemplate(await response.text());
  const split = splitPaidContent(fullContent);
  const publicClean = cleanBase64Images(split.publicContent).text;
  let privateClean = cleanBase64Images(split.privateContent).text;

  // 這句是使用者後來在後台可見的修訂用語；只有私有正文遺失時才用於歷史備援稿。
  privateClean = privateClean.replace(
    "那不管你聽過多少靈界的事情，看過多少不可思議的現象",
    "那不管你聽過多少靈異的事情，看過多少不可思議的現象"
  );

  return { publicContent: publicClean, privateContent: privateClean };
}

async function sha256(value = "") {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value || ""))
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function showToast(message, state = "success") {
  const toast = document.getElementById("admin-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "admin-toast is-visible is-" + state;
  window.setTimeout(() => toast.classList.remove("is-visible"), state === "error" ? 7000 : 4500);
}

function setRecoveryStatus(message, state = "") {
  const saveStatus = document.getElementById("save-status");
  const inline = document.getElementById("save-status-inline");
  if (saveStatus) saveStatus.textContent = message;
  if (inline) {
    inline.textContent = message;
    if (state) inline.dataset.state = state;
    else delete inline.dataset.state;
  }
}

async function recoverManuscript() {
  const articleRef = doc(db, "articles", ARTICLE_ID);
  const paidRef = doc(db, "paidArticleBodies", ARTICLE_ID);
  const [articleSnapshot, paidSnapshot] = await Promise.all([
    getDoc(articleRef),
    getDoc(paidRef)
  ]);

  if (!articleSnapshot.exists()) return;
  const article = articleSnapshot.data() || {};

  if (article.manualTextRecoveryRevision === RECOVERY_REVISION) return;

  setRecoveryStatus("正在找回這篇文章先前的後台文字，請稍候…", "saving");

  const history = await historicalFallback();
  const currentSplit = splitPaidContent(article.content || "");
  const currentPublicClean = cleanBase64Images(currentSplit.publicContent);
  const paid = paidSnapshot.exists() ? paidSnapshot.data() || {} : {};
  const currentPrivateClean = cleanBase64Images(paid.content || "");

  // 公開試閱若仍完整，保留目前後台版本；只有內容明顯遺失時才回復歷史稿。
  const publicContent =
    currentPublicClean.text.length >= Math.min(900, history.publicContent.length * 0.65)
      ? currentPublicClean.text
      : history.publicContent;

  // 私有正文優先保留 Firestore 現有版本，因為這裡最可能包含使用者後來在後台做的人工修訂。
  // 只有私有正文真的不存在時，才從 GitHub 安全分離前的歷史版本補回。
  const privateContent = restoreKnownUserParagraphs(
    currentPrivateClean.text.length >= 500
      ? currentPrivateClean.text
      : history.privateContent
  );

  if (!privateContent) throw new Error("PRIVATE_BODY_RECOVERY_FAILED");

  const nextVersion = Math.max(0, Number(paid.contentVersion || article.paidContentVersion || 0)) + 1;
  const contentHash = await sha256(privateContent);

  await setDoc(paidRef, {
    articleId: ARTICLE_ID,
    title: article.title || "《我在人間的元神覺醒》書外手記之一",
    status: article.status === "published" ? "published" : "draft",
    content: privateContent,
    contentHash,
    contentVersion: nextVersion,
    source: "manual-text-recovery",
    active: true,
    recoveredFromExistingBackend: currentPrivateClean.text.length >= 500,
    base64ImagesRemoved: currentPrivateClean.removed,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(articleRef, {
    content: (publicContent + "\n\n" + PAID_MARKER).trim(),
    accessType: "paid",
    privatePaidContent: true,
    paidContentHash: contentHash,
    paidContentVersion: nextVersion,
    manualTextRecoveryRevision: RECOVERY_REVISION,
    recoveredPrivateEditsPreserved: currentPrivateClean.text.length >= 500,
    base64ImagesRemovedFromPublic: currentPublicClean.removed,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const verifyArticle = await getDoc(articleRef);
  const verifyPaid = await getDoc(paidRef);
  if (
    !verifyArticle.exists() ||
    !verifyPaid.exists() ||
    verifyArticle.data()?.manualTextRecoveryRevision !== RECOVERY_REVISION ||
    String(verifyPaid.data()?.content || "") !== privateContent
  ) {
    throw new Error("RECOVERY_VERIFY_FAILED");
  }

  setRecoveryStatus("已找回後台文字｜保留人工修改｜Base64 圖片已移除", "success");
  showToast(
    currentPrivateClean.text.length >= 500
      ? "已保留你後來在後台修改的完整正文，只移除 Base64 圖片亂碼。"
      : "已從先前完整版本找回正文，並移除 Base64 圖片亂碼。",
    "success"
  );

  // 只重新載入一次，讓既有付費文章載入器把恢復後的完整正文重新放回編輯框。
  if (sessionStorage.getItem("yuanshen-manuscript-recovery-reloaded") !== RECOVERY_REVISION) {
    sessionStorage.setItem("yuanshen-manuscript-recovery-reloaded", RECOVERY_REVISION);
    window.setTimeout(() => location.reload(), 1200);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  void recoverManuscript().catch((error) => {
    console.error("元神書外手記文字復原失敗：", error);
    setRecoveryStatus("文章文字復原失敗，尚未繼續覆寫", "error");
    showToast("文章文字復原失敗，系統已停止，不會再覆寫目前內容。", "error");
  });
});
