"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineJsonSecret } = require("firebase-functions/params");

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-east1";
const SITE_URL = "https://lyyuan.tw";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const smtpConfig = defineJsonSecret("SMTP_CONFIG");

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function htmlEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function cleanText(value = "", maximum = 5000) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function isAdminRequest(request) {
  return Boolean(request.auth && ADMIN_EMAILS.has(normalizeEmail(request.auth.token.email)));
}

function assertAdmin(request) {
  if (!isAdminRequest(request)) {
    throw new HttpsError("permission-denied", "僅限靈元院管理員使用文章通知功能。");
  }
}

function mailTransport() {
  const config = smtpConfig.value();
  if (!config?.host || !config?.user || !config?.pass) {
    throw new HttpsError("failed-precondition", "SMTP_CONFIG 尚未完整設定。");
  }
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: Number(config.port || 465),
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.pass
      }
    }),
    from: config.from || `LYY靈元院行政團隊 <${config.user}>`,
    auditEmail: normalizeEmail(config.user)
  };
}

function sponsorQualifies(data = {}) {
  const topLevel = data.status === "active" && data.articleAccess === true;
  const wellnessBenefit = data.wellnessBenefit || {};
  const nested = wellnessBenefit.status === "active" && wellnessBenefit.articleAccess === true;
  return topLevel || nested;
}

function articleUrl(articleId, article = {}) {
  const routeId = cleanText(article.slug || articleId, 200);
  return `${SITE_URL}/articles.html?id=${encodeURIComponent(routeId)}`;
}

function recipientScope(accessType) {
  if (accessType === "paid") {
    return {
      key: "sponsor-only",
      text: "贊助專屬文章：只通知 sponsorMemberAccess 中符合贊助條件的會員。"
    };
  }
  return {
    key: "member-and-sponsor",
    text: "一般文章：通知 memberAccess 中 status 為 active 且 articleAccess 為 true 的會員，加上 sponsorMemberAccess 中符合贊助條件的會員。"
  };
}

async function loadPublishedArticle(articleId) {
  const safeId = cleanText(articleId, 300);
  if (!safeId) throw new HttpsError("invalid-argument", "缺少 articleId。");
  const snapshot = await db.doc(`articles/${safeId}`).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "找不到這篇文章的 Firestore 紀錄。");
  const article = snapshot.data() || {};
  if (article.status !== "published") {
    throw new HttpsError("failed-precondition", "只有已發布文章可以預覽或通知訂閱者。");
  }
  return { articleId: safeId, article };
}

async function collectRecipients(accessType) {
  const emails = new Set();

  if (accessType !== "paid") {
    const memberSnapshot = await db.collection("memberAccess")
      .where("status", "==", "active")
      .where("articleAccess", "==", true)
      .get();

    memberSnapshot.docs.forEach((item) => {
      const data = item.data() || {};
      const email = normalizeEmail(data.email || item.id);
      if (email && email.includes("@")) emails.add(email);
    });
  }

  const sponsorSnapshot = await db.collection("sponsorMemberAccess").get();
  sponsorSnapshot.docs.forEach((item) => {
    const data = item.data() || {};
    if (!sponsorQualifies(data)) return;
    const email = normalizeEmail(data.email || item.id);
    if (email && email.includes("@")) emails.add(email);
  });

  return [...emails].sort();
}

