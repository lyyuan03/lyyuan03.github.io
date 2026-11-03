// 管理後台：會員專屬提問（只有管理者 Gmail 可讀取全部與回覆，Firestore rules 強制）。
import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const listEl = document.getElementById("member-questions-list");
const statusEl = document.getElementById("member-questions-status-message");
const filterEl = document.getElementById("member-questions-filter");
const reloadEl = document.getElementById("member-questions-reload");
let questions = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function formatTime(value) {
  const date = value?.toDate ? value.toDate() : null;
  return date ? date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "";
}

function render() {
  if (!listEl) return;
  const mode = filterEl?.value || "open";
  const shown = questions.filter((q) => mode === "all" || (mode === "open" ? !q.reply : Boolean(q.reply)));
  const openCount = questions.filter((q) => !q.reply).length;
  if (statusEl) statusEl.textContent = `共 ${questions.length} 則｜待回覆 ${openCount} 則`;
  listEl.innerHTML = shown.length ? shown.map((q) => `
    <div class="member-row member-question-admin-row" data-question-id="${escapeHtml(q.id)}" style="grid-template-columns:1fr">
      <div>
        <strong>${escapeHtml(q.articleTitle || q.articleId)}</strong>
        <small>${escapeHtml(q.email)}｜${formatTime(q.createdAt)}｜${q.reply ? "已回覆" : "待回覆"}</small>
        <p style="white-space:pre-wrap;margin:10px 0;font-size:14px">${escapeHtml(q.question)}</p>
        <textarea data-reply-input style="width:100%;min-height:90px" placeholder="輸入回覆（送出後會寄信通知會員）">${escapeHtml(q.reply || "")}</textarea>
        <div class="member-row-actions" style="justify-content:flex-start;margin-top:8px">
          <button class="btn primary" type="button" data-reply-save>${q.reply ? "更新回覆" : "送出回覆"}</button>
          <a class="btn" href="articles.html?id=${encodeURIComponent(q.articleId)}" target="_blank" rel="noopener">查看文章</a>
          <span data-reply-status class="status"></span>
        </div>
      </div>
    </div>`).join("") : '<div class="empty">目前沒有符合條件的提問。</div>';
}

async function load() {
  if (!listEl) return;
  listEl.innerHTML = '<div class="empty">載入中…</div>';
  try {
    const snapshot = await getDocs(query(collection(db, "memberQuestions"), orderBy("createdAt", "desc"), limit(300)));
    questions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  } catch (error) {
    console.error("會員提問載入失敗", error);
    listEl.innerHTML = '<div class="empty">會員提問載入失敗（請確認已部署最新 Firestore rules）。</div>';
  }
}

listEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reply-save]");
  if (!button) return;
  const row = button.closest("[data-question-id]");
  const id = row.dataset.questionId;
  const reply = row.querySelector("[data-reply-input]").value.trim();
  const status = row.querySelector("[data-reply-status]");
  if (!reply) { status.textContent = "請輸入回覆內容"; return; }
  button.disabled = true;
  status.textContent = "儲存中…";
  try {
    await updateDoc(doc(db, "memberQuestions", id), {
      reply: reply.slice(0, 5000),
      replyBy: auth.currentUser?.email || "",
      repliedAt: serverTimestamp(),
      status: "answered",
      updatedAt: serverTimestamp()
    });
    const item = questions.find((q) => q.id === id);
    if (item) item.reply = reply;
    status.textContent = "✓ 已回覆";
    render();
  } catch (error) {
    console.error("回覆失敗", error);
    status.textContent = "回覆失敗";
  } finally {
    button.disabled = false;
  }
});
filterEl?.addEventListener("change", render);
reloadEl?.addEventListener("click", load);

onAuthStateChanged(auth, (user) => {
  if (user && isAdminEmail(user.email)) load();
});
