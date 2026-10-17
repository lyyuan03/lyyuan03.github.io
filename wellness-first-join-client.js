// 養生療癒會員「首次入會月份」（YYYY-MM，台北時間）——後台使用。
// 規則與 functions/wellness-first-join.js 相同：取現有值、歷史備份、推估值中最早者；只往更早修正。
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function dateFromValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isMonth(value) {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function taipeiMonth(value) {
  const date = dateFromValue(value);
  if (!date) return null;
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function fallbackFirstJoinMonth(member = {}) {
  const candidates = [member.firstJoinedAt, member.createdAt, member.startsAt, member.paidAt]
    .map(dateFromValue)
    .filter(Boolean);
  const expiresAt = dateFromValue(member.expiresAt);
  const planMonths = Number(member.planMonths);
  if (expiresAt && Number.isInteger(planMonths) && planMonths > 0 && planMonths <= 60) {
    const start = new Date(expiresAt.getTime());
    start.setUTCMonth(start.getUTCMonth() - planMonths);
    candidates.push(start);
  }
  if (!candidates.length) return null;
  return taipeiMonth(candidates.reduce((min, date) => (date < min ? date : min)));
}

export function earliestMonth(...values) {
  return values.filter(isMonth).sort()[0] || null;
}
