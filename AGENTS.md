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