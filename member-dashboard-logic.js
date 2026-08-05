export const LINGJI_THRESHOLD = 100000;

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function annualCycle(value = new Date()) {
  const today = dateKey(value);
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const cycleYear = month >= 2 ? year : year - 1;
  return {
    year: cycleYear,
    start: `${cycleYear}-02-01`,
    end: `${cycleYear + 1}-01-31`,
    nextStart: `${cycleYear + 1}-02-01`,
    nextEnd: `${cycleYear + 2}-01-31`
  };
}

function cycleYearFromValue(value) {
  const key = dateKey(value);
  if (!key) return null;
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  return Number(monthText) >= 2 ? year : year - 1;
}

function isWithin(today, startsAt, expiresAt) {
  const start = dateKey(startsAt);
  const end = dateKey(expiresAt);
  return Boolean(start && end && today >= start && today <= end);
}

export function storedLevel(member = {}) {
  return member.memberLevel === "lingji" || member.wellnessLevel === "lingji" || member.wellnessLevel === "wellness-premium"
    ? "lingji"
    : "wellness";
}

export function evaluateMember(member = {}, value = new Date()) {
  const today = dateKey(value);
  const cycle = annualCycle(value);
  const recordedCycleYear = cycleYearFromValue(member.annualSpendCycleStart);
  const updatedCycleYear = cycleYearFromValue(member.annualSpendUpdatedAt || member.updatedAt);
  const effectiveSpendCycleYear = recordedCycleYear ?? updatedCycleYear;
  const recordedSpend = numberOrZero(member.annualSpend);
  const currentSpend = effectiveSpendCycleYear === cycle.year ? recordedSpend : 0;
  const nextQualified = currentSpend >= LINGJI_THRESHOLD;
  const remaining = Math.max(0, LINGJI_THRESHOLD - currentSpend);
  const progress = Math.min(100, currentSpend / LINGJI_THRESHOLD * 100);

  const qualificationCycleYear = recordedCycleYear ?? effectiveSpendCycleYear;
  const recordedQualificationStart = qualificationCycleYear === null ? "" : `${qualificationCycleYear + 1}-02-01`;
  const recordedQualificationEnd = qualificationCycleYear === null ? "" : `${qualificationCycleYear + 2}-01-31`;
  const autoLingjiActive = recordedSpend >= LINGJI_THRESHOLD
    && isWithin(today, recordedQualificationStart, recordedQualificationEnd);
  const explicitLingjiActive = storedLevel(member) === "lingji"
    && isWithin(today, member.lingjiValidFrom, member.lingjiValidUntil);
  const legacyLingjiActive = storedLevel(member) === "lingji"
    && !dateKey(member.lingjiValidFrom)
    && !dateKey(member.lingjiValidUntil);
  const effectiveLevel = autoLingjiActive || explicitLingjiActive || legacyLingjiActive ? "lingji" : "wellness";

  const lingjiStartsAt = autoLingjiActive
    ? recordedQualificationStart
    : explicitLingjiActive
      ? dateKey(member.lingjiValidFrom)
      : effectiveLevel === "lingji" ? cycle.start : "";
  const lingjiExpiresAt = autoLingjiActive
    ? recordedQualificationEnd
    : explicitLingjiActive
      ? dateKey(member.lingjiValidUntil)
      : effectiveLevel === "lingji" ? cycle.end : "";

  return {
    today,
    cycle,
    currentSpend,
    remaining,
    progress,
    nextQualified,
    effectiveLevel,
    lingjiStartsAt,
    lingjiExpiresAt
  };
}
