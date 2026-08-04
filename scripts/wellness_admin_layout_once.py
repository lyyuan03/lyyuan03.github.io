from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


style_anchor = ".membership-card h3{margin:0 0 15px;color:#CBAA77;font-family:var(--serif);font-weight:500;letter-spacing:.12em}.membership-form{display:grid;gap:14px}"
style_replacement = ".membership-card h3{margin:0 0 15px;color:#CBAA77;font-family:var(--serif);font-weight:500;letter-spacing:.12em}.membership-form{display:grid;gap:14px}.membership-subsection{display:grid;gap:13px;padding:16px;border:1px solid rgba(165,130,84,.18);background:rgba(165,130,84,.025)}.membership-subsection-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-bottom:9px;border-bottom:1px solid rgba(165,130,84,.16)}.membership-subsection-head strong{color:#D8BD91;font-family:var(--serif);font-size:15px;font-weight:500;letter-spacing:.1em}.membership-subsection-head small{color:rgba(245,240,232,.46);font-size:10px;text-align:right}.membership-subsection[hidden]{display:none!important}"
replace_once("admin.html", style_anchor, style_replacement)

old_fields = '''            <div class="grid">
              <div class="field"><label for="wellness-member-name">會員姓名</label><input id="wellness-member-name"></div>
              <div class="field"><label for="wellness-member-email">登入 Gmail</label><input id="wellness-member-email" type="email" required></div>
              <div class="field"><label for="wellness-member-level">會員資格</label><select id="wellness-member-level"><option value="wellness">一般會員</option><option value="lingji">靈極會員</option></select></div>
              <div class="field"><label for="wellness-member-state">會員狀態</label><select id="wellness-member-state"><option value="active">啟用</option><option value="pending">未啟用</option></select></div>
              <div class="field"><label for="wellness-member-first-joined-at">首次加入日期</label><input id="wellness-member-first-joined-at" type="date"></div>
              <div class="field"><label for="wellness-member-starts-at">本次會期開始日</label><input id="wellness-member-starts-at" type="date"></div>
              <div class="field"><label for="wellness-member-expires-at">到期日</label><input id="wellness-member-expires-at" type="date"></div>
              <div class="field"><label for="wellness-member-annual-spend">本年度累積消費</label><input id="wellness-member-annual-spend" type="number" min="0" step="1" value="0"></div>
              <div class="field"><label for="wellness-member-cashback">目前可用回饋金</label><input id="wellness-member-cashback" type="number" min="0" step="1000" value="0"></div>
              <div class="field"><label for="wellness-member-annual-cycle">年度計算起日</label><input id="wellness-member-annual-cycle" type="date"></div>
              <div class="field"><label for="wellness-member-lingji-from">本期靈極資格起日</label><input id="wellness-member-lingji-from" type="date"></div>
              <div class="field"><label for="wellness-member-lingji-until">本期靈極資格迄日</label><input id="wellness-member-lingji-until" type="date"></div>
            </div>
            <div id="wellness-article-benefit-summary" class="membership-summary">
              <strong id="wellness-article-benefit-title" style="display:block;color:#D8BD91;margin-bottom:4px">贊助文章閱讀權限：尚未符合</strong>
              <span id="wellness-article-benefit-detail">靈極會員自動開通；一般會員單筆消費滿新台幣 15,000 元後自動開通。</span>
            </div>
            <div class="grid">
              <div class="field"><label for="wellness-member-qualifying-purchase">本次符合權益的單筆消費</label><input id="wellness-member-qualifying-purchase" type="number" min="0" step="1" value="0"></div>
              <div class="field"><label for="wellness-member-article-reference">消費／訂單編號</label><input id="wellness-member-article-reference" placeholder="選填，方便日後核對"></div>
            </div>
            <p class="membership-help">權限由系統自動判讀，不需人工勾選：靈極會員於會籍有效期間自動開通；一般會員本次單筆消費達新台幣 15,000 元時開通。文章權限效期一律跟隨本次養生療癒會員會期。</p>
'''
new_fields = '''            <section class="membership-subsection">
              <div class="membership-subsection-head"><strong>一、會員基本資料</strong><small>先確認身分與目前會籍狀態</small></div>
              <div class="grid">
                <div class="field"><label for="wellness-member-name">會員姓名</label><input id="wellness-member-name"></div>
                <div class="field"><label for="wellness-member-email">登入 Gmail</label><input id="wellness-member-email" type="email" required></div>
                <div class="field"><label for="wellness-member-level">會員資格</label><select id="wellness-member-level"><option value="wellness">一般會員</option><option value="lingji">靈極會員</option></select></div>
                <div class="field"><label for="wellness-member-state">會員狀態</label><select id="wellness-member-state"><option value="active">啟用</option><option value="pending">未啟用</option></select></div>
              </div>
            </section>

            <section class="membership-subsection">
              <div class="membership-subsection-head"><strong>二、會籍效期</strong><small>贊助文章加贈權限會跟隨這段期間</small></div>
              <div class="grid">
                <div class="field"><label for="wellness-member-first-joined-at">首次加入日期</label><input id="wellness-member-first-joined-at" type="date"></div>
                <div class="field"><label for="wellness-member-starts-at">本次會期開始日</label><input id="wellness-member-starts-at" type="date"></div>
                <div class="field"><label for="wellness-member-expires-at">到期日</label><input id="wellness-member-expires-at" type="date"></div>
              </div>
            </section>

            <section id="wellness-lingji-period-fields" class="membership-subsection" hidden>
              <div class="membership-subsection-head"><strong>靈極會員資格期間</strong><small>只有選擇靈極會員時才需要管理</small></div>
              <div class="grid">
                <div class="field"><label for="wellness-member-lingji-from">本期靈極資格起日</label><input id="wellness-member-lingji-from" type="date"></div>
                <div class="field"><label for="wellness-member-lingji-until">本期靈極資格迄日</label><input id="wellness-member-lingji-until" type="date"></div>
              </div>
            </section>

            <section class="membership-subsection">
              <div class="membership-subsection-head"><strong>三、消費與回饋</strong><small>年度累積與單筆滿額分開計算</small></div>
              <div class="grid">
                <div class="field"><label for="wellness-member-annual-spend">本年度累積消費</label><input id="wellness-member-annual-spend" type="number" min="0" step="1" value="0"></div>
                <div class="field"><label for="wellness-member-annual-cycle">年度計算起日</label><input id="wellness-member-annual-cycle" type="date"></div>
                <div class="field"><label for="wellness-member-cashback">目前可用回饋金</label><input id="wellness-member-cashback" type="number" min="0" step="1000" value="0"></div>
              </div>
            </section>

            <section class="membership-subsection">
              <div class="membership-subsection-head"><strong>四、贊助文章閱讀權限</strong><small>系統自動判讀，不再使用人工勾選</small></div>
              <div id="wellness-article-benefit-summary" class="membership-summary">
                <strong id="wellness-article-benefit-title" style="display:block;color:#D8BD91;margin-bottom:4px">贊助文章閱讀權限：尚未符合</strong>
                <span id="wellness-article-benefit-detail">靈極會員自動開通；一般會員單筆消費滿新台幣 15,000 元後自動開通。</span>
              </div>
              <div class="grid">
                <div class="field"><label for="wellness-member-qualifying-purchase">本次符合權益的單筆消費</label><input id="wellness-member-qualifying-purchase" type="number" min="0" step="1" value="0"></div>
                <div class="field"><label for="wellness-member-article-reference">消費／訂單編號</label><input id="wellness-member-article-reference" placeholder="選填，方便日後核對"></div>
              </div>
              <p class="membership-help">靈極會員於會籍有效期間自動開通；一般會員本次單筆消費達新台幣 15,000 元時開通。權限效期一律跟隨本次養生療癒會員會期。</p>
            </section>
'''
replace_once("admin.html", old_fields, new_fields)

