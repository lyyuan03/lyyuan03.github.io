// 會員專屬提問：僅出現在「贊助專屬」文章詳細頁文末。
// 私密：會員只能看到自己的提問與回覆（Firestore rules 強制）；不公開顯示任何人的提問。
// 不新增 MutationObserver / setInterval：只監聽文章核心與付費載入器既有的事件。
import { auth, db } from "./firebase-config.js";
import { resolveMemberAccess } from "./member-access-resolver.js?v=20261001-article-window-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const BLOCK_ID = "member-questions";
const MIN_LENGTH = 5;
const MAX_LENGTH = 2000;
const activeArticleId = new URLSearchParams(location.search).get("id") || "";
let currentUser = null;
let authResolved = false;
let accessCache = new Map();

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function paidView() {
  const view = document.querySelector('.article-view[data-article-id][data-article-access="paid"]');
  return view && !view.querySelector("[data-event-gate]") ? view : null;
}

function formatTime(value) {
  const date = value?.toDate ? value.toDate() : null;
  return date ? date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }) : "剛剛";
}

function ensureBlock(view) {
  let block = view.querySelector(`#${BLOCK_ID}`);
  if (block) return block;
  block = document.createElement("section");
  block.id = BLOCK_ID;
  block.className = "member-questions";
  block.setAttribute("aria-label", "會員專屬提問");
  const anchor = view.querySelector(".article-share");
  if (anchor) view.insertBefore(block, anchor);
  else view.appendChild(block);
  return block;
}

function headerHtml() {
  return `<h3 class="member-questions-title">💬 會員專屬提問</h3><p class="member-questions-sub">贊助會員專屬，靈元院會親自回覆。提問與回覆僅您本人可見，不會公開。</p>`;
}

async function hasAccess(user) {
  if (!user) return false;
  if (!accessCache.has(user.uid)) accessCache.set(user.uid, resolveMemberAccess(user).then((r) => r.allowed).catch(() => false));
  return accessCache.get(user.uid);
}

function renderPrompt(block, signedIn) {
  block.dataset.mode = "prompt";
  block.innerHTML = `${headerHtml()}<div class="member-questions-prompt"><p>${signedIn ? "目前登入的 Gmail 尚未具備贊助會員資格。" : "請先以贊助會員 Gmail 登入，即可針對本篇提問。"}</p><div class="member-questions-actions">${signedIn ? "" : '<button type="button" class="member-questions-btn is-primary" data-mq-login>會員登入</button>'}<a class="member-questions-btn" data-mq-sponsor href="membership.html">成為贊助會員</a></div></div>`;
  block.querySelector("[data-mq-login]")?.addEventListener("click", () => document.getElementById("member-login-button")?.click());
  block.querySelector("[data-mq-sponsor]")?.addEventListener("click", (event) => {
    const card = document.querySelector(".sponsor-join-card");
    if (card) { event.preventDefault(); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
}

function questionItemHtml(item) {
  const replied = Boolean(item.reply);
  return `<li class="member-question-item${replied ? " is-answered" : ""}">
    <div class="member-question-meta"><span>${formatTime(item.createdAt)}</span><span class="member-question-status">${replied ? "已回覆" : "等待回覆"}</span></div>
    <p class="member-question-text">${escapeHtml(item.question)}</p>
    ${replied ? `<div class="member-question-reply"><strong>靈元院回覆</strong><p>${escapeHtml(item.reply)}</p><small>${formatTime(item.repliedAt)}</small></div>` : ""}
  </li>`;
}

async function loadOwnQuestions(block, articleId) {
  const list = block.querySelector("[data-mq-list]");
  if (!list || !currentUser) return;
  try {
    const snapshot = await getDocs(query(collection(db, "memberQuestions"), where("uid", "==", currentUser.uid), where("articleId", "==", articleId)));
    const items = snapshot.docs.map((d) => d.data()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    list.innerHTML = items.length ? items.map(questionItemHtml).join("") : '<li class="member-question-empty">您尚未對本篇提問。</li>';
  } catch (error) {
    console.warn("會員提問紀錄暫時無法載入。", error);
    list.innerHTML = '<li class="member-question-empty">提問紀錄暫時無法載入，請稍後再試。</li>';
  }
}

function renderMemberForm(block, view) {
  const articleId = view.dataset.articleId;
  block.dataset.mode = "member";
  block.innerHTML = `${headerHtml()}
    <form class="member-questions-form" novalidate>
      <label class="member-questions-label" for="member-question-input">您對本篇的提問</label>
      <textarea id="member-question-input" maxlength="${MAX_LENGTH}" rows="4" placeholder="請具體描述您的問題（至少 ${MIN_LENGTH} 字）"></textarea>
      <div class="member-questions-form-foot"><small data-mq-count>0 / ${MAX_LENGTH}</small><button type="submit" class="member-questions-btn is-primary">送出提問</button></div>
      <p class="member-questions-status" role="status" aria-live="polite"></p>
    </form>
    <h4 class="member-questions-history-title">我的提問紀錄</h4>
    <ul class="member-questions-list" data-mq-list><li class="member-question-empty">載入中…</li></ul>`;
  const form = block.querySelector("form");
  const input = form.querySelector("textarea");
  const status = form.querySelector(".member-questions-status");
  const count = form.querySelector("[data-mq-count]");
  input.addEventListener("input", () => { count.textContent = `${input.value.length} / ${MAX_LENGTH}`; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (question.length < MIN_LENGTH) { status.textContent = `請至少輸入 ${MIN_LENGTH} 個字。`; return; }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "送出中…";
    try {
      await addDoc(collection(db, "memberQuestions"), {
        uid: currentUser.uid,
        email: currentUser.email,
        articleId,
        articleTitle: (view.querySelector(":scope > h2")?.textContent || "").trim().slice(0, 300),
        question: question.slice(0, MAX_LENGTH),
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      input.value = "";
      count.textContent = `0 / ${MAX_LENGTH}`;
      status.textContent = "✓ 已送出，靈元院回覆後會寄信通知您。";
      loadOwnQuestions(block, articleId);
    } catch (error) {
      console.warn("會員提問送出失敗。", error);
      status.textContent = "送出失敗：可能本篇不在您的會員閱讀範圍內，或網路不穩，請稍後再試。";
    } finally {
      button.disabled = false;
    }
  });
  loadOwnQuestions(block, articleId);
}

async function refresh() {
  const view = paidView();
  if (!view) {
    document.getElementById(BLOCK_ID)?.remove();
    return;
  }
  const block = ensureBlock(view);
  if (!authResolved) {
    if (!block.dataset.mode) { block.dataset.mode = "pending"; block.innerHTML = `${headerHtml()}<p class="member-questions-pending">確認會員資格中…</p>`; }
    return;
  }
  const user = currentUser;
  const allowed = await hasAccess(user);
  if (user !== currentUser || !view.isConnected) return;
  if (allowed) { if (block.dataset.mode !== "member") renderMemberForm(block, view); }
  else renderPrompt(block, Boolean(user));
}

if (activeArticleId) {
  document.addEventListener("lyyuan:article-rendered", () => { refresh(); });
  document.addEventListener("lyyuan:paid-article-loaded", () => { refresh(); });
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authResolved = true;
    const block = document.getElementById(BLOCK_ID);
    if (block) block.dataset.mode = "";
    refresh();
  });
  refresh();
}
