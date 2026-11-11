/**
 * 靈元院 116年丁未年年度點燈 — 報名確認信模板
 * 將此函數貼入目前正式部署的 Apps Script（產生 L116- 報名編號的那個），
 * 替換原本 MailApp.sendEmail 的主題與正文。
 *
 * 呼叫示例：
 * sendLampConfirmationEmail({
 *   email: '信眾@gmail.com',
 *   name: '蘇凌彰',
 *   registrationId: 'L116-20261111-174327-182DC3',
 *   detailsHtml: '<p>燈別／芳名…</p>'   // 可選，有的話跟在報名編號後面
 * });
 */
function sendLampConfirmationEmail({ email, name, registrationId, detailsHtml = '' }) {
  const displayName = String(name || '信眾').trim();
  const eventName = '116年丁未年年度點燈';
  const subject = '靈元院｜報名確認';

  const text = `${displayName} 師兄師姐 您好：

感謝您本次登記${eventName}。

報名編號：${registrationId}
`;

  const html = `<div style="font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;color:#1a1a1a;line-height:1.8;max-width:560px;margin:0 auto;padding:24px">
  <p style="letter-spacing:.3em;color:#8a7355;font-size:13px;margin:0 0 8px">LING YUAN YUAN</p>
  <h2 style="font-size:20px;font-weight:500;margin:0 0 20px">報名確認</h2>
  <p>${displayName} 師兄師姐 您好：</p>
  <p>感謝您本次登記${eventName}。</p>
  <p><strong>報名編號：${registrationId}</strong></p>
  ${detailsHtml}
</div>`;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: text,
    htmlBody: html
  });
}
