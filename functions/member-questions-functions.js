"use strict";

// 會員專屬提問：新提問通知靈元院 Gmail；管理者回覆後寄信通知會員。
// 使用既有 SMTP_CONFIG secret（與其他寄信函式相同）。
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getApps, initializeApp } = require("firebase-admin/app");
const nodemailer = require("nodemailer");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineJsonSecret } = require("firebase-functions/params");

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "asia-east1";
const ADMIN_NOTIFY_EMAIL = "lyyuan03@gmail.com";
const SITE_URL = "https://lyyuan.tw";
const smtpConfig = defineJsonSecret("SMTP_CONFIG");

function cleanText(value = "", maximum = 5000) {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function mailTransport() {
  const config = smtpConfig.value();
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: Number(config.port || 465),
      secure: config.secure !== false,
      auth: { user: config.user, pass: config.pass }
    }),
    from: config.from || `LYY靈元院行政團隊 <${config.user}>`
  };
}

function articleUrl(articleId) {
  return `${SITE_URL}/articles.html?id=${encodeURIComponent(articleId)}`;
}

exports.notifyNewMemberQuestion = onDocumentCreated(
  { document: "memberQuestions/{questionId}", region: REGION, secrets: [smtpConfig] },
  async (event) => {
    const data = event.data?.data() || {};
    const { transporter, from } = mailTransport();
    await transporter.sendMail({
      from,
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: data.email || undefined,
      subject: `【會員專屬提問】${cleanText(data.articleTitle, 80) || data.articleId}`,
      text: `新的會員專屬提問

會員：${cleanText(data.email, 200)}
文章：${cleanText(data.articleTitle, 300)}
${articleUrl(data.articleId)}

提問內容：
${cleanText(data.question, 2000)}

請至管理後台「會員專屬提問」回覆：${SITE_URL}/admin.html#member-questions`
    });
    await event.data.ref.set({ adminNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
);

exports.notifyMemberQuestionReply = onDocumentUpdated(
  { document: "memberQuestions/{questionId}", region: REGION, secrets: [smtpConfig] },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const reply = cleanText(after.reply, 5000);
    if (!reply || reply === cleanText(before.reply, 5000)) return;
    if (!after.email) return;
    const { transporter, from } = mailTransport();
    await transporter.sendMail({
      from,
      to: after.email,
      subject: `靈元院已回覆您的提問｜${cleanText(after.articleTitle, 80)}`,
      text: `您好：

靈元院已回覆您在〈${cleanText(after.articleTitle, 300)}〉提出的問題。

您的提問：
${cleanText(after.question, 2000)}

靈元院回覆：
${reply}

登入後也可在文章下方查看：${articleUrl(after.articleId)}

LYY靈元院`
    });
    await event.data.after.ref.set({ memberNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
);
