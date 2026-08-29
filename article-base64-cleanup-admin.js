import { auth, db, isAdminEmail } from "./firebase-config.js";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_COLLECTION = "articles";
const PAID_COLLECTION = "paidArticleBodies";
const suspiciousPattern = /data:image|base64,/i;
const base64MarkdownPattern = /!\[[^\]]*\]\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi;

let results = [];
let busy = false;

function cleanContent(value) {
  const source = String(value || "");
  let removed = 0;
  const cleaned = source.replace(base64MarkdownPattern, function () {
    removed += 1;
    return "";
  }).replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n").trim();
  return { cleaned: cleaned, removed: removed };
}

function around(value, pattern) {
  const source = String(value || "");
  const match = source.match(pattern || suspiciousPattern);
  if (!match || match.index == null) return source.slice(0, 360);
  const start = Math.max(0, match.index - 180);
  const end = Math.min(source.length, match.index + 180);
  return (start ? "…" : "") + source.slice(start, end) + (end < source.length ? "…" : "");
}

function toast(message, state) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = message;
  el.className = "admin-toast is-visible is-" + (state || "success");
  window.setTimeout(function () { el.classList.remove("is-visible"); }, state === "error" ? 6500 : 3800);
}

function setStatus(message, state) {
  const el = document.getElementById("base64-cleanup-status");
  if (!el) return;
  el.textContent = message;
  if (state) el.dataset.state = state;
  else delete el.dataset.state;
}

function keyOf(item) {
  return item.collection + "/" + item.id;
}

function render() {
  const host = document.getElementById("base64-cleanup-results");
  const apply = document.getElementById("base64-apply-button");
  if (!host || !apply) return;
  host.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "掃描完成：目前沒有發現正文包含 data:image 或 base64,。";
    host.appendChild(empty);
    apply.disabled = true;
    return;
  }

  results.forEach(function (item) {
    const row = document.createElement("div");
    row.className = "member-row";
    row.style.gridTemplateColumns = "1fr";

    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.gap = "10px";
    label.style.alignItems = "flex-start";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.base64Select = keyOf(item);
    checkbox.style.width = "auto";
    checkbox.style.marginTop = "6px";
    checkbox.checked = item.removed > 0;
    checkbox.disabled = item.removed === 0;

    const info = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.title || "未命名文章";
    const meta = document.createElement("small");
    meta.textContent = (item.collection === ARTICLE_COLLECTION ? "一般文章資料" : "付費文章私有正文") + "｜ID：" + item.id;
    const note = document.createElement("small");
    note.textContent = item.removed > 0
      ? "可安全移除 " + item.removed + " 個 Markdown Base64 圖片。"
      : "偵測到 Base64 字串，但不符合安全自動清理格式；不會自動修改。";
    info.append(title, meta, note);
    label.append(checkbox, info);

    const details = document.createElement("details");
    details.style.marginTop = "8px";
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.color = "#D8BD91";
    summary.textContent = "查看原文問題片段與清理後預覽";
    const before = document.createElement("pre");
    before.style.whiteSpace = "pre-wrap";
    before.style.wordBreak = "break-all";
    before.style.maxHeight = "220px";
    before.style.overflow = "auto";
    before.textContent = "原文問題片段\n\n" + item.before;
    const after = document.createElement("pre");
    after.style.whiteSpace = "pre-wrap";
    after.style.wordBreak = "break-word";
    after.style.maxHeight = "220px";
    after.style.overflow = "auto";
    after.textContent = "清理後預覽\n\n" + item.after;
    details.append(summary, before, after);

    row.append(label, details);
    host.appendChild(row);
  });

  apply.disabled = !results.some(function (item) { return item.removed > 0; });
}

async function scan() {
  if (busy) return;
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    toast("請先使用靈元院管理員 Gmail 登入。", "error");
    return;
  }

  busy = true;
  const scanButton = document.getElementById("base64-scan-button");
  const applyButton = document.getElementById("base64-apply-button");
  if (scanButton) {
    scanButton.disabled = true;
    scanButton.textContent = "掃描中…";
  }
  if (applyButton) applyButton.disabled = true;
  setStatus("正在掃描 Firestore 正文…", "saving");

  try {
    const snapshots = await Promise.all([
      getDocs(collection(db, ARTICLE_COLLECTION)),
      getDocs(collection(db, PAID_COLLECTION))
    ]);
    const articleSnapshot = snapshots[0];
    const paidSnapshot = snapshots[1];
    const titles = new Map();
    articleSnapshot.docs.forEach(function (item) {
      const data = item.data() || {};
      titles.set(item.id, data.title || "");
    });

    const found = [];
    function inspect(collectionName, item) {
      const data = item.data() || {};
      const body = String(data.content || "");
      if (!suspiciousPattern.test(body)) return;
      const cleaned = cleanContent(body);
      found.push({
        collection: collectionName,
        id: item.id,
        title: data.title || titles.get(item.id) || item.id,
        content: body,
        cleaned: cleaned.cleaned,
        removed: cleaned.removed,
        version: Math.max(0, Number(data.contentVersion || 0)),
        before: around(body),
        after: around(cleaned.cleaned, /\S/)
      });
    }

    articleSnapshot.docs.forEach(function (item) { inspect(ARTICLE_COLLECTION, item); });
    paidSnapshot.docs.forEach(function (item) { inspect(PAID_COLLECTION, item); });
    results = found;
    render();

    const safe = found.filter(function (item) { return item.removed > 0; }).length;
    const manual = found.length - safe;
    setStatus("掃描完成｜找到 " + found.length + " 篇異常，" + safe + " 篇可安全自動清理" + (manual ? "，" + manual + " 篇需人工確認" : ""), found.length ? "success" : "");
  } catch (error) {
    console.error("Base64 掃描失敗：", error);
    results = [];
    render();
    setStatus("掃描失敗，請確認管理員權限與網路狀態。", "error");
    toast("Base64 掃描失敗。", "error");
  } finally {
    busy = false;
    if (scanButton) {
      scanButton.disabled = false;
      scanButton.textContent = "重新掃描 Base64 異常文章";
    }
  }
}

