"use strict";

// 付費文章閱讀範圍（2026-10-01 起生效）
// 會員只能閱讀「開通日前 30 天起」發表的付費文章；資格到期或取消後一律不能閱讀。
// 連續續約不會重設起算日；資格中斷後重新加入，起算日改為重新開通當天。
// 規則生效前已在期間內的舊會員（沒有 articleWindowStartsAt，且 startsAt 早於生效日）
// 本期到期前維持可閱讀全部付費文章，續約或重新加入後才套用新規則。

const ARTICLE_WINDOW_POLICY = "join-minus-30d-v1";
const ARTICLE_WINDOW_LOOKBACK_DAYS = 30;
const ARTICLE_WINDOW_EFFECTIVE_AT = new Date("2026-09-30T16:00:00.000Z"); // 2026-10-01 00:00 臺北時間
const DAY_MS = 24 * 60 * 60 * 1000;
const SPONSOR_PLAN_DAYS = Object.freeze({ 1: 30, 3: 90 });
const UNRESTRICTED_WINDOW_START = new Date(0);

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
  return anchor ? addDays(anchor, -ARTICLE_WINDOW_LOOKBACK_DAYS) : UNRESTRICTED_WINDOW_START;
}

// 付款或後台開通時使用：仍在有效期間內續約就沿用原起算日，否則以今天重新起算。
// 舊會員續約時一律改用今天起算，從此套用新規則。
function nextArticleWindowAnchor(member = {}, now = new Date()) {
  const expiresAt = dateFromValue(member.expiresAt);
  const stillActive = member.status === "active" && expiresAt && expiresAt > now;
  const anchor = stillActive ? articleWindowAnchor(member) : null;
  return anchor || now;
}

module.exports = {
  ARTICLE_WINDOW_POLICY,
  ARTICLE_WINDOW_LOOKBACK_DAYS,
  ARTICLE_WINDOW_EFFECTIVE_AT,
  SPONSOR_PLAN_DAYS,
  UNRESTRICTED_WINDOW_START,
  addDays,
  sponsorPlanDays,
  articleWindowAnchor,
  articleWindowStart,
  nextArticleWindowAnchor
};