old_const = '''const articleBenefitDetailEl = document.getElementById("wellness-article-benefit-detail");
const sendPaymentButton = document.getElementById("wellness-member-send-payment");
'''
new_const = '''const articleBenefitDetailEl = document.getElementById("wellness-article-benefit-detail");
const lingjiPeriodFieldsEl = document.getElementById("wellness-lingji-period-fields");
const sendPaymentButton = document.getElementById("wellness-member-send-payment");
'''
replace_once("wellness-member-admin.js", old_const, new_const)

old_preview = '''  const decision = articleBenefitDecision({
    memberLevel: level,
    status,
    qualifyingSinglePurchaseAmount: qualifyingPurchaseEl.value
  });
'''
new_preview = '''  const decision = articleBenefitDecision({
    memberLevel: level,
    status,
    qualifyingSinglePurchaseAmount: qualifyingPurchaseEl.value
  });
  if (lingjiPeriodFieldsEl) lingjiPeriodFieldsEl.hidden = level !== "lingji";
'''
replace_once("wellness-member-admin.js", old_preview, new_preview)

old_template = '''    return `<div class="member-row"><div><strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(levelLabel(level))}｜${escapeHtml(stateLabel)}</strong><small>${escapeHtml(member.email)}｜${articleLabel}｜首次加入 ${escapeHtml(formatDate(member.firstJoinedAt))}｜到期 ${escapeHtml(formatDate(member.expiresAt))}<br>本年度累積 NT$${annualSpend.toLocaleString("zh-TW")}｜可用回饋金 NT$${cashback.toLocaleString("zh-TW")}｜線上課程 ${courseCount} 門<br>${escapeHtml(qualificationLabel)}</small></div><div class="member-row-actions"><button class="btn" type="button" data-wellness-edit="${escapeHtml(member.email)}">編輯</button><button class="btn danger" type="button" data-wellness-delete="${escapeHtml(member.email)}">刪除</button></div></div>`;
'''
new_template = '''    const benefitAudit = benefit.source === "single-purchase-15000"
      ? `單筆 NT$${benefit.amount.toLocaleString("zh-TW")}${member.articleBenefitReference ? `｜編號 ${escapeHtml(member.articleBenefitReference)}` : ""}`
      : benefit.source === "lingji-member"
        ? "依靈極會員資格自動開通"
        : "尚無符合紀錄";
    return `<div class="member-row"><div><strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(levelLabel(level))}｜${escapeHtml(stateLabel)}</strong><small>${escapeHtml(member.email)}｜${articleLabel}<br>${benefitAudit}｜首次加入 ${escapeHtml(formatDate(member.firstJoinedAt))}｜到期 ${escapeHtml(formatDate(member.expiresAt))}<br>本年度累積 NT$${annualSpend.toLocaleString("zh-TW")}｜可用回饋金 NT$${cashback.toLocaleString("zh-TW")}｜線上課程 ${courseCount} 門<br>${escapeHtml(qualificationLabel)}</small></div><div class="member-row-actions"><button class="btn" type="button" data-wellness-edit="${escapeHtml(member.email)}">編輯</button><button class="btn danger" type="button" data-wellness-delete="${escapeHtml(member.email)}">刪除</button></div></div>`;
'''
replace_once("wellness-member-admin.js", old_template, new_template)

print("Wellness admin layout refined.")
