import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const options = [
  ["2026-jinmu-am", "文選① 上午場"],
  ["2026-jinmu-pm", "文選② 下午場"],
  ["2026-jinmu-build-patron", "文選③ 建院總功德主"],
  ["2026-jinmu-build-supporter", "文選④ 建院護持"]
];
let panel;
const normalizedGmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) throw new Error("請輸入有效 Gmail");
  return email;
};

onAuthStateChanged(auth, (user) => {
  if (!isAdminEmail(user?.email)) { panel?.remove(); panel = null; return; }
  if (panel) return;
  panel = document.createElement("section");
  panel.id = "jinmu-permission-manual";
  panel.style.cssText = "margin:24px 0;padding:20px;border:1px solid #ad8e5e;background:#fffaf1;color:#40362d";
  panel.innerHTML = `<h2>丙午金母聖誕｜人工 Gmail 權限</h2>
    <p>一次只處理一個 Gmail。未勾選的活動文章會撤權；其他會員 permissions 保留。</p>
    <label>Gmail <input type="email" autocomplete="off" placeholder="member@gmail.com" style="min-width:280px"></label>
    <button type="button" data-action="load">讀取目前設定</button>
    <div data-options>${options.map(([permission, label]) => `<label style="display:block;margin:9px 0"><input type="checkbox" value="${permission}"> ${label}</label>`).join("")}</div>
    <button type="button" data-action="save" disabled>儲存這一個 Gmail</button>
    <pre style="white-space:pre-wrap" role="status">批次匯入已停用。請先輸入 Gmail 並讀取。</pre>`;
  document.getElementById("admin-app")?.prepend(panel);
  const input = panel.querySelector('input[type="email"]');
  const checks = [...panel.querySelectorAll('input[type="checkbox"]')];
  const load = panel.querySelector('[data-action="load"]');
  const save = panel.querySelector('[data-action="save"]');
  const status = panel.querySelector("pre");
  let loadedEmail = "";

  load.addEventListener("click", async () => {
    save.disabled = true; loadedEmail = "";
    try {
      const email = normalizedGmail(input.value);
      const snapshot = await getDoc(doc(db, "memberEntitlements", email));
      const permissions = snapshot.data()?.permissions || [];
      if (!Array.isArray(permissions)) throw new Error("既有 permissions 格式異常，已停止");
      checks.forEach((check) => { check.checked = permissions.includes(check.value); });
      loadedEmail = email; input.value = email; save.disabled = false;
      status.textContent = snapshot.exists() ? `已讀取 ${email}。勾選後儲存。` : `尚無 ${email} 資料；儲存時會建立。`;
    } catch (error) { status.textContent = `停止：${error.message}`; }
  });

  save.addEventListener("click", async () => {
    if (!loadedEmail || normalizedGmail(input.value) !== loadedEmail || !isAdminEmail(auth.currentUser?.email)) return;
    save.disabled = true; load.disabled = true;
    try {
      const ref = doc(db, "memberEntitlements", loadedEmail);
      const snapshot = await getDoc(ref);
      const before = snapshot.data()?.permissions || [];
      if (!Array.isArray(before)) throw new Error("既有 permissions 格式異常，已停止");
      const selected = checks.filter((check) => check.checked).map((check) => check.value);
      if (selected.includes("2026-jinmu-build-patron") && !selected.includes("2026-jinmu-build-supporter")) selected.push("2026-jinmu-build-supporter");
      const retained = before.filter((permission) => !options.some(([eventPermission]) => eventPermission === permission));
      await setDoc(ref, {
        email: loadedEmail,
        permissions: [...new Set([...retained, ...selected])],
        eventPermissionsSource: "manual-admin",
        eventPermissionsUpdatedAt: serverTimestamp(),
        eventRegistrationName: deleteField(),
        eventRegistrationNameConfirmedAt: deleteField()
      }, { merge: true });
      const actual = (await getDoc(ref)).data()?.permissions || [];
      if (!selected.every((permission) => actual.includes(permission)) || options.some(([permission]) => actual.includes(permission) !== selected.includes(permission))) throw new Error("寫入後驗證不一致");
      checks.forEach((check) => { check.checked = actual.includes(check.value); });
      status.textContent = `完成：${loadedEmail} 已人工設定；可讀 ${selected.length ? selected.map((permission) => options.find(([value]) => value === permission)?.[1]).join("、") : "無"}。`;
    } catch (error) { status.textContent = `未完成：${error.message}`; }
    finally { save.disabled = false; load.disabled = false; }
  });
});
