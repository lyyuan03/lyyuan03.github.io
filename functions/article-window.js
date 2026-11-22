"use strict";

// 付費文章閱讀範圍（2026-10-01 起生效）
// 會員只能閱讀「起算日前 30 天起」發表的付費文章；資格到期或取消後一律不能閱讀。
// 連續續約不會重設起算日。到期後 7 天內重新付費視同連續（寬限期，沿用原起算日）；
// 超過 7 天才重新加入，起算日改為重新開通當天。
// 規則生效前已在期間內的舊會員（沒有 articleWindowStartsAt，且 startsAt 早於生效日）
// 只要沒有中斷（含 7 天寬限）就維持可閱讀全部付費文章，以 1970-01-01 起算日明確標記；
// 中斷超過 7 天後重新加入，才與新會員相同重新起算。

const ARTICLE_WINDOW_POLICY = "join-minus-30d-v1";
const ARTICLE_WINDOW_LOOKBACK_DAYS = 30;
const ARTICLE_WINDOW_EFFECTIVE_AT = new Date("2026-09-30T16:00:00.000Z"); // 2026-10-01 00:00 臺北時間
const ARTICLE_WINDOW_GRACE_DAYS = 7; // 到期後 7 天內重新付費，沿用原起算日
const DAY_MS = 24 * 60 * 60 * 1000;
const SPONSOR_PLAN_DAYS = Object.freeze({ 1: 30, 3: 90 });
const UNRESTRICTED_WINDOW_START = new Date(0);
// 舊會員「不受限制」的起算日標記（寫入 articleWindowStartsAt）。續約時沿用，中斷超過寬限期才被新起算日取代。
const LEGACY_UNRESTRICTED_ANCHOR = new Date(0);

function dateFromValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  return new Date(new Date(date).getTime() + Number(days) * DAY_MS);
}

function sponsorPlanDays(months) {
  return SPONSOR_PLAN_DAYS[Number(months)] || null;
}

// 本期連續會員資格的起算日；null 代表規則生效前的舊會員（本期不受限制）。
function articleWindowAnchor(record = {}) {
  const explicit = dateFromValue(record.articleWindowStartsAt);
  if (explicit) return explicit;
  const startsAt = dateFromValue(record.startsAt);
  if (startsAt && startsAt >= ARTICLE_WINDOW_EFFECTIVE_AT) return startsAt;
  return null;
}

// 可閱讀的最早發表時間；舊會員回傳 1970-01-01（不受限制）。
function articleWindowStart(record = {}) {
  const anchor = articleWindowAnchor(record);
  if (!anchor || anchor.getTime() <= 0) return UNRESTRICTED_WINDOW_START;
  return addDays(anchor, -ARTICLE_WINDOW_LOOKBACK_DAYS);
}

// 付款或後台開通時使用：
// - 仍在有效期間內，或到期後 7 天內重新付費：視同連續，沿用原起算日。
// - 舊會員（沒有起算日、規則生效前加入）連續時回傳 1970-01-01 標記，持續不受限制。
// - 超過寬限期、被停權或撤銷：以今天重新起算。
function isContinuousMembership(member = {}, now = new Date()) {
  const expiresAt = dateFromValue(member.expiresAt);
  return Boolean(
    member.status === "active"
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && expiresAt
    && addDays(expiresAt, ARTICLE_WINDOW_GRACE_DAYS) >= now
  );
}

function nextArticleWindowAnchor(member = {}, now = new Date()) {
  if (!isContinuousMembership(member, now)) return now;
  return articleWindowAnchor(member) || LEGACY_UNRESTRICTED_ANCHOR;
}

module.exports = {
  ARTICLE_WINDOW_POLICY,
  ARTICLE_WINDOW_LOOKBACK_DAYS,
  ARTICLE_WINDOW_GRACE_DAYS,
  ARTICLE_WINDOW_EFFECTIVE_AT,
  LEGACY_UNRESTRICTED_ANCHOR,
  SPONSOR_PLAN_DAYS,
  UNRESTRICTED_WINDOW_START,
  addDays,
  sponsorPlanDays,
  articleWindowAnchor,
  articleWindowStart,
  isContinuousMembership,
  nextArticleWindowAnchor
};
