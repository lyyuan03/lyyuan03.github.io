import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "./firebase-config.js";
import { doc, getDoc, serverTimestamp, setDoc } from "./firebase-config.js";

const ARTICLE_ID = "2026-guanyin-vow-lamp-record-v2";
const IMAGE_ONE = "![每一封疏文，都是一份交付給觀世音菩薩的修行託付](/assets/articles/2026-guanyin-vow-lamp-record/vow-sheets-before-guanyin.webp?v=20260802-1)";
const IMAGE_TWO = "![真正的感應不急著證明，會在時間裡慢慢證明自己](/assets/articles/2026-guanyin-vow-lamp-record/patience-in-practice.webp?v=20260802-1)";
const IMAGE_THREE = "![符合天命的路不是沒有阻礙，而是在阻礙中依然感覺篤定](/assets/articles/2026-guanyin-vow-lamp-record/path-with-obstacles.webp?v=20260802-1)";

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function decryptContent(article, rawKey) {
  const key = await crypto.subtle.importKey("raw", base64ToBytes(rawKey), { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(article.eventIv) },
    key,
    base64ToBytes(article.encryptedContent)
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptContent(content, rawKey) {
  const key = await crypto.subtle.importKey("raw", base64ToBytes(rawKey), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(content));
  return {
    encryptedContent: bytesToBase64(new Uint8Array(encrypted)),
    eventIv: bytesToBase64(iv)
  };
}

function insertBeforeHeading(content, heading, imageMarkdown) {
  if (content.includes(imageMarkdown.split(")")[0])) return content;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\n)(#{1,4}\\s*)?${escaped}\\s*(?=\\n|$)`);
  const match = content.match(pattern);
  if (!match) return content;
  const index = match.index + (match[1]?.length || 0);
  return `${content.slice(0, index)}${imageMarkdown}\n\n${content.slice(index)}`;
}

function addArticleImages(content) {
  let next = content.replace(
    /^!\[[^\]]*\]\(\/?assets\/articles\/guanyin-vow-lamp\/guanyin-vow-lamp-[123]\.svg(?:\?[^)]*)?\)\s*$/gm,
    ""
  );
  next = insertBeforeHeading(next, "我知道方法，但我做不到", IMAGE_ONE);
  next = insertBeforeHeading(next, "我聽見最重的兩段話，是關於生死與親情", IMAGE_TWO);
  next = insertBeforeHeading(next, "一連串巧合，其實就證明了你走在對的路上", IMAGE_THREE);
  if (!next.includes(IMAGE_THREE.split(")")[0])) {
    next = insertBeforeHeading(next, "四、一連串巧合，其實就證明了你走在對的路上", IMAGE_THREE);
  }
  return next;
}

async function updateArticle() {
  const articleRef = doc(db, "articles", ARTICLE_ID);
  const [articleSnapshot, keysSnapshot] = await Promise.all([
    getDoc(articleRef),
    getDoc(doc(db, "membershipSettings", "eventArticleKeys"))
  ]);
  if (!articleSnapshot.exists()) return;
  const article = articleSnapshot.data();
  const rawKey = keysSnapshot.exists() ? keysSnapshot.data().keys?.[ARTICLE_ID] : "";
  if (!rawKey || !article.encryptedContent || !article.eventIv) return;

  const content = await decryptContent(article, rawKey);
  const updatedContent = addArticleImages(content);
  if (updatedContent === content) return;

  const protectedContent = await encryptContent(updatedContent, rawKey);
  await setDoc(articleRef, {
    content: "",
    encryptedContent: protectedContent.encryptedContent,
    eventIv: protectedContent.eventIv,
    imageLayoutVersion: "guanyin-vow-lamp-3-editorial-photos-v2",
    updatedAt: serverTimestamp()
  }, { merge: true });

  sessionStorage.setItem("guanyin-v2-images-updated", "1");
}

onAuthStateChanged(auth, (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  updateArticle().catch((error) => console.error("觀音法會文章圖卡更新失敗：", error));
});
