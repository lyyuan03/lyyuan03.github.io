// 2027 丁未年點燈層：閱讀權限的開通與撤銷規則（純計算，不連資料庫、不碰畫面）。
// 管理頁的「手動開通」與日後的訂單自動同步共用這份規則。
//
// memberEntitlements/{gmail} 內本模組負責的欄位：
//   permissions                    既有共用清單；閱讀規則只看這裡（dingwei-2027-{生肖}）
//   zodiacLampManagedPermissions   本模組加入 permissions 的代碼；撤銷時只拿掉這些
//   zodiacLampGrants               每個生肖的開通來源，例如
//                                  { rat: { sources: ["manual", "order:A123"], manualAt, manualBy } }
// 來源：手動開通為 "manual"，日後訂單同步為 "order:{訂單編號}"。
// 一個生肖只要還有任一來源，權限就保留；全部來源撤掉，且權限是本模組加的，才從 permissions 移除。
// 其他欄位（付費會員、活動權限、disabled 等）一律不動。

export const ZODIAC_KEYS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
export const PERMISSION_PREFIX = "dingwei-2027-";
export const MANUAL_SOURCE = "manual";

export const permissionOf = (zodiac) => PERMISSION_PREFIX + zodiac;

// 閱讀規則要求文件 ID 等於登入 Gmail 的小寫，且必須是 @gmail.com。
export function normalizeGmail(input) {
  const email = String(input || "").trim().toLowerCase();
  return /^[^@\s]+@gmail\.com$/.test(email) ? email : null;
}

export function parseGmailList(text) {
  const valid = [], invalid = [];
  for (const raw of String(text || "").split(/[\s,，;；]+/).filter(Boolean)) {
    const email = normalizeGmail(raw);
    if (!email) invalid.push(raw);
    else if (!valid.includes(email)) valid.push(email);
  }
  return { valid, invalid };
}

function checkZodiacs(zodiacs) {
  const list = [...new Set(zodiacs)];
  if (!list.length) throw new Error("請至少選一個生肖");
  for (const z of list) if (!ZODIAC_KEYS.includes(z)) throw new Error(`未知的生肖：${z}`);
  return list;
}

function checkSource(source) {
  if (source !== MANUAL_SOURCE && !/^order:[A-Za-z0-9_-]{1,64}$/.test(source)) throw new Error(`無效的來源：${source}`);
}

const copyGrants = (grants) => Object.fromEntries(
  Object.entries(grants && typeof grants === "object" ? grants : {})
    .map(([z, g]) => [z, { ...g, sources: Array.isArray(g?.sources) ? [...g.sources] : [] }])
);

// existing：目前文件內容（不存在時為 null）。回傳要寫回的三個欄位。
export function applyGrant(existing, zodiacs, source, meta = {}) {
  checkSource(source);
  const list = checkZodiacs(zodiacs);
  const permissions = Array.isArray(existing?.permissions) ? [...existing.permissions] : [];
  const managed = Array.isArray(existing?.zodiacLampManagedPermissions) ? [...existing.zodiacLampManagedPermissions] : [];
  const grants = copyGrants(existing?.zodiacLampGrants);

  for (const z of list) {
    const code = permissionOf(z);
    if (!permissions.includes(code)) {
      permissions.push(code);
      if (!managed.includes(code)) managed.push(code);
    }
    const grant = grants[z] || { sources: [] };
    if (!grant.sources.includes(source)) grant.sources.push(source);
    if (source === MANUAL_SOURCE) {
      if (meta.at) grant.manualAt = meta.at;
      if (meta.by) grant.manualBy = meta.by;
    }
    grants[z] = grant;
  }
  return { permissions, zodiacLampManagedPermissions: managed, zodiacLampGrants: grants };
}

export function applyRevoke(existing, zodiacs, source) {
  checkSource(source);
  const list = checkZodiacs(zodiacs);
  let permissions = Array.isArray(existing?.permissions) ? [...existing.permissions] : [];
  let managed = Array.isArray(existing?.zodiacLampManagedPermissions) ? [...existing.zodiacLampManagedPermissions] : [];
  const grants = copyGrants(existing?.zodiacLampGrants);

  for (const z of list) {
    const code = permissionOf(z);
    const grant = grants[z];
    if (grant) {
      grant.sources = grant.sources.filter((s) => s !== source);
      if (source === MANUAL_SOURCE) { delete grant.manualAt; delete grant.manualBy; }
      if (grant.sources.length) continue;
      delete grants[z];
    }
    // 只移除本模組加入的權限；原本就存在的（例如他處手動加入）保留。
    if (managed.includes(code)) {
      permissions = permissions.filter((p) => p !== code);
      managed = managed.filter((p) => p !== code);
    }
  }
  return { permissions, zodiacLampManagedPermissions: managed, zodiacLampGrants: grants };
}

// 管理頁列表用：這位信眾目前能讀哪些生肖、各自來源。
export function summarize(data) {
  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  const grants = data?.zodiacLampGrants || {};
  return ZODIAC_KEYS
    .filter((z) => permissions.includes(permissionOf(z)))
    .map((z) => ({ zodiac: z, sources: Array.isArray(grants[z]?.sources) && grants[z].sources.length ? grants[z].sources : ["external"] }));
}
