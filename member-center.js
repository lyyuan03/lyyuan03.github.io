import { auth, db, provider } from "./firebase-config.js";
import { memberLevelLabel, normalizeMemberLevel, toDate } from "./member-access.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FULL_ORDER_TARGET = 15000;
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

function activeMembership(member) {
  const expiry = toDate(member.expiresAt);
  return member.status === "active" && expiry && expiry > new Date();
}

function hasArticleAccess(member) {
  const level = normalizeMemberLevel(member.memberLevel);
  return activeMembership(member) && (level === "lingji" || member.articleAccess === true);
}

function levelBenefits(member) {
  const level = normalizeMemberLevel(member.memberLevel);
  const lingji = level === "lingji";
  const active = activeMembership(member);
  const articleOpen = hasArticleAccess(member);
  return [
    [active ? "✓" : "鎖", "一般會員影片", active ? "依首次加入日與會員期限觀看符合資格的影片" : "會員資格已到期，影片目前鎖定"],
    [lingji && active ? "✓" : "鎖", "靈極會員影片", lingji && active ? "已解鎖靈極會員專屬影片" : "僅限有效的靈極會員"],
    [articleOpen ? "✓" : "鎖", "付費文章", articleOpen ? "付費文章閱讀權限已開啟" : "一般會員單筆滿 NT$15,000 後可開通"],
    ["禮", "滿額回饋", "單筆消費滿 NT$15,000，回饋 NT$1,000，限下次消費使用"]
  ];
}

function renderBenefits(member) {
  document.getElementById("benefit-list").innerHTML = levelBenefits(member).map(([icon, title, text]) => `
    <div class="benefit"><span class="icon">${escapeHtml(icon)}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div></div>
  `).join("");
}

function setAccessStatus(id, open, openLabel, lockedLabel) {
  const element = document.getElementById(id);
  element.textContent = open ? openLabel : lockedLabel;
  element.classList.toggle("status-open", open);
  element.classList.toggle("status-locked", !open);
}

function renderMember(member, purchases) {
  const level = normalizeMemberLevel(member.memberLevel);
  const totalSpend = Number(member.totalSpend ?? purchases.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const rewardBalance = Number(member.rewardBalance || 0);
  const remaining = Math.max(0, FULL_ORDER_TARGET - totalSpend);
  const progress = Math.min(100, totalSpend / FULL_ORDER_TARGET * 100);
  const active = activeMembership(member);
  const articleOpen = hasArticleAccess(member);

  document.getElementById("member-name").textContent = member.name || "會員您好";
  document.getElementById("member-level").textContent = memberLevelLabel(level);
  document.getElementById("member-expiry").textContent = `到期日｜${formatDate(member.expiresAt)}`;
  document.getElementById("total-spend").textContent = money(totalSpend);
  document.getElementById("reward-balance").textContent = money(rewardBalance);
  setAccessStatus("video-access", active, "已開放", "已鎖定");
  setAccessStatus("article-access", articleOpen, "已開放", "未開放");
  document.getElementById("progress-current").textContent = money(totalSpend);
  document.getElementById("progress-bar").style.width = `${progress}%`;
  document.getElementById("progress-ratio").textContent = `${totalSpend.toLocaleString("zh-TW")} / ${FULL_ORDER_TARGET.toLocaleString("zh-TW")}`;
  document.getElementById("progress-remaining").textContent = remaining
    ? `距離滿額權益尚差 ${money(remaining)}`
    : "已達 NT$15,000 累積顯示門檻；文章權限仍依單筆滿額或後台設定";
  document.getElementById("level-note").textContent = !active
    ? "會員資格目前已到期；影片、付費文章與回饋金使用權限均暫停。"
    : articleOpen
      ? "您的影片與付費文章權限皆已開啟。"
      : "您可以觀看符合資格的會員影片；付費文章目前尚未開通。";
  renderBenefits(member);

  const list = document.getElementById("purchase-list");
  if (!purchases.length) {
    list.innerHTML = '<tr><td colspan="4" class="empty">目前尚無消費紀錄</td></tr>';
  } else {
    list.innerHTML = purchases.map((item) => `<tr>
      <td>${escapeHtml(formatDate(item.purchasedAt || item.date || item.createdAt))}</td>
      <td>${escapeHtml(item.item || item.product || item.title || "消費")}</td>
      <td>${escapeHtml(money(item.amount))}</td>
      <td>${escapeHtml(item.note || (item.articleAccessGranted ? "本次已開通付費文章" : "—"))}</td>
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