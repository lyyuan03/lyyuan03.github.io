import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_ID = "yuanshen-awakening-old-manuscript";
const REVISION = "20260829-known-paragraphs-safe-1";

const BLOCK_ONE = `也因為這件事，讓我更加確定了一個觀念：**通靈，終究抵不過法律。**

嘴上說得再玄、講得再神，鬼神之事說得天花亂墜，都不代表一個人可以凌駕現實世界的規則。當事情真正走進法律、證據與責任的範圍裡，所有無法被證明的神通與說法，都必須退到一旁。

因為人活在人間，就必須面對人間的法則。`;

const BLOCK_TWO = `雖然他後來沉默了，但他的老師依然持續在網路上關注我的文章，甚至試圖以匿名的方式，影射、批判我的教導與觀點。

只是到了那個時候，這些事情對我而言，早已沒有什麼殺傷力了。

你沒有指名道姓，我也不需要對號入座；你有你的立場，我有我的觀點。再多的影射與暗示，如果始終只能躲在匿名的背後，其實也沒有什麼值得我回應的。

所以後來，我選擇不再理會。

不是因為我不知道，而是因為我知道，卻已經不覺得有回應的必要。`;

function restoreKnownParagraphs(value = "") {
  let text = String(value || "").trim();
  let changed = false;

  if (!text.includes("通靈，終究抵不過法律")) {
    const anchor = "後來，對方就沒有再來了。";
    if (text.includes(anchor)) {
      text = text.replace(anchor, anchor + "\n\n" + BLOCK_ONE);
      changed = true;
    }
  }

  if (!text.includes("雖然他後來沉默了，但他的老師依然持續在網路上關注我的文章")) {
    const heading = "## 母娘後來給我的提醒";
    if (text.includes(heading)) {
      text = text.replace(heading, BLOCK_TWO + "\n\n" + heading);
      changed = true;
    }
  }

  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), changed };
}

async function sha256(value = "") {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanPublicImageRemnants(value = "") {
  return String(value || "")
    .replace(/(^|\n)\s*!\[\]\s*(?=\n|$)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveArticleDoc() {
  const directRef = doc(db, "articles", ARTICLE_ID);
  const directSnapshot = await getDoc(directRef);
  if (directSnapshot.exists()) {
    return { id: directSnapshot.id, ref: directRef, snapshot: directSnapshot };
  }

  const slugSnapshot = await getDocs(query(collection(db, "articles"), where("slug", "==", ARTICLE_ID)));
  const match = slugSnapshot.docs[0];
  if (!match) return null;
  return { id: match.id, ref: match.ref, snapshot: match };
}

async function migrateKnownParagraphs() {
  const resolved = await resolveArticleDoc();
  if (!resolved) return;

  const articleRef = resolved.ref;
  const paidRef = doc(db, "paidArticleBodies", resolved.id);
  const articleSnapshot = resolved.snapshot;
  const paidSnapshot = await getDoc(paidRef);

  if (!paidSnapshot.exists()) return;
  const article = articleSnapshot.data() || {};
  if (article.knownParagraphRecoveryRevision === REVISION) return;

  const paid = paidSnapshot.data() || {};
  const current = String(paid.content || "").trim();
  const cleanedPublicContent = cleanPublicImageRemnants(article.content || "");

  // 安全原則：私有正文不存在或過短時完全不碰，不再拿 GitHub 舊稿覆蓋。
  if (current.length < 500) {
    console.warn("元神書外手記私有正文不足，停止自動補文，避免覆寫人工內容。");
    return;
  }

  const restored = restoreKnownParagraphs(current);
  let version = Math.max(1, Number(paid.contentVersion || article.paidContentVersion || 1));
  let hash = String(paid.contentHash || article.paidContentHash || "");

  if (restored.changed) {
    version += 1;
    hash = await sha256(restored.text);
    await setDoc(paidRef, {
      content: restored.text,
      contentHash: hash,
      contentVersion: version,
      source: "known-paragraph-safe-recovery",
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const verify = await getDoc(paidRef);
    if (!verify.exists() || String(verify.data()?.content || "") !== restored.text) {
      throw new Error("KNOWN_PARAGRAPH_RECOVERY_VERIFY_FAILED");
    }
  }

  await setDoc(articleRef, {
    content: cleanedPublicContent,
    knownParagraphRecoveryRevision: REVISION,
    paidContentHash: hash,
    paidContentVersion: version,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  void migrateKnownParagraphs().catch((error) => {
    console.error("已知遺失段落安全復原失敗：", error);
  });
});
