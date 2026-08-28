import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const IMPORT_ID = "yuanqin-debt-heart";
const PAYLOAD_URL = "./secure-imports/yuanqin-debt-heart-20260828.enc.json?v=20260828-1";
let started = false;

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
