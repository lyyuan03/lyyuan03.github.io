"use strict";

const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const PRIVATE_COLLECTION = "paidArticleBodies";
const MAX_PRIVATE_BODY_BYTES = 900000;

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function notRevoked(record = {}) {
  return record.disabled !== true
    && record.suspended !== true
    && !record.revokedAt;
}

function validWindow(record = {}, now = new Date()) {
  const startsAt = dateValue(record.startsAt || record.firstJoinedAt);
  const expiresAt = dateValue(record.expiresAt);
  if (startsAt && startsAt > now) return false;
  return Boolean(expiresAt && expiresAt > now);
}

function hasDirectSponsorAccess(record, email, now) {
  if (!record || record.memberType !== "sponsor-member") return false;
  if (normalizeEmail(record.email) !== email) return false;
  if (record.status !== "active" || record.paymentStatus !== "paid") return false;
  if (record.articleAccess !== true || record.accessScope !== "sponsor-paid-articles") return false;
  if (Number(record.accessVersion || 0) < 2) return false;
  if (!notRevoked(record) || !validWindow(record, now)) return false;
  return true;
}

function hasWellnessArticleAccess(sponsorRecord, memberRecord, email, now) {
  const benefit = sponsorRecord?.wellnessBenefit;
  if (!benefit || benefit.active !== true || benefit.articleAccess !== true) return false;
  if (benefit.status !== "active" || benefit.accessScope !== "sponsor-paid-articles") return false;
  if (Number(benefit.accessVersion || 0) < 1) return false;
  if (normalizeEmail(sponsorRecord?.email) !== email) return false;
  if (!memberRecord || normalizeEmail(memberRecord.email) !== email) return false;
  if (memberRecord.memberType !== "wellness-channel" || memberRecord.wellnessAccess !== true) return false;
  if (!["wellness", "lingji"].includes(memberRecord.memberLevel)) return false;
  if (memberRecord.status !== "active" || memberRecord.paymentStatus !== "paid") return false;
  if (!notRevoked(memberRecord) || !validWindow(memberRecord, now)) return false;

  const benefitStart = dateValue(benefit.startsAt);
  const benefitExpiry = dateValue(benefit.expiresAt);
  const memberExpiry = dateValue(memberRecord.expiresAt);
  if (benefitStart && benefitStart > now) return false;
  if (!benefitExpiry || benefitExpiry <= now || !memberExpiry || memberExpiry <= now) return false;
  if (benefitExpiry.getTime() > memberExpiry.getTime() + 60000) return false;
  if (benefit.linkedMemberLevel && benefit.linkedMemberLevel !== memberRecord.memberLevel) return false;

  if (benefit.source === "lingji-member") return memberRecord.memberLevel === "lingji";
  if (benefit.source === "single-purchase-15000") {
    return Number(benefit.qualifyingPurchaseAmount || 0) >= 15000
      && Boolean(String(benefit.confirmedBy || "").trim())
      && Boolean(dateValue(benefit.confirmedAt));
  }
  return false;
}

async function hasPaidArticleAccess(email) {
  if (ADMIN_EMAILS.has(email)) return true;
  const [sponsorSnapshot, memberSnapshot] = await Promise.all([
    db.doc(`sponsorMemberAccess/${email}`).get(),
    db.doc(`memberAccess/${email}`).get()
  ]);
  const sponsorRecord = sponsorSnapshot.exists ? sponsorSnapshot.data() || {} : null;
  const memberRecord = memberSnapshot.exists ? memberSnapshot.data() || {} : null;
  const now = new Date();
  return hasDirectSponsorAccess(sponsorRecord, email, now)
    || hasWellnessArticleAccess(sponsorRecord, memberRecord, email, now);
}

function cleanArticleId(value = "") {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(id) ? id : "";
}

function cleanTitle(value = "") {
  return String(value || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, 240);
}

function hashContent(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function requireAdmin(request) {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth || !ADMIN_EMAILS.has(email)) {
    throw new HttpsError("permission-denied", "僅限靈元院管理員維護付費文章正文。");
  }
  if (request.auth.token.email_verified === false) {
    throw new HttpsError("failed-precondition", "請先完成 Email 驗證。");
  }
  return email;
}

exports.getPaidArticleBody = onCall(
  {
    region: REGION,
    enforceAppCheck: false
  },
  async (request) => {
    const email = normalizeEmail(request.auth?.token?.email);
    if (!request.auth || !email || !email.includes("@")) {
      throw new HttpsError("unauthenticated", "請先使用具有文章閱讀資格的 Gmail 登入。");
    }
    if (request.auth.token.email_verified === false) {
      throw new HttpsError("failed-precondition", "請先完成 Email 驗證。");
    }

    const articleId = cleanArticleId(request.data?.articleId);
    if (!articleId) throw new HttpsError("invalid-argument", "文章識別碼不正確。");

    if (!await hasPaidArticleAccess(email)) {
      throw new HttpsError("permission-denied", "目前帳號沒有贊助專屬文章閱讀資格。");
    }

    const bodySnapshot = await db.doc(`${PRIVATE_COLLECTION}/${articleId}`).get();
    if (!bodySnapshot.exists) {
      throw new HttpsError("not-found", "此文章的付費正文尚未完成安全移轉。");
    }
    const body = bodySnapshot.data() || {};
    if (body.active === false || !String(body.content || "").trim()) {
      throw new HttpsError("not-found", "此文章目前沒有可讀取的付費正文。");
    }
    if (!ADMIN_EMAILS.has(email) && body.status && body.status !== "published") {
      throw new HttpsError("permission-denied", "此文章目前尚未公開發布。");
    }

    return {
      articleId,
      content: String(body.content || ""),
      contentVersion: Math.max(1, Number(body.contentVersion || 1))
    };
  }
);

exports.savePaidArticleBodyAdmin = onCall(
  {
    region: REGION,
    enforceAppCheck: false
  },
  async (request) => {
    const adminEmail = requireAdmin(request);
    const articleId = cleanArticleId(request.data?.articleId);
    const title = cleanTitle(request.data?.title);
    const status = request.data?.status === "draft" ? "draft" : "published";
    const content = String(request.data?.content || "").trim();

    if (!articleId) throw new HttpsError("invalid-argument", "文章識別碼不正確。");
    if (!content) throw new HttpsError("invalid-argument", "付費正文不可為空白。");
    if (Buffer.byteLength(content, "utf8") > MAX_PRIVATE_BODY_BYTES) {
      throw new HttpsError("invalid-argument", "付費正文過大，請拆分文章內容後再儲存。");
    }

    const privateRef = db.doc(`${PRIVATE_COLLECTION}/${articleId}`);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(privateRef);
      const current = snapshot.data() || {};
      const contentHash = hashContent(content);
      const contentVersion = current.contentHash === contentHash
        ? Math.max(1, Number(current.contentVersion || 1))
        : Math.max(1, Number(current.contentVersion || 0) + 1);

      transaction.set(privateRef, {
        articleId,
        title,
        status,
        content,
        contentHash,
        contentVersion,
        source: "article-admin-secure-callable",
        active: true,
        updatedBy: adminEmail,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return { contentHash, contentVersion };
    });

    const verifySnapshot = await privateRef.get();
    const verify = verifySnapshot.data() || {};
    if (!verifySnapshot.exists || verify.content !== content || verify.contentHash !== result.contentHash) {
      throw new HttpsError("internal", "付費正文寫入後驗證失敗，公開文章未受影響。");
    }

    return {
      articleId,
      contentVersion: result.contentVersion,
      saved: true
    };
  }
);