function selected() {
  const keys = new Set(Array.from(document.querySelectorAll("[data-base64-select]:checked")).map(function (input) {
    return input.dataset.base64Select;
  }));
  return results.filter(function (item) { return item.removed > 0 && keys.has(keyOf(item)); });
}

function backup(items) {
  const payload = {
    exportedAt: new Date().toISOString(),
    reason: "Before Base64 markdown cleanup",
    items: items.map(function (item) {
      return { collection: item.collection, id: item.id, title: item.title, originalContent: item.content };
    })
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lyyuan-base64-cleanup-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
}

async function applyCleanup() {
  if (busy) return;
  const user = auth.currentUser;
  if (!user || !isAdminEmail(user.email)) {
    toast("請先使用靈元院管理員 Gmail 登入。", "error");
    return;
  }

  const items = selected();
  if (!items.length) {
    toast("目前沒有勾選可安全清理的文章。", "error");
    return;
  }

  const names = items.map(function (item) { return "・" + item.title; }).join("\n");
  if (!window.confirm("即將清理 " + items.length + " 篇文章中的 Base64 Markdown 圖片。\n\n" + names + "\n\n系統會先下載原文 JSON 備份，再寫回 Firestore。確定繼續嗎？")) return;

  busy = true;
  const scanButton = document.getElementById("base64-scan-button");
  const applyButton = document.getElementById("base64-apply-button");
  if (scanButton) scanButton.disabled = true;
  if (applyButton) {
    applyButton.disabled = true;
    applyButton.textContent = "清理中…";
  }

  try {
    backup(items);
    let done = 0;
    for (const item of items) {
      if (item.collection === PAID_COLLECTION) {
        const nextVersion = item.version + 1;
        const hash = await sha256(item.cleaned);
        await setDoc(doc(db, PAID_COLLECTION, item.id), {
          content: item.cleaned,
          contentHash: hash,
          contentVersion: nextVersion,
          base64CleanupAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        await setDoc(doc(db, ARTICLE_COLLECTION, item.id), {
          paidContentHash: hash,
          paidContentVersion: nextVersion,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await setDoc(doc(db, ARTICLE_COLLECTION, item.id), {
          content: item.cleaned,
          base64CleanupAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      done += 1;
      setStatus("清理中｜已完成 " + done + "/" + items.length, "saving");
    }
    toast("已完成 " + items.length + " 篇文章的 Base64 清理；原文備份已下載。", "success");
  } catch (error) {
    console.error("Base64 清理失敗：", error);
    setStatus("清理未全部完成，請重新掃描確認。", "error");
    toast("Base64 清理發生錯誤，請保留下載的備份並重新掃描。", "error");
  } finally {
    busy = false;
    if (applyButton) applyButton.textContent = "確認並清理選取文章";
    if (scanButton) scanButton.disabled = false;
    await scan();
  }
}

function insertText(field, text) {
  const start = field.selectionStart == null ? field.value.length : field.selectionStart;
  const end = field.selectionEnd == null ? field.value.length : field.selectionEnd;
  field.setRangeText(text, start, end, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function installProtection() {
  const field = document.getElementById("content");
  const form = document.getElementById("article-form");
  if (!field || field.dataset.base64Protected === "1") return;
  field.dataset.base64Protected = "1";

  field.addEventListener("paste", function (event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const text = clipboard.getData("text/plain") || "";
    const hasImage = Array.from(clipboard.items || []).some(function (item) {
      return item.type && item.type.startsWith("image/");
    });
    const suspicious = suspiciousPattern.test(text);
    if (!hasImage && !suspicious) return;

    event.preventDefault();
    if (suspicious) {
      const cleaned = cleanContent(text);
      if (cleaned.removed > 0 && !suspiciousPattern.test(cleaned.cleaned)) {
        insertText(field, cleaned.cleaned);
        toast("已阻擋 Base64 圖片，只貼入純文字內容。", "success");
      } else {
        toast("已阻擋貼上：內容仍含 data:image 或 base64,，圖片請使用「插入圖片」上傳。", "error");
      }
      return;
    }
    if (text) insertText(field, text);
    toast("已阻擋直接貼入圖片；文字已保留。圖片請使用「插入圖片」上傳。", "success");
  });

  field.addEventListener("drop", function (event) {
    const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
    if (!files.some(function (file) { return file.type && file.type.startsWith("image/"); })) return;
    event.preventDefault();
    toast("正文欄位不接受直接拖入圖片，請使用「插入圖片」上傳。", "error");
  });

  if (form) {
    form.addEventListener("submit", function (event) {
      if (!suspiciousPattern.test(String(field.value || ""))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toast("已阻止儲存：正文仍含 data:image 或 base64,。請先清理。", "error");
      field.focus();
    }, true);
  }
}

document.getElementById("base64-scan-button")?.addEventListener("click", scan);
document.getElementById("base64-apply-button")?.addEventListener("click", applyCleanup);
installProtection();
