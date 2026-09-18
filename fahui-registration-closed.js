(() => {
  "use strict";

  // Legacy compatibility only:
  // Older cached copies of fahui.html may still load this file.
  // Never replace the current registration card with the old empty-state message.
  const renderGuanyinUpcomingCard = () => {
    const list = document.querySelector(".announcement-list");
    if (!list) return;

    const existing = list.querySelector('[data-event="guanyin-20261028"]');
    if (existing) return;

    list.innerHTML = `
      <div class="announcement-item pending" data-event="guanyin-20261028">
        <div
          class="announcement-thumb"
          style="background-image:url('https://pic.pimg.tw/kinkiosel/1764746739-3558561597-g_n.jpg');"
          role="img"
          aria-label="觀音菩薩出家日法儀"
        ></div>
        <div class="announcement-body">
          <span class="announcement-meta">10/28</span>
          <h3>觀音菩薩出家日．大悲懺消災降福祈願法儀</h3>
          <div class="announcement-action">
            <button type="button" class="announcement-btn disabled" disabled>即將開放報名</button>
          </div>
        </div>
      </div>
    `;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderGuanyinUpcomingCard, { once: true });
  } else {
    renderGuanyinUpcomingCard();
  }
})();