function buildEmail(articleId, article, scopeText) {
  const title = cleanText(article.title || "靈元院最新文章", 180);
  const excerpt = cleanText(article.excerpt || "", 900);
  const url = articleUrl(articleId, article);
  const subject = `靈元院文選｜${title}`;

  const html = `<!doctype html>
<html lang="zh-Hant">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f0e8;color:#2c261f;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:36px 22px;">
    <div style="background:#fff;border:1px solid #d8c7a7;padding:32px;">
      <div style="font-size:12px;letter-spacing:.18em;color:#8a7354;margin-bottom:14px;">靈元院 LING YUAN YUAN｜文選更新</div>
      <h1 style="font-size:26px;line-height:1.45;margin:0 0 18px;color:#594f47;">${htmlEscape(title)}</h1>
      ${excerpt ? `<p style="font-size:16px;line-height:1.9;margin:0 0 26px;color:#51493f;">${htmlEscape(excerpt)}</p>` : ""}
      <p style="margin:0 0 30px;"><a href="${htmlEscape(url)}" style="display:inline-block;padding:12px 22px;background:#606330;color:#fff;text-decoration:none;">閱讀完整文章</a></p>
      <div style="font-size:12px;line-height:1.8;color:#8a8176;border-top:1px solid #eee5d9;padding-top:18px;">這封信是依您目前的靈元院文章閱讀權限寄送。</div>
    </div>
  </div>
</body>
</html>`;

  const text = `靈元院文選更新\n\n${title}\n\n${excerpt ? `${excerpt}\n\n` : ""}閱讀完整文章：${url}\n\n這封信是依您目前的靈元院文章閱讀權限寄送。`;

  const previewHtml = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文章通知信預覽｜${htmlEscape(title)}</title></head>
<body style="margin:0;background:#ece8df;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','Microsoft JhengHei',sans-serif;">
  <div style="max-width:760px;margin:24px auto;padding:0 18px;">
    <div style="background:#17130d;color:#f5f0e8;padding:18px 20px;margin-bottom:18px;line-height:1.7;">
      <strong>文章通知信預覽</strong><br>
      <span style="font-size:13px;color:#d8c7a7;">主旨：${htmlEscape(subject)}<br>收件對象：${htmlEscape(scopeText)}<br>文章連結：${htmlEscape(url)}</span>
    </div>
    <iframe title="通知信內容" style="display:block;width:100%;height:760px;border:0;background:white" srcdoc="${htmlEscape(html)}"></iframe>
  </div>
</body></html>`;

  return { title, excerpt, url, subject, html, text, previewHtml };
}

async function notificationContext(request) {
  assertAdmin(request);
  const { articleId, article } = await loadPublishedArticle(request.data?.articleId);
  const accessType = article.accessType === "paid" ? "paid" : (article.accessType || "open");
  const scope = recipientScope(accessType);
  const recipients = await collectRecipients(accessType);
  const mail = buildEmail(articleId, article, scope.text);
  return { articleId, article, accessType, scope, recipients, mail };
}

exports.previewArticleNotification = onCall(
  {
    region: REGION,
    secrets: [smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    const context = await notificationContext(request);
    return {
      articleId: context.articleId,
      title: context.mail.title,
      excerpt: context.mail.excerpt,
      url: context.mail.url,
      subject: context.mail.subject,
      recipientCount: context.recipients.length,
      recipientScope: context.scope.text,
      accessType: context.accessType,
      html: context.mail.previewHtml
    };
  }
);

exports.getArticleNotificationStatus = onCall(
  {
    region: REGION,
    enforceAppCheck: false
  },
  async (request) => {
    assertAdmin(request);
    const articleId = cleanText(request.data?.articleId, 300);
    if (!articleId) throw new HttpsError("invalid-argument", "缺少 articleId。");
    const snapshot = await db.doc(`articleNotifications/${articleId}`).get();
    if (!snapshot.exists) return { articleId, status: "not-sent" };
    const record = snapshot.data() || {};
    return {
      articleId,
      status: cleanText(record.status || "unknown", 50),
      recipientCount: Number(record.recipientCount || 0),
      errorMessage: cleanText(record.errorMessage || "", 500)
    };
  }
);

exports.notifyArticleSubscribers = onCall(
  {
    region: REGION,
    secrets: [smtpConfig],
    enforceAppCheck: false
  },
  async (request) => {
    const context = await notificationContext(request);
    const recordRef = db.doc(`articleNotifications/${context.articleId}`);
    const requestedBy = normalizeEmail(request.auth.token.email);

    await db.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(recordRef);
      const existing = existingSnapshot.exists ? (existingSnapshot.data() || {}) : null;
      if (existing && ["sending", "smtp-accepted", "delivery-unknown", "sent"].includes(existing.status)) {
        throw new HttpsError("already-exists", "這篇文章已寄送過通知，或目前正在寄送中。");
      }
      transaction.set(recordRef, {
        articleId: context.articleId,
        articleTitle: context.mail.title,
        accessType: context.accessType,
        recipientScope: context.scope.text,
        recipientCount: context.recipients.length,
        status: "sending",
        requestedBy,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

    let smtpAccepted = false;
    try {
      if (context.recipients.length > 0) {
        const { transporter, from, auditEmail } = mailTransport();
        await transporter.verify();
        await transporter.sendMail({
          from,
          to: auditEmail,
          bcc: context.recipients.filter((email) => email !== auditEmail),
          subject: context.mail.subject,
          text: context.mail.text,
          html: context.mail.html
        });
        smtpAccepted = true;
        await recordRef.set({
          status: "smtp-accepted",
          smtpAcceptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await recordRef.set({
        status: "sent",
        recipientCount: context.recipients.length,
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        articleId: context.articleId,
        status: "sent",
        recipientCount: context.recipients.length,
        recipientScope: context.scope.text
      };
    } catch (error) {
      console.error("Article notification send failed", {
        articleId: context.articleId,
        recipientCount: context.recipients.length,
        error
      });
      const failureStatus = smtpAccepted ? "delivery-unknown" : "error";
      try {
        await recordRef.set({
          status: failureStatus,
          errorMessage: cleanText(error?.message || "unknown error", 500),
          failedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (recordError) {
        console.error("Article notification failure status write failed", {
          articleId: context.articleId,
          recordError
        });
      }
      if (error instanceof HttpsError) throw error;
      if (smtpAccepted) {
        throw new HttpsError("aborted", "郵件伺服器可能已接收通知，但系統未完成確認。請勿重複寄送，請先查看寄件備份。");
      }
      throw new HttpsError("internal", "通知信未完成寄送。請先確認寄件信箱設定後再試。");
    }
  }
);
