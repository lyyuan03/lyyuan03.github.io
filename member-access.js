export const MEMBER_LEVELS = {
  wellness: "養生療癒會員",
  lingji: "靈極會員",
  sponsor: "官網付費會員"
};

export function normalizeMemberLevel(value = "") {
  const level = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MEMBER_LEVELS, level) ? level : "sponsor";
}

export function memberLevelLabel(value = "") {
  return MEMBER_LEVELS[normalizeMemberLevel(value)];
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isMemberActive(access = {}, now = new Date()) {
  if (!access || access.status !== "active") return false;
  const expiry = toDate(access.expiresAt);
  return Boolean(expiry && expiry > now);
}
