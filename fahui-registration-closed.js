(() => {
  "use strict";

  // Legacy compatibility only (kept so older cached copies of fahui.html / analytics-config.js
  // that still request this file do not get a 404).
  // It used to overwrite .announcement-list with a hard-coded 觀音 "即將開放報名" card whenever
  // that card was missing, which hid the current registration cards (e.g. 圓燈總迴向法儀).
  // The registration cards are now maintained directly in fahui.html, so this script must do nothing.
})();
