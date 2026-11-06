import { auth, db, isAdminEmail } from "/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, collection, query, where, getDocsFromServer, runTransaction,
  arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PERMISSION = "male-yoga-beginner";
const dialog = document.getElementById("course-admin-dialog");
const openButton = document.querySelector("[data-course-admin-open]");
const contentLink = document.querySelector("[data-course-admin-content]");
const form = dialog.querySelector("[data-course-admin-form]");
const emailsInput = dialog.querySelector("#course-admin-emails");
const message = dialog.querySelector("[data-course-admin-status]");
const listStatus = dialog.querySelector("[data-course-admin-list-status]");
const list = dialog.querySelector("[data-course-admin-list]");
let session = 0;
let listRequest = 0;
let busy = false;

const isAdmin = () => Boolean(auth.currentUser?.emailVerified && isAdminEmail(auth.currentUser.email));
const sameSession = (version) => version === session && isAdmin();

function status(element, text = "", kind = "") {
  element.textContent = text;
  element.dataset.kind = kind;
}

function setBusy(value) {
  busy = value;
  form.querySelector("button[type=submit]").disabled = value;
  emailsInput.disabled = value;
  dialog.querySelector("[data-course-admin-refresh]").disabled = value;
  list.querySelectorAll("button").forEach((button) => { button.disabled = value; });
}

function errorText(error) {
  if (error?.code === "permission-denied") return "沒有管理權限，請以靈元院管理帳號重新登入。";
  if (error?.code === "unavailable") return "網路暫時無法連線，請確認連線後再試一次。";
  return error?.message || "操作未完成，請稍後再試。";
}

function parseEmails(raw) {
  const items = [...new Set(raw.split(/[\s,，;；]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const invalid = items.filter((email) => !/^[a-z0-9][a-z0-9.+]*@gmail\.com$/.test(email));
  if (invalid.length) throw new Error(`請修正以下 Gmail：\n${invalid.join("\n")}`);
  if (!items.length) throw new Error("請先輸入學員 Gmail。");
  if (items.length > 100) throw new Error("一次最多開通 100 位，請分批送出。");
  return items;
}

async function refreshList() {
  if (!isAdmin() || !dialog.open) return;
  const version = session;
  const request = ++listRequest;
  list.replaceChildren();
  status(listStatus, "正在讀取已開通學員…");
  try {
    const snapshot = await getDocsFromServer(query(collection(db, "memberEntitlements"), where("permissions", "array-contains", PERMISSION)));
    if (!sameSession(version) || request !== listRequest || !dialog.open) return;
    const students = snapshot.docs.slice().sort((a, b) => a.id.localeCompare(b.id));
    students.forEach((student) => {
      const row = document.createElement("li");
      const email = document.createElement("span");
      email.className = "course-admin-email";
      email.textContent = student.id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "course-admin-remove";
      remove.textContent = "取消權限";
      remove.setAttribute("aria-label", `取消 ${student.id} 的初階觀看權限`);
      remove.disabled = busy;
      remove.addEventListener("click", () => revoke(student.id));
      row.append(email, remove);
      list.append(row);
    });
    status(listStatus, students.length ? `共 ${students.length} 位` : "目前尚未開通任何學員。");
  } catch (error) {
    if (sameSession(version) && request === listRequest && dialog.open) status(listStatus, `名單讀取失敗：${errorText(error)}`, "error");
  }
}

openButton.addEventListener("click", () => {
  if (!isAdmin()) return;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("[data-course-admin-account]").textContent = `管理帳號：${auth.currentUser.email}`;
  emailsInput.focus();
  refreshList();
});
dialog.querySelector("[data-course-admin-close]").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  ++listRequest;
  list.replaceChildren();
  status(listStatus);
});
dialog.querySelector("[data-course-admin-refresh]").addEventListener("click", refreshList);
dialog.querySelector("[data-course-admin-sign-out]").addEventListener("click", async () => {
  if (!isAdmin() || busy) return;
  try { await signOut(auth); }
  catch (error) { status(message, `登出失敗：${errorText(error)}`, "error"); }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin() || busy) return;
  const version = session;
  let emails;
  try { emails = parseEmails(emailsInput.value); }
  catch (error) { status(message, error.message, "error"); return; }
  setBusy(true);
  status(message, `正在開通 ${emails.length} 位學員…`);
  try {
    // 交易會重新讀取最新狀態，並以 arrayUnion 保留其他課程及會員權限。
    await runTransaction(db, async (transaction) => {
      if (!sameSession(version)) throw new Error("登入帳號已變更，請重新操作。");
      const refs = emails.map((email) => doc(db, "memberEntitlements", email));
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
      if (!sameSession(version)) throw new Error("登入帳號已變更，請重新操作。");
      snapshots.forEach((snapshot, index) => {
        const record = snapshot.exists() ? snapshot.data() : {};
        if (record.disabled === true || record.suspended === true || record.status === "disabled") {
          throw new Error(`${emails[index]} 的帳號目前停用中，請先至全站管理後台確認。此次尚未開通任何學員。`);
        }
      });
      snapshots.forEach((snapshot, index) => {
        transaction.set(refs[index], {
          email: emails[index],
          permissions: arrayUnion(PERMISSION),
          ...(!snapshot.exists() ? { schemaVersion: 1, status: "active", eventPermissionsSource: "male-yoga-beginner-admin" } : {}),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
    });
    if (!sameSession(version)) return;
    status(message, `已開通 ${emails.length} 位：\n${emails.join("\n")}\n學員使用上述 Gmail 登入後，即可依資格閱讀已發布的限定內容。`, "success");
    emailsInput.value = "";
    await refreshList();
  } catch (error) {
    if (sameSession(version)) status(message, `開通失敗：${errorText(error)}`, "error");
  } finally {
    if (sameSession(version)) setBusy(false);
  }
});

async function revoke(email) {
  if (!isAdmin() || busy || !window.confirm(`確定取消 ${email} 的初階限定內容觀看權限？`)) return;
  const version = session;
  setBusy(true);
  status(message, "正在取消觀看權限…");
  try {
    await runTransaction(db, async (transaction) => {
      if (!sameSession(version)) throw new Error("登入帳號已變更，請重新操作。");
      const ref = doc(db, "memberEntitlements", email);
      const snapshot = await transaction.get(ref);
      if (!sameSession(version)) throw new Error("登入帳號已變更，請重新操作。");
      if (snapshot.exists()) transaction.update(ref, { permissions: arrayRemove(PERMISSION), updatedAt: serverTimestamp() });
    });
    if (!sameSession(version)) return;
    status(message, `已取消 ${email} 的初階觀看權限。`, "success");
    await refreshList();
  } catch (error) {
    if (sameSession(version)) status(message, `取消失敗：${errorText(error)}`, "error");
  } finally {
    if (sameSession(version)) setBusy(false);
  }
}

onAuthStateChanged(auth, () => {
  ++session;
  ++listRequest;
  const admin = isAdmin();
  openButton.hidden = !admin;
  contentLink.hidden = !admin;
  // 帳號切換時清除名單、輸入與訊息，避免非管理員看到前一個帳號的資料。
  if (dialog.open) dialog.close();
  list.replaceChildren();
  emailsInput.value = "";
  dialog.querySelector("[data-course-admin-account]").textContent = "";
  status(message);
  status(listStatus);
  setBusy(false);
});
