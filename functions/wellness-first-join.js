"use strict";

// 養生療癒會員影片觀看範圍：只能觀看「首次入會月份（台北時間）1 日起」發布的影片。
// 首次入會月份以 "YYYY-MM" 字串保存於 memberAccess/{email}.wellnessFirstJoinMonth，
// 並備份於 membershipHistory/{email}.wellnessFirstJoinMonth；只會往更早修正，續會／重新入會不會延後。

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function dateFromValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isMonth(value) {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

// 以台北時間（UTC+8）換算年月。
function taipeiMonth(value) {
  const date = dateFromValue(value);
  if (!date) return null;
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function subtractMonths(date, months) {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

// 尚無 wellnessFirstJoinMonth 的既有會員：取下列時間中最早者的月份。
// firstJoinedAt、createdAt、startsAt、paidAt（annualSpendCycleStart 屬年度週期，不計入），
// 以及「到期日 − 方案月數」（推估本期開始）。
function fallbackFirstJoinMonth(member = {}) {
  const candidates = [member.firstJoinedAt, member.createdAt, member.startsAt, member.paidAt]
    .map(dateFromValue)
    .filter(Boolean);
  const expiresAt = dateFromValue(member.expiresAt);
  const planMonths = Number(member.planMonths);
  if (expiresAt && Number.isInteger(planMonths) && planMonths > 0 && planMonths <= 60) {
    candidates.push(subtractMonths(expiresAt, planMonths));
  }
  if (!candidates.length) return null;
  const earliest = candidates.reduce((min, date) => (date < min ? date : min));
  return taipeiMonth(earliest);
}

function earliestMonth(...values) {
  const months = values.filter(isMonth).sort();
  return months[0] || null;
}

function resolveFirstJoinMonth(member = {}, history = {}) {
  return earliestMonth(
    member.wellnessFirstJoinMonth,
    history.wellnessFirstJoinMonth,
    fallbackFirstJoinMonth(member)
  );
}

// 影片發布月份：publishedMonth 優先；否則由 publishedAt（"YYYY-MM-DDT00:00:00+08:00" 或 Timestamp）換算。
function videoPublishedMonth(video = {}) {
  if (isMonth(video.publishedMonth)) return video.publishedMonth;
  if (typeof video.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(video.publishedAt)) {
    const local = video.publishedAt.slice(0, 7);
    if (/[+]08:00$/.test(video.publishedAt) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(video.publishedAt)) return isMonth(local) ? local : null;
  }
  return taipeiMonth(video.publishedAt);
}

function videoVisibleForMonth(video = {}, firstJoinMonth) {
  const month = videoPublishedMonth(video);
  return Boolean(isMonth(firstJoinMonth) && month && month >= firstJoinMonth);
}

module.exports = {
  isMonth,
  taipeiMonth,
  fallbackFirstJoinMonth,
  earliestMonth,
  resolveFirstJoinMonth,
  videoPublishedMonth,
  videoVisibleForMonth
};
