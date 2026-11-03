// 會員中心：我的會員專屬提問（只讀取本人 uid 的提問，Firestore rules 強制）。
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
function formatTime(value) {
  const date = value?.toDate ? value.toDate() : null;
  return date ? date.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" }) : "";
}

onAuthStateChanged(auth, async (user) => {
  document.getElementById("my-member-questions")?.remove();
  if (!user) return;
  let items = [];
  try {
    const snapshot = await getDocs(query(collection(db, "memberQuestions"), where("uid", "==", user.uid)));
    items = snapshot.docs.map((d) => d.data()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (error) {
    console.warn("我的提問暫時無法載入。", error);
    return;
  }
  if (!items.length) return;
  const section = document.createElement("section");
  section.id = "my-member-questions";
  section.className = "card section";
  section.style.cssText = "max-width:1120px;margin:24px auto;padding:24px";
  section.innerHTML = `<div class="section-head"><div><span class="eyebrow">MY QUESTIONS</span><h2>💬 我的會員專屬提問</h2></div><span class="section-side">僅您本人可見</span></div>
    <ul style="list-style:none;padding:0;margin:0;display:grid;gap:12px">${items.map((q) => `<li style="padding:12px 14px;border:1px solid rgba(165,130,84,.3)">
      <a href="articles.html?id=${encodeURIComponent(q.articleId)}" style="font-weight:700;text-decoration:none">${escapeHtml(q.articleTitle || q.articleId)}</a>
      <small style="display:block;opacity:.7">${formatTime(q.createdAt)}｜${q.reply ? "已回覆" : "等待回覆"}</small>
      <p style="white-space:pre-wrap;margin:8px 0">${escapeHtml(q.question)}</p>
      ${q.reply ? `<div style="border-left:3px solid #A58254;padding:6px 12px"><strong>靈元院回覆</strong><p style="white-space:pre-wrap;margin:4px 0">${escapeHtml(q.reply)}</p></div>` : ""}
    </li>`).join("")}</ul>`;
  const anchor = document.getElementById("member-dashboard") || document.getElementById("dashboard-access-panel");
  anchor?.after(section);
});
