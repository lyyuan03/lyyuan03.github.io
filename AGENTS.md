# AGENTS.md — Production Safety Rules

These rules are mandatory for all AI/Codex changes in this repository.

- Do not write multi-file production fixes directly to `main`. Use a branch/PR and keep one logical fix atomic.
- Treat `PRODUCTION_STABILITY_LOCK.md` as the release contract.
- Do not add a new article-detail renderer. `articles-core-20260810-v6.js` owns primary article rendering.
- Do not re-enable detail fallback rendering in `article-list-rescue.js`.
- Do not add `repairRestoredGates()` or any self-healing DOM loop that can observe its own mutations.
- Do not add a global `MutationObserver`/`setInterval` for a single article. Gate it by article ID before installing observers/timers.
- Do not hard-code a published article to `draft` in generic frontend runtime.
- Do not change protected article runtime files without keeping the article cache token consistent.
- Do not deploy if `scripts/audit-production-stability.mjs` or the five-load Chromium smoke test fails.
- Diagnostic/status workflows must not create needless production Pages deployments.
- On regression, restore the latest `stable/*` snapshot first; do not stack additional rescue/repair modules on a failing release.

# Codex 專案長期工作規則

## 基本工作原則

1. 每次接到任務，先確認專案結構、相關檔案及既有規則。
2. 優先沿用現有程式架構、命名方式及設計風格。
3. 資訊不足且會影響結果時，先提出必要問題。
4. 一般修改可直接執行，避免反覆要求確認。
5. 涉及刪除資料、重要檔案覆寫或不可逆操作，必須事先說明並取得同意。

## 工作執行方式

1. 依工作複雜程度安排分析與執行步驟。
2. 複雜任務應充分分析現有架構及可能的影響。
3. 可明確分工且不會造成檔案衝突時，才使用子代理。
4. 修改過程應保留既有功能，避免影響無關程式。
5. 發現原有程式存在問題時，應說明原因及影響範圍。

## 網站與視覺設計

1. 修改網站前，確認目標頁面與目前使用的版本。
2. 遵守專案既有品牌識別、色彩及版面規範。
3. 提供參考圖片時，應比對字級、比例、留白、色彩與元件位置。
4. 修改完成後，檢查電腦版與手機版。
5. 確認原有連結、表單、導覽及主要互動功能正常。
6. 未經要求，不得任意修改其他頁面的設計。

## 驗收與品質檢查

完成工作前，應依任務性質執行適當檢查：

- 確認修改內容符合需求。
- 檢查程式是否存在語法錯誤。
- 執行適用的測試。
- 網頁工作應檢查不同裝置的顯示結果。
- 確認既有功能未受到影響。
- 無法完成的檢查，必須明確說明。

## 完成後回報

每次工作完成後，提供：

1. 本次修改摘要。
2. 修改檔案及各自的變更內容。
3. 實際執行的檢查與結果。
4. 尚未完成的項目及原因。
5. 使用者可以如何驗收成果。

所有回覆均使用台灣繁體中文及台灣慣用語。

不得將未執行的檢查描述為已通過，也不得在尚未確認結果時宣稱工作全部完成。
