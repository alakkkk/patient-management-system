// Upcoming-appointment alerts.
// Self-contained: reuses the `sb` Supabase client created in app.js.
// Add this file with <script src="alerts.js"></script> AFTER app.js.
(function () {
  const WINDOW_MIN = 60;        // show appointments starting within this many minutes
  const NOTIFY_BEFORE_MIN = 15; // fire a desktop notification this long before start
  const POLL_MS = 60000;        // re-check every minute

  const notified = new Set();   // appointment ids we've already desktop-notified
  let dismissedUntil = 0;       // snooze timestamp

  // --- styles (injected so this stays a single drop-in file) ---
  const style = document.createElement("style");
  style.textContent = `
    #alert-bar { position: fixed; top: 74px; right: 16px; width: 340px;
      max-width: calc(100vw - 32px); z-index: 15; }
    #alert-bar.hidden { display: none; }
    .alert-inner { background: var(--surface,#fff); border: 1px solid var(--line,#e2e8e8);
      border-left: 4px solid #d98a1f; border-radius: 12px;
      box-shadow: var(--shadow-lift, 0 14px 34px rgba(23,38,46,.12));
      padding: 0.9rem 1rem; font-family: var(--font, sans-serif); color: var(--ink,#17262e);
      animation: alert-in .2s ease; }
    @keyframes alert-in { from { opacity:0; transform: translateY(-6px);} to {opacity:1;} }
    .alert-head { display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.92rem; }
    .alert-dot { width:8px; height:8px; border-radius:50%; background:#d98a1f;
      box-shadow:0 0 0 3px rgba(217,138,31,0.18); flex:0 0 auto; }
    .alert-list { list-style:none; margin:0.6rem 0 0; padding:0; font-size:0.88rem; }
    .alert-list li { padding:0.22rem 0; }
    .alert-list .mono { font-variant-numeric: tabular-nums; }
    .alert-more { font-size:0.8rem; color: var(--ink-soft,#5a6b73); margin-top:0.25rem; }
    .alert-actions { display:flex; gap:0.5rem; margin-top:0.75rem; }
    .alert-btn { font: inherit; font-size:0.82rem; padding:0.35rem 0.62rem; border-radius:8px;
      border:1px solid transparent; background:#d98a1f; color:#fff; cursor:pointer; }
    .alert-btn:hover { background:#c17c19; }
    .alert-btn.ghost { background:transparent; border-color: var(--line,#e2e8e8); color: var(--ink,#17262e); }
    .alert-btn.ghost:hover { border-color: var(--ink-soft,#5a6b73); }
    @media (max-width:620px){ #alert-bar { top: 66px; right: 8px; left: 8px; width:auto; } }
  `;
  document.head.appendChild(style);

  const bar = document.createElement("div");
  bar.id = "alert-bar";
  bar.className = "hidden";
  document.body.appendChild(bar);

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const hide = () => bar.classList.add("hidden");

  async function check() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return hide();

    const now = new Date();
    const soon = new Date(now.getTime() + WINDOW_MIN * 60000);

    let appts;
    try {
      const { data, error } = await sb
        .from("appointments")
        .select("id, scheduled_at, reason, patient:patient_id(full_name), provider:provider_id(full_name)")
        .eq("status", "scheduled")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", soon.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      appts = data;
    } catch (_e) {
      return; // stay quiet on transient errors
    }

    // desktop notifications for appointments crossing the "X minutes before" threshold
    if ("Notification" in window && Notification.permission === "granted") {
      const thresh = new Date(now.getTime() + NOTIFY_BEFORE_MIN * 60000);
      appts.forEach((a) => {
        if (new Date(a.scheduled_at) <= thresh && !notified.has(a.id)) {
          notified.add(a.id);
          new Notification("Upcoming appointment", {
            body: `${fmtTime(a.scheduled_at)} — ${a.patient?.full_name || "Patient"}` +
              (a.provider?.full_name ? ` with ${a.provider.full_name}` : ""),
          });
        }
      });
    }

    render(appts);
  }

  function render(appts) {
    if (!appts || !appts.length || Date.now() < dismissedUntil) return hide();

    const items = appts
      .slice(0, 4)
      .map(
        (a) =>
          `<li><span class="mono"><strong>${fmtTime(a.scheduled_at)}</strong></span> — ` +
          `${escapeHtml(a.patient?.full_name || "Patient")}` +
          (a.provider?.full_name ? ` · ${escapeHtml(a.provider.full_name)}` : "") +
          `</li>`
      )
      .join("");
    const more = appts.length > 4 ? `<div class="alert-more">+${appts.length - 4} more</div>` : "";
    const needPerm = "Notification" in window && Notification.permission === "default";

    bar.innerHTML = `
      <div class="alert-inner">
        <div class="alert-head">
          <span class="alert-dot"></span>
          <span>${appts.length} appointment${appts.length > 1 ? "s" : ""} in the next hour</span>
        </div>
        <ul class="alert-list">${items}</ul>
        ${more}
        <div class="alert-actions">
          ${needPerm ? '<button id="alert-enable" class="alert-btn">Enable desktop alerts</button>' : ""}
          <button id="alert-dismiss" class="alert-btn ghost">Dismiss</button>
        </div>
      </div>`;
    bar.classList.remove("hidden");

    const enable = document.getElementById("alert-enable");
    if (enable)
      enable.onclick = () => Notification.requestPermission().then(() => render(appts));
    document.getElementById("alert-dismiss").onclick = () => {
      dismissedUntil = Date.now() + 30 * 60000; // snooze 30 min
      hide();
    };
  }

  // start when logged in, stop when logged out, and poll on a timer
  sb.auth.onAuthStateChange((_event, session) => (session ? check() : hide()));
  check();
  setInterval(check, POLL_MS);
})();
