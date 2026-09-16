import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const IMPORT_ID = "yuanqin-debt-heart";
const PAYLOAD_URL = "./secure-imports/yuanqin-debt-heart-20260828.enc.json?v=20260828-1";
const NEED_TEACHER_ID = "need-a-teacher";
const NEED_TEACHER_SOURCE_URL = "./drafts/spiritual/need-a-teacher.md?v=20260916-backend-draft-1";
const NEED_TEACHER_PAID_MARKER = "<!-- paid-only -->";
const NEED_TEACHER_LEGACY_MARKER = "<!-- member-only -->";
let started = false;
let needTeacherSeedStarted = false;

function base64UrlToBytes(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function showImportStatus(message, state = "success") {
  const toast = document.getElementById("admin-toast");
  if (toast) {
    toast.textContent = message;
    toast.className = `admin-toast is-visible is-${state}`;
    window.setTimeout(() => toast.classList.remove("is-visible"), state === "error" ? 8000 : 5000);
  }
  const status = document.getElementById("save-status");
  if (status) status.textContent = message;
}

async function gunzip(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("BROWSER_GZIP_UNSUPPORTED");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function importPaidDraft(keyText) {
  const response = await fetch(PAYLOAD_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("PAYLOAD_NOT_FOUND");
  const envelope = await response.json();
  if (envelope.algorithm !== "AES-GCM-256" || envelope.compression !== "gzip") {
    throw new Error("UNEXPECTED_PAYLOAD_FORMAT");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(keyText),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(envelope.iv) },
    key,
    base64UrlToBytes(envelope.ciphertext)
  );
  const plainBytes = await gunzip(new Uint8Array(decrypted));
  const plainHash = bytesToHex(await crypto.subtle.digest("SHA-256", plainBytes));
  if (plainHash !== envelope.plaintextSha256) throw new Error("PAYLOAD_HASH_MISMATCH");

  const payload = JSON.parse(new TextDecoder().decode(plainBytes));
  if (payload.articleId !== IMPORT_ID || payload.status !== "draft" || !String(payload.content || "").trim()) {
    throw new Error("INVALID_PAID_DRAFT");
  }

  const content = String(payload.content).trim();
  const contentHash = bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)));
  const privateRef = doc(db, "paidArticleBodies", IMPORT_ID);
  const previous = await getDoc(privateRef);
  const previousData = previous.exists() ? previous.data() || {} : {};
  const contentVersion = previousData.contentHash === contentHash
    ? Math.max(1, Number(previousData.contentVersion || 1))
    : Math.max(1, Number(previousData.contentVersion || 0) + 1);

  await setDoc(privateRef, {
    articleId: IMPORT_ID,
    title: payload.title || "為什麼冤親債主永遠度不完？",
    status: "draft",
    content,
    contentHash,
    contentVersion,
    source: "secure-one-time-import:20260828-yuanqin-final",
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, "articles", IMPORT_ID), {
    title: payload.title || "為什麼冤親債主永遠度不完？",
    status: "draft",
    accessType: "paid",
    privatePaidContent: true,
    paidContentHash: contentHash,
    paidContentVersion: contentVersion,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const verify = await getDoc(privateRef);
  if (!verify.exists() || String(verify.data()?.content || "") !== content || verify.data()?.contentHash !== contentHash) {
    throw new Error("PRIVATE_BODY_VERIFY_FAILED");
  }

  history.replaceState(null, "", location.pathname + location.search);
  localStorage.setItem("lyyuan:yuanqin-paid-import-version", String(contentVersion));
  showImportStatus(`《為什麼冤親債主永遠度不完？》付費正文已安全同步｜版本 ${contentVersion}`, "success");
  window.setTimeout(() => location.reload(), 1200);
}

function stripFrontMatter(markdown = "") {
  return String(markdown || "").replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
}

function splitNeedTeacherContent(markdown = "") {
  const normalized = stripFrontMatter(markdown)
    .replace(NEED_TEACHER_LEGACY_MARKER, NEED_TEACHER_PAID_MARKER)
    .trim();
  const markerIndex = normalized.indexOf(NEED_TEACHER_PAID_MARKER);
  if (markerIndex < 0) throw new Error("NEED_TEACHER_PAID_MARKER_MISSING");
  const publicContent = normalized.slice(0, markerIndex).trim();
  const privateContent = normalized.slice(markerIndex + NEED_TEACHER_PAID_MARKER.length).trim();
  if (!publicContent || !privateContent) throw new Error("NEED_TEACHER_CONTENT_INCOMPLETE");
  return {
    publicContent,
    privateContent,
    safeContent: `${publicContent}\n\n${NEED_TEACHER_PAID_MARKER}`.trim()
  };
}

async function seedNeedTeacherDraft() {
  const articleRef = doc(db, "articles", NEED_TEACHER_ID);
  const existing = await getDoc(articleRef);
  if (existing.exists()) return false;

  const response = await fetch(NEED_TEACHER_SOURCE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("NEED_TEACHER_SOURCE_NOT_FOUND");
  const split = splitNeedTeacherContent(await response.text());
  const contentHash = bytesToHex(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(split.privateContent)
  ));
  const contentVersion = 1;

  await setDoc(doc(db, "paidArticleBodies", NEED_TEACHER_ID), {
    articleId: NEED_TEACHER_ID,
    title: "走靈修，到底需不需要老師？",
    status: "draft",
    content: split.privateContent,
    contentHash,
    contentVersion,
    source: "secure-admin-draft-seed:20260916-need-a-teacher",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(articleRef, {
    title: "走靈修，到底需不需要老師？",
    slug: "need-a-teacher",
    category: "spiritual",
    displayCategory: "靈修",
    series: "靈修辨證",
    status: "draft",
    excerpt: "靈修初期為什麼需要老師？從無極老母的教導、人間前輩的校正，到求證、信仰與生活驗證，談一個修行者如何從被帶領，走到有能力辨識、反省並為自己的修行負責。",
    coverImage: "/assets/articles/need-a-teacher/cover.svg",
    thumbnailImage: "/assets/articles/need-a-teacher/thumbnail.svg",
    bookTitle: "我在人間的元神覺醒",
    bookAuthor: "宇色 Osel",
    bookPublisher: "柿子文化",
    bookPurchaseUrl: "https://www.books.com.tw/products/0011060075?sloc=main",
    bookCoverImage: "https://wsrv.nl/?w=480&output=webp&q=88&url=https%3A%2F%2Fwww.books.com.tw%2Fimg%2F001%2F106%2F00%2F0011060075.jpg",
    accessType: "paid",
    eventId: "",
    content: split.safeContent,
    privatePaidContent: true,
    paidContentHash: contentHash,
    paidContentVersion: contentVersion,
    draftSeedRevision: "20260916-backend-draft-1",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  const [verifyArticle, verifyPrivate] = await Promise.all([
    getDoc(articleRef),
    getDoc(doc(db, "paidArticleBodies", NEED_TEACHER_ID))
  ]);
  if (!verifyArticle.exists()
      || !verifyPrivate.exists()
      || String(verifyArticle.data()?.status || "") !== "draft"
      || String(verifyPrivate.data()?.content || "") !== split.privateContent) {
    throw new Error("NEED_TEACHER_DRAFT_VERIFY_FAILED");
  }

  localStorage.setItem("lyyuan:need-a-teacher-draft-seeded", "20260916-backend-draft-1");
  return true;
}

const params = new URLSearchParams(location.hash.replace(/^#/, ""));
const importId = params.get("paidImport") || "";
const importKey = params.get("key") || "";

if (importId === IMPORT_ID && importKey) {
  onAuthStateChanged(auth, (user) => {
    if (started || !user) return;
    if (!isAdminEmail(user.email)) {
      showImportStatus("此同步連結僅限靈元院管理員帳號使用。", "error");
      return;
    }
    started = true;
    showImportStatus("正在安全同步這篇草稿的付費正文…", "success");
    void importPaidDraft(importKey).catch((error) => {
      console.error("付費正文安全同步失敗：", error);
      showImportStatus("付費正文同步失敗，請保留這個頁面並重新開啟同步連結。", "error");
    });
  });
}

onAuthStateChanged(auth, (user) => {
  if (needTeacherSeedStarted || !user || !isAdminEmail(user.email)) return;
  needTeacherSeedStarted = true;
  void seedNeedTeacherDraft()
    .then((created) => {
      if (!created) return;
      showImportStatus("《走靈修，到底需不需要老師？》已寫入後台草稿區，正在重新載入…", "success");
      window.setTimeout(() => location.reload(), 900);
    })
    .catch((error) => {
      console.error("《走靈修，到底需不需要老師？》後台草稿建立失敗：", error);
      showImportStatus("這篇文章的後台草稿尚未建立成功，請重新整理後台再試一次。", "error");
    });
});
