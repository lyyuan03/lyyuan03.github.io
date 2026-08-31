export const JINMU_PERMISSIONS = Object.freeze([
  "2026-jinmu-am", "2026-jinmu-pm", "2026-jinmu-build-patron", "2026-jinmu-build-supporter"
]);

export function validateJinmuPermissionPlan(plan) {
  if (plan?.schemaVersion !== 1 || !Array.isArray(plan.records)) throw new Error("審核表格式不符");
  const merged = new Map();
  for (const row of plan.records) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email)) throw new Error("匯入檔含非 Gmail 或無效 Email，已停止");
    if (!Array.isArray(row.permissions) || !row.permissions.length
      || row.permissions.some((permission) => !JINMU_PERMISSIONS.includes(permission))) throw new Error("匯入檔含未知 permission");
    if (plan.manualReview?.some((item) => String(item.email || "").trim().toLowerCase() === email)) throw new Error("待確認 Gmail 不得自動寫入");
    if (!merged.has(email)) merged.set(email, new Set());
    row.permissions.forEach((permission) => merged.get(email).add(permission));
  }
  const records = [...merged].map(([email, permissions]) => {
    if (permissions.has(JINMU_PERMISSIONS[2]) && !permissions.has(JINMU_PERMISSIONS[3])) throw new Error("總功德主缺少建院護持 permission");
    return { email, permissions: JINMU_PERMISSIONS.filter((permission) => permissions.has(permission)) };
  });
  const counts = {
    am: records.filter((row) => row.permissions.includes(JINMU_PERMISSIONS[0])).length,
    pm: records.filter((row) => row.permissions.includes(JINMU_PERMISSIONS[1])).length,
    patron: records.filter((row) => row.permissions.includes(JINMU_PERMISSIONS[2])).length,
    supporter: records.filter((row) => row.permissions.includes(JINMU_PERMISSIONS[3])).length,
    both: records.filter((row) => row.permissions.includes(JINMU_PERMISSIONS[0]) && row.permissions.includes(JINMU_PERMISSIONS[1])).length
  };
  for (const [key, count] of Object.entries(counts)) {
    if (Number(plan.stats?.[key]) !== count) throw new Error(`審核統計不一致：${key}`);
  }
  return { records, counts, manualCount: plan.manualReview?.length || 0 };
}
