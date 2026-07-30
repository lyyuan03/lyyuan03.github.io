import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ARTICLE_ACCESS_THRESHOLD = 15000;
const FULL_ORDER_REWARD = 1000;
const form = document.getElementById("member-purchase-form");
const statusEl = document.getElementById("purchase-admin-status");

function emailValue() {
  return (document.getElementById("purchase-email")?.value || "").trim().toLowerCase();
}

function numberValue(id) {
  return Number(document.getElementById(id)?.value || 0);
}

async function savePurchase(event) {
  event.preventDefault();
  const email = emailValue();
  const amount = numberValue("purchase-amount");
  const enteredReward = numberValue("purchase-reward");
  const qualifiesForFullOrder = amount >= ARTICLE_ACCESS_THRESHOLD;
  const reward = qualifiesForFullOrder && enteredReward <= 0 ? FULL_ORDER_REWARD : enteredReward;
  if (!email || amount <= 0) return;

  const memberRef = doc(db, "memberAccess", email);
  const snapshot = await getDoc(memberRef);
  if (!snapshot.exists()) {
    statusEl.textContent = "找不到此 Gmail 的會員資料";
    return;
  }

  await addDoc(collection(db, "memberPurchases"), {
    email,
    item: document.getElementById("purchase-item").value.trim() || "消費",
    amount,
    reward,
    articleAccessGranted: qualifiesForFullOrder,
    rewardUsableFromNextPurchase: reward > 0,
    note: document.getElementById("purchase-note").value.trim(),
    purchasedAt: document.getElementById("purchase-date").value
      ? new Date(`${document.getElementById("purchase-date").value}T12:00:00+08:00`).toISOString()
      : new Date().toISOString(),
    createdAt: serverTimestamp()
  });

  const memberUpdate = {
    totalSpend: increment(amount),
    rewardBalance: increment(reward),
    updatedAt: serverTimestamp()
  };
  if (qualifiesForFullOrder) {
    memberUpdate.articleAccess = true;
    memberUpdate.articleAccessSource = "single-purchase-15000";
    memberUpdate.articleAccessGrantedAt = new Date().toISOString();
  }

  await setDoc(memberRef, memberUpdate, { merge: true });

  const messages = [`已新增 NT$${amount.toLocaleString("zh-TW")} 消費`];
  if (reward) messages.push(`增加 NT$${reward.toLocaleString("zh-TW")} 回饋金（下次消費使用）`);
  if (qualifiesForFullOrder) messages.push("已自動開通付費文章閱讀權限");
  statusEl.textContent = messages.join("，");
  form.reset();
  document.getElementById("purchase-date").valueAsDate = new Date();
}

async function adjustMember(event) {
  event.preventDefault();
  const email = (document.getElementById("adjust-email").value || "").trim().toLowerCase();
  if (!email) return;
  const memberRef = doc(db, "memberAccess", email);
  const snapshot = await getDoc(memberRef);
  if (!snapshot.exists()) {
    statusEl.textContent = "找不到此 Gmail 的會員資料";
    return;
  }
  await setDoc(memberRef, {
    totalSpend: numberValue("adjust-total-spend"),
    rewardBalance: numberValue("adjust-reward-balance"),
    updatedAt: serverTimestamp()
  }, { merge: true });
  statusEl.textContent = "會員累積消費與回饋金已調整";
}

async function lookupMember() {
  const email = (document.getElementById("adjust-email").value || "").trim().toLowerCase();
  if (!email) return;
  const snapshot = await getDoc(doc(db, "memberAccess", email));
  if (!snapshot.exists()) {
    statusEl.textContent = "找不到此 Gmail 的會員資料";
    return;
  }
  const data = snapshot.data();
  document.getElementById("adjust-total-spend").value = Number(data.totalSpend || 0);
  document.getElementById("adjust-reward-balance").value = Number(data.rewardBalance || 0);
  statusEl.textContent = `${data.name || email} 的資料已載入`;
}

if (form) form.addEventListener("submit", savePurchase);
document.getElementById("member-adjust-form")?.addEventListener("submit", adjustMember);
document.getElementById("adjust-load")?.addEventListener("click", lookupMember);

onAuthStateChanged(auth, (user) => {
  const allowed = user && isAdminEmail(user.email);
  document.getElementById("purchase-admin-section")?.classList.toggle("hidden", !allowed);
});