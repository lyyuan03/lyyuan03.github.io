import { auth, db, provider } from "./firebase-config.js";
import { memberLevelLabel, normalizeMemberLevel, toDate } from "./member-access.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const UPGRADE_TARGET = 15000;
const loginGate = document.getElementById("login-gate");
const appEl = document.getElementById("member-app");
const gateStatus = document.getElementById("gate-status");

function money(value = 0) {
  return `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "未設定";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function levelBenefits(level) {
  const lingji = normalizeMemberLevel(level) === "lingji";
  return [
    ["✓", "會員文章", "登入後依文章權限閱讀會員內容"],
    ["✓", "一般會員影片", "可觀看一般會員專屬影片"],
    [lingji ? "✓" : "鎖", "靈極會員影片", lingji ? "已解鎖靈極會員專屬影片" : "升級靈極會員後解鎖"],
    ["禮", "滿額回饋", "單次消費滿 NT$15,000，回饋 NT$1,000 供下次使用"]
  ];
}

function renderBenefits(level) {
  document.getElementById("benefit-list").innerHTML = levelBenefits(level).map(([icon, title, text]) => `
    <div class="benefit"><span class="icon">${escapeHtml(icon)}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div></div>
  `).join("");
}

function renderMember(member, purchases) {
  const level = normalizeMemberLevel(member.memberLevel);
  const totalSpend = Number(member.totalSpend ?? purchases.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const rewardBalance = Number(member.rewardBalance || 0);
  const remaining = Math.max(0, UPGRADE_TARGET - totalSpend);
  const progress = Math.min(100, totalSpend / UPGRADE_TARGET * 100);

  document.getElementById("member-name").textContent = member.name || "會員您好";
  document.getElementById("member-level").textContent = memberLevelLabel(level);
  document.getElementById("member-expiry").textContent = `到期日｜${formatDate(member.expiresAt)}`;
  document.getElementById("total-spend").textContent = money(totalSpend);
  document.getElementById("reward-balance").textContent = money(rewardBalance);
  document.getElementById("progress-current").textContent = money(totalSpend);
  document.getElementById("progress-bar").style.width = `${progress}%`;
  document.getElementById("progress-ratio").textContent = `${totalSpend.toLocaleString("zh-TW")} / ${UPGRADE_TARGET.toLocaleString("zh-TW")}`;
  document.getElementById("progress-remaining").textContent = remaining
    ? `距離靈極會員尚差 ${money(remaining)}`
    : "已達靈極會員消費門檻";
  document.getElementById("level-note").textContent = level === "lingji"
    ? "您目前可觀看一般會員與靈極會員專屬內容。"
    : "一般會員可觀看一般會員內容；達成資格後可升級並解鎖靈極會員內容。";
  renderBenefits(level);

  const list = document.getElementById("purchase-list");
  if (!purchases.length) {
    list.innerHTML = '<tr><td colspan="4" class="empty">目前尚無消費紀錄</td></tr>';
  } else {
    list.innerHTML = purchases.map((item) => `<tr>
      <td>${escapeHtml(formatDate(item.purchasedAt || item.date || item.createdAt))}</td>
      <td>${escapeHtml(item.item || item.product || item.title || "消費")}</td>
      <td>${escapeHtml(money(item.amount))}</td>
      <td>${escapeHtml(item.note || "—")}</td>
    </tr>`).join("");
  }
}

async function loadPurchases(email) {
  try {
    const snapshot = await getDocs(query(collection(db, "memberPurchases"), where("email", "==", email)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
      const aDate = toDate(a.purchasedAt || a.date || a.createdAt)?.getTime() || 0;
      const bDate = toDate(b.purchasedAt || b.date || b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });
  } catch (error) {
    console.warn("無法載入消費紀錄", error);
    return [];
  }
}

async function loadMember(user) {
  const email = (user.email || "").toLowerCase();
  document.getElementById("member-user").textContent = email;
  const snapshot = await getDoc(doc(db, "memberAccess", email));
  if (!snapshot.exists()) {
    gateStatus.textContent = "此 Gmail 尚未建立會員資料，請聯絡靈元院確認。";
    await signOut(auth);
    return;
  }
  const member = { email, ...snapshot.data() };
  const purchases = await loadPurchases(email);
  renderMember(member, purchases);
  loginGate.classList.add("hidden");
  appEl.classList.remove("hidden");
}

document.getElementById("member-login").addEventListener("click", async () => {
  gateStatus.textContent = "登入中…";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    gateStatus.textContent = "登入未完成，請重新嘗試。";
    console.error(error);
  }
});

document.getElementById("member-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    appEl.classList.add("hidden");
    loginGate.classList.remove("hidden");
    gateStatus.textContent = "";
    return;
  }
  try {
    await loadMember(user);
  } catch (error) {
    gateStatus.textContent = "會員資料載入失敗，請稍後再試。";
    console.error(error);
  }
});