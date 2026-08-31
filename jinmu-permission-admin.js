import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { arrayUnion, doc, getDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { validateJinmuPermissionPlan } from "./jinmu-permission-plan.js?v=20260831-permissions-1";

let panel;
onAuthStateChanged(auth, (user) => {
  if (!isAdminEmail(user?.email)) { panel?.remove(); panel = null; return; }
  if (panel) return;
  panel = document.createElement("section");
  panel.id = "jinmu-permission-import";
  panel.style.cssText = "margin:24px 0;padding:20px;border:1px solid #ad8e5e;background:#fffaf1;color:#40362d";
  panel.innerHTML = '<h2>丙午金母聖誕｜Gmail 活動權限</h2><p>選擇已完成稽核的 JSON。僅接受 Gmail；同 Email 權限合併，保留全部既有會員、贊助與養生資格。</p><input type="file" accept=".json,application/json" aria-label="Gmail 權限審核 JSON"><pre style="white-space:pre-wrap" role="status">尚未載入審核檔</pre><button type="button" disabled>確認合併寫入 Gmail permissions</button>';
  document.getElementById("admin-app")?.prepend(panel);
  const fileInput = panel.querySelector("input");
  const status = panel.querySelector("pre");
  const button = panel.querySelector("button");
  let prepared;
  fileInput.addEventListener("change", async () => {
    button.disabled = true; prepared = null;
    try {
      prepared = validateJinmuPermissionPlan(JSON.parse(await fileInput.files[0].text()));
      const c = prepared.counts;
      status.textContent = `待寫入 Gmail：${prepared.records.length}\n上午 ${c.am}｜下午 ${c.pm}｜兩場 ${c.both}\n總功德主 ${c.patron}｜建院護持 ${c.supporter}\n待人工確認 ${prepared.manualCount} 個（不寫入）\n尚未變更後端資料。`;
      button.disabled = false;
    } catch (error) { status.textContent = `停止：${error.message}`; }
  });
  button.addEventListener("click", async () => {
    if (!prepared || !isAdminEmail(auth.currentUser?.email)) return;
    button.disabled = true; fileInput.disabled = true;
    try {
      const before = await Promise.all(prepared.records.map((row) => getDoc(doc(db, "memberEntitlements", row.email))));
      const batch = writeBatch(db);
      prepared.records.forEach((row) => batch.set(doc(db, "memberEntitlements", row.email), {
        email: row.email,
        permissions: arrayUnion(...row.permissions),
        eventPermissionsUpdatedAt: serverTimestamp(),
        eventPermissionsSource: "2026-jinmu-gmail-excel-audit"
      }, { merge: true }));
      await batch.commit();
      const after = await Promise.all(prepared.records.map((row) => getDoc(doc(db, "memberEntitlements", row.email))));
      after.forEach((snapshot, index) => {
        const expected = [...(before[index].data()?.permissions || []), ...prepared.records[index].permissions];
        if (!expected.every((permission) => snapshot.data()?.permissions?.includes(permission))) throw new Error("寫入後驗證不一致");
      });
      status.textContent = `完成：${after.length} 個 Gmail 權限已合併並逐筆讀回驗證。既有 permissions 全部保留。`;
      panel.dataset.importState = "verified";
    } catch (error) {
      status.textContent = `未完成：${error.message}。可重新載入同一審核檔重試，arrayUnion 不會重複或覆蓋權限。`;
    } finally { fileInput.disabled = false; }
  });
});
