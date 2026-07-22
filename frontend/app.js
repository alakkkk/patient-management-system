const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const main = $("main");

// ---- icons (inline SVG, no dependencies) ---------------------------------
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
};
const icon = (name) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

(function injectPolishCss() {
  const s = document.createElement("style");
  s.textContent = `
    button { display:inline-flex; align-items:center; justify-content:center; gap:0.4em; }
    .ico { width:1em; height:1em; flex:0 0 auto; }
    .nav-link .ico { width:0.95em; height:0.95em; }
    .back-link { gap:0.3em; }

    /* view fade-in */
    .view-enter { animation: viewIn .22s ease; }
    @keyframes viewIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }

    /* skeleton loaders */
    .skeleton { display:block; border-radius:6px;
      background:linear-gradient(90deg,#e9efee 25%,#f4f8f7 37%,#e9efee 63%);
      background-size:400% 100%; animation:shimmer 1.3s ease infinite; }
    @keyframes shimmer { from { background-position:100% 0; } to { background-position:0 0; } }
    .skeleton-line { height:12px; width:100%; }
    .skeleton-num { height:30px; width:52px; }
    .sk-card { height:120px; border-radius:12px; margin-bottom:1.25rem; }

    /* empty states */
    .empty-state { text-align:center; padding:2.25rem 1rem; }
    .empty-state .ico { width:32px; height:32px; opacity:.4; margin-bottom:.35rem; }
    .empty-state-title { font-weight:600; color:var(--ink); margin:.2rem 0 0; }
    .empty-state-sub { color:var(--ink-soft); font-size:.85rem; margin:.25rem 0 0; }

    /* status-colored appointment accents */
    .record.status-scheduled { border-left:3px solid var(--accent); }
    .record.status-checked_in { border-left:3px solid #1d4e89; }
    .record.status-completed { border-left:3px solid #2f6b3a; }
    .record.status-cancelled { border-left:3px solid var(--danger); }
    .record.status-no_show { border-left:3px solid #8a5a12; }

    /* allergy highlight chip */
    .allergy-flag { background:var(--warn-soft); color:#8a5a12; font-weight:600;
      padding:0.1rem 0.55rem; border-radius:6px; font-size:0.85rem; }

    /* confirm modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(23,38,46,.45);
      display:none; align-items:center; justify-content:center; z-index:50; padding:1rem; }
    .modal-overlay.show { display:flex; animation: mFade .15s ease; }
    .modal-box { background:var(--surface); border-radius:14px; box-shadow:var(--shadow-lift);
      padding:1.5rem; max-width:400px; width:100%; animation: mPop .16s ease; }
    @keyframes mFade { from { opacity:0; } to { opacity:1; } }
    @keyframes mPop { from { opacity:0; transform:scale(.96); } to { opacity:1; transform:none; } }
    .modal-message { margin:0 0 1.25rem; font-size:.95rem; color:var(--ink); line-height:1.5; }
    .modal-actions { display:flex; gap:.6rem; justify-content:flex-end; }
    .btn-danger-solid { background:var(--danger); color:#fff; border:1px solid var(--danger); }
    .btn-danger-solid:hover { background:#9a2b24; }

    /* --- responsive / mobile --- */
    @media (max-width: 760px) {
      .topbar { flex-wrap: wrap; row-gap: 0.5rem; padding: 0.6rem 1rem; }
      .topbar-left { gap: 1rem; }
      #main { padding: 1.1rem 0.9rem 3rem; }
      .page-head h2 { font-size: 1.3rem; }
      .card { overflow-x: auto; }              /* wide tables scroll within the card */
      .card table { min-width: 480px; }
      .row > * { flex-basis: 100%; min-width: 0; }  /* form fields stack full-width */
      .record-actions { flex-wrap: wrap; }
      .modal-box { max-width: none; }
    }
    @media (max-width: 480px) {
      #who { display: none; }                  /* free space; name is still in the profile */
      .topbar-right { gap: 0.5rem; }
      .nav-link { padding: 0.35rem 0.5rem; font-size: 0.85rem; }
      .stat .num { font-size: 1.7rem; }
      .page-head { gap: 0.5rem; }
    }
  `;
  document.head.appendChild(s);
})();

// ---- helpers -------------------------------------------------------------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

function age(dob) {
  if (!dob) return null;
  const b = new Date(dob), now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function friendly(err, map = {}) {
  if (err?.code === "23505") return map["23505"] || "That record already exists.";
  if (err?.code === "23503") return map["23503"] || "That item is linked to other records.";
  return err?.message || "Something went wrong.";
}

async function withBusy(btn, fn, busyLabel = "Saving…") {
  if (!btn) return fn();
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = busyLabel;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = prev;
  }
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function todayBounds() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

let toastTimer;
function toast(msg, isError = false) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = isError ? "err show" : "show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = el.className.replace("show", "").trim()), 2600);
}

// ---- polish: fade-in on view swap, skeletons, empty states ---------------
new MutationObserver(() => {
  main.classList.remove("view-enter");
  void main.offsetWidth; // restart the animation
  main.classList.add("view-enter");
}).observe(main, { childList: true });

const skeletonRows = (n = 5, cols = 4) =>
  Array.from({ length: n }, () =>
    `<tr class="norow"><td colspan="${cols}"><span class="skeleton skeleton-line"></span></td></tr>`
  ).join("");

const skeletonCards = (n = 3) =>
  Array.from({ length: n }, () => `<div class="skeleton sk-card"></div>`).join("");

function emptyState(iconName, title, sub) {
  return `<div class="empty-state">${icon(iconName)}
    <p class="empty-state-title">${esc(title)}</p>
    ${sub ? `<p class="empty-state-sub">${esc(sub)}</p>` : ""}</div>`;
}

// ---- custom confirm modal (replaces the browser's confirm popup) ---------
function confirmDialog(message, opts = {}) {
  const { confirmLabel = "Delete", cancelLabel = "Cancel", danger = true } = opts;
  return new Promise((resolve) => {
    let modal = $("modal-overlay");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-overlay";
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-box">
          <p id="modal-message" class="modal-message"></p>
          <div class="modal-actions">
            <button id="modal-cancel" class="ghost"></button>
            <button id="modal-ok"></button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    const ok = $("modal-ok");
    const cancel = $("modal-cancel");
    $("modal-message").textContent = message;
    ok.textContent = confirmLabel;
    cancel.textContent = cancelLabel;
    ok.className = danger ? "btn-danger-solid" : "primary";
    modal.classList.add("show");
    ok.focus();

    const close = (val) => {
      modal.classList.remove("show");
      ok.onclick = cancel.onclick = modal.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    ok.onclick = () => close(true);
    cancel.onclick = () => close(false);
    modal.onclick = (e) => { if (e.target === modal) close(false); };
    document.addEventListener("keydown", onKey);
  });
}

// ---- keyboard: Enter submits, Escape closes ------------------------------
function wireFormKeys(scope, submitFn, escapeFn) {
  scope.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      submitFn && submitFn();
    } else if (e.key === "Escape") {
      e.preventDefault();
      escapeFn && escapeFn();
    }
  });
}

["email", "password"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") $("login-btn").click(); })
);
["new-password", "confirm-password"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") $("setpw-btn").click(); })
);

const STATUSES = ["scheduled", "checked_in", "completed", "cancelled", "no_show"];
let PROVIDERS = [];
let CURRENT_USER = null;
let CURRENT_PATIENT = null;
let awaitingPasswordSet = false;

// ---- auth ----------------------------------------------------------------
$("login-btn").addEventListener("click", async () => {
  const btn = $("login-btn");
  const email = $("email").value.trim();
  const password = $("password").value;
  $("login-error").textContent = "";
  try {
    await withBusy(btn, async () => {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }, "Signing in…");
  } catch (err) {
    $("login-error").textContent = err.message;
  }
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());
$("home-link").addEventListener("click", renderDashboard);
$("nav-dashboard").addEventListener("click", renderDashboard);
$("nav-patients").addEventListener("click", renderPatientList);
$("change-pw-btn").addEventListener("click", openChangePassword);

// main auth router (skips while an invited/changing user is on the password screen)
sb.auth.onAuthStateChange((_event, session) => {
  if (awaitingPasswordSet || isInviteLink()) return;
  if (session) showApp();
  else showLogin();
});

// ---- invite / change-password flow ---------------------------------------
sb.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && isInviteLink())) {
    awaitingPasswordSet = true;
    showSetPassword(session);
  }
});

function isInviteLink() {
  const hash = window.location.hash || "";
  return hash.includes("type=invite") || hash.includes("type=recovery");
}

// shown when a user arrives via an invite / recovery email
function showSetPassword(session) {
  $("setpw-title").textContent = "Choose a password";
  $("setpw-cancel").classList.add("hidden");
  $("new-password").value = "";
  $("confirm-password").value = "";
  $("setpw-error").textContent = "";
  $("login-view").classList.add("hidden");
  $("app-view").classList.add("hidden");
  $("setpw-view").classList.remove("hidden");
  const email = session?.user?.email;
  $("setpw-email").textContent = email ? `Setting up ${email}` : "Finish creating your account.";
  setTimeout(() => $("new-password")?.focus(), 0);
}

// shown when a logged-in user clicks "Change password"
function openChangePassword() {
  awaitingPasswordSet = true;
  $("setpw-title").textContent = "Change your password";
  $("setpw-email").textContent = "Enter a new password below.";
  $("new-password").value = "";
  $("confirm-password").value = "";
  $("setpw-error").textContent = "";
  $("setpw-cancel").classList.remove("hidden");
  $("app-view").classList.add("hidden");
  $("login-view").classList.add("hidden");
  $("setpw-view").classList.remove("hidden");
  setTimeout(() => $("new-password")?.focus(), 0);
}

$("setpw-cancel").addEventListener("click", async () => {
  awaitingPasswordSet = false;
  $("setpw-view").classList.add("hidden");
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp();
  else showLogin();
});

$("setpw-btn").addEventListener("click", async () => {
  const errEl = $("setpw-error");
  errEl.textContent = "";
  const pw = $("new-password").value;
  const confirm = $("confirm-password").value;
  if (pw.length < 6) return (errEl.textContent = "Password must be at least 6 characters.");
  if (pw !== confirm) return (errEl.textContent = "Passwords don't match.");
  try {
    await withBusy($("setpw-btn"), async () => {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      awaitingPasswordSet = false;
      history.replaceState(null, "", window.location.pathname); // strip token from URL
      $("setpw-view").classList.add("hidden");
      toast("Password updated");
      showApp();
    }, "Saving…");
  } catch (err) {
    errEl.textContent = err.message;
  }
});

async function showApp() {
  $("login-view").classList.add("hidden");
  $("setpw-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("nav-dashboard").innerHTML = icon("grid") + "Dashboard";
  $("nav-patients").innerHTML = icon("users") + "Patients";
  $("change-pw-btn").innerHTML = icon("key") + "Change password";
  $("logout-btn").innerHTML = icon("logout") + "Sign out";
  try {
    const { data: { user } } = await sb.auth.getUser();
    CURRENT_USER = user.id;
    const profile = unwrap(await sb.from("profiles").select("*").eq("id", user.id).single());
    const role = profile?.role ? ` · ${profile.role}` : "";
    $("who").textContent = `${profile?.full_name || user.email}${role}`;
    PROVIDERS = unwrap(await sb.from("profiles").select("id, full_name, role").order("full_name"));
    renderDashboard();
  } catch (err) {
    main.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p>
      <p class="muted">Check your Supabase URL / publishable key in config.js.</p></div>`;
  }
}

function showLogin() {
  $("app-view").classList.add("hidden");
  $("setpw-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
  setTimeout(() => $("email")?.focus(), 0);
}

function setActiveNav(which) {
  $("nav-dashboard").classList.toggle("active", which === "dashboard");
  $("nav-patients").classList.toggle("active", which === "patients");
}

const providerOptions = (selected) =>
  PROVIDERS.map(
    (p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.full_name)}</option>`
  ).join("");

const statusSelect = (id, current) =>
  `<select data-appt="${id}" class="shrink" style="max-width:150px">
    ${STATUSES.map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s.replace("_", " ")}</option>`).join("")}
  </select>`;

function wireStatusSelects(scope, onDone) {
  scope.querySelectorAll("select[data-appt]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      try {
        unwrap(await sb.from("appointments").update({ status: sel.value }).eq("id", sel.dataset.appt));
        toast("Status updated");
        onDone && onDone();
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );
}

// ==========================================================================
// DASHBOARD
// ==========================================================================
async function renderDashboard() {
  CURRENT_PATIENT = null;
  setActiveNav("dashboard");
  main.innerHTML = `<div class="page-head"><h2>Dashboard</h2></div>
    <div class="stat-grid">
      <div class="stat"><div class="num" id="s-patients"><span class="skeleton skeleton-num"></span></div><div class="lbl">Total patients</div></div>
      <div class="stat"><div class="num" id="s-today"><span class="skeleton skeleton-num"></span></div><div class="lbl">Appointments today</div></div>
      <div class="stat"><div class="num" id="s-upcoming"><span class="skeleton skeleton-num"></span></div><div class="lbl">Upcoming (scheduled)</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Today's schedule</h3></div>
      <div id="schedule"><table><tbody>${skeletonRows(4, 5)}</tbody></table></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Notice board</h3></div>
      <div class="row" style="align-items:flex-end">
        <textarea id="note-input" rows="2" placeholder="Add a note for the team… (e.g. Dr. Lee out Friday)"></textarea>
        <div class="shrink"><button class="primary" id="add-note">${icon("plus")} Add</button></div>
      </div>
      <p class="error" id="note-error"></p>
      <div id="note-list" class="stack" style="margin-top:0.75rem"><p class="empty">Loading…</p></div>
    </div>`;

  wireNotes();

  try {
    const { start, end } = todayBounds();
    const nowIso = new Date().toISOString();
    const [patientCount, todayCount, upcomingCount, schedule] = await Promise.all([
      sb.from("patients").select("id", { count: "exact", head: true }),
      sb.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", start).lte("scheduled_at", end),
      sb.from("appointments").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", nowIso),
      sb.from("appointments")
        .select("*, patient:patient_id(id, full_name, mrn), provider:provider_id(full_name)")
        .gte("scheduled_at", start).lte("scheduled_at", end).order("scheduled_at").then(unwrap),
    ]);

    $("s-patients").textContent = patientCount.count ?? 0;
    $("s-today").textContent = todayCount.count ?? 0;
    $("s-upcoming").textContent = upcomingCount.count ?? 0;

    const el = $("schedule");
    if (!schedule.length) {
      el.innerHTML = emptyState("calendar", "No appointments today", "Booked appointments for today will show up here.");
      return;
    }
    el.innerHTML = `<table>
      <thead><tr><th>Time</th><th>Patient</th><th>Provider</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${schedule
        .map(
          (a) => `<tr>
            <td class="mono">${fmtTime(a.scheduled_at)}</td>
            <td><button class="nav-link" style="padding:0;color:var(--accent)" data-patient="${a.patient?.id}">${esc(a.patient?.full_name || "—")}</button></td>
            <td>${esc(a.provider?.full_name || "—")}</td>
            <td>${esc(a.reason || "—")}</td>
            <td>${statusSelect(a.id, a.status)}</td>
          </tr>`
        )
        .join("")}</tbody></table>`;

    el.querySelectorAll("button[data-patient]").forEach((b) =>
      b.addEventListener("click", () => renderPatientDetail(b.dataset.patient))
    );
    wireStatusSelects(el, renderDashboard);
  } catch (err) {
    main.innerHTML += `<p class="error">${esc(err.message)}</p>`;
  }
}

// ---- dashboard notice board ----------------------------------------------
function wireNotes() {
  const btn = $("add-note");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const input = $("note-input");
    const errEl = $("note-error");
    errEl.textContent = "";
    const body = input.value.trim();
    if (!body) return (errEl.textContent = "Write something first.");
    try {
      await withBusy(btn, async () => {
        unwrap(await sb.from("notes").insert({ body, created_by: CURRENT_USER }).select().single());
        input.value = "";
        toast("Note added");
        loadNotes();
      }, "Adding…");
    } catch (err) {
      errEl.textContent = friendly(err);
    }
  });
  loadNotes();
}

async function loadNotes() {
  const el = $("note-list");
  if (!el) return;
  try {
    const notes = unwrap(
      await sb.from("notes").select("*, author:created_by(full_name)").order("created_at", { ascending: false })
    );
    if (!notes.length) {
      el.innerHTML = emptyState("clipboard", "No notes yet", "Post the first note for the team.");
      return;
    }
    el.innerHTML = notes
      .map(
        (n) => `<div class="record" style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start">
          <div>
            <div style="white-space:pre-wrap">${esc(n.body)}</div>
            <div class="muted">${esc(n.author?.full_name || "Staff")} · ${fmtDateTime(n.created_at)}</div>
          </div>
          <button class="danger small" data-del-note="${n.id}">${icon("trash")}</button>
        </div>`
      )
      .join("");
    el.querySelectorAll("button[data-del-note]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!(await confirmDialog("Delete this note?"))) return;
        try {
          unwrap(await sb.from("notes").delete().eq("id", btn.dataset.delNote));
          toast("Note deleted");
          loadNotes();
        } catch (err) {
          toast(friendly(err), true);
        }
      })
    );
  } catch (err) {
    el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

// ==========================================================================
// PATIENT LIST
// ==========================================================================
async function renderPatientList() {
  CURRENT_PATIENT = null;
  setActiveNav("patients");
  main.innerHTML = `
    <div class="page-head">
      <h2>Patients</h2>
      <button class="primary" id="new-patient-btn">${icon("plus")} New patient</button>
    </div>
    <div class="toolbar"><input id="search" type="search" placeholder="Search by name or MRN…" /></div>
    <div class="card" id="patient-form-card" style="display:none"></div>
    <div class="card"><table>
      <thead><tr><th>MRN</th><th>Name</th><th>DOB</th><th>Phone</th></tr></thead>
      <tbody id="patient-rows">${skeletonRows(5, 4)}</tbody>
    </table></div>`;

  $("new-patient-btn").addEventListener("click", () => patientForm());
  const search = $("search");
  let t;
  search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => loadPatients(search.value), 250);
  });
  loadPatients("");
}

async function loadPatients(rawSearch) {
  const rows = $("patient-rows");
  const search = String(rawSearch || "").replace(/[,()%*\\"]/g, "").trim();
  try {
    let query = sb.from("patients").select("*").order("full_name");
    if (search) query = query.or(`full_name.ilike.%${search}%,mrn.ilike.%${search}%`);
    const patients = unwrap(await query);
    if (!patients.length) {
      rows.innerHTML = `<tr class="norow"><td colspan="4">${emptyState("users", "No patients found", "Try a different search, or add a new patient.")}</td></tr>`;
      return;
    }
    rows.innerHTML = patients
      .map(
        (p) => `<tr class="clickable" data-id="${p.id}">
          <td class="mono">${esc(p.mrn)}</td>
          <td>${esc(p.full_name)}</td>
          <td>${fmtDate(p.dob)}</td>
          <td>${esc(p.phone || "—")}</td>
        </tr>`
      )
      .join("");
    rows.querySelectorAll("tr").forEach((tr) =>
      tr.addEventListener("click", () => renderPatientDetail(tr.dataset.id))
    );
  } catch (err) {
    rows.innerHTML = `<tr class="norow"><td colspan="4" class="error">${esc(err.message)}</td></tr>`;
  }
}

function patientForm(existing = null) {
  const card = $("patient-form-card");
  if (!card) return;
  card.style.display = "block";
  card.innerHTML = `
    <h3>${existing ? "Edit patient" : "New patient"}</h3>
    <div class="grid-2">
      <div><label>MRN *</label><input id="f-mrn" value="${esc(existing?.mrn || "")}" placeholder="e.g. MRN-1042" /></div>
      <div><label>Full name *</label><input id="f-name" value="${esc(existing?.full_name || "")}" /></div>
      <div><label>Date of birth</label><input id="f-dob" type="date" value="${existing?.dob || ""}" /></div>
      <div><label>Phone</label><input id="f-phone" value="${esc(existing?.phone || "")}" /></div>
      <div><label>Email</label><input id="f-email" type="email" value="${esc(existing?.email || "")}" /></div>
      <div><label>Address</label><input id="f-address" value="${esc(existing?.address || "")}" /></div>
      <div><label>Gender</label>
        <select id="f-gender">
          <option value="" ${!existing?.gender ? "selected" : ""}>—</option>
          <option ${existing?.gender === "Female" ? "selected" : ""}>Female</option>
          <option ${existing?.gender === "Male" ? "selected" : ""}>Male</option>
          <option ${existing?.gender === "Other" ? "selected" : ""}>Other</option>
          <option ${existing?.gender === "Prefer not to say" ? "selected" : ""}>Prefer not to say</option>
        </select></div>
      <div><label>Blood type</label>
        <select id="f-blood">
          <option value="" ${!existing?.blood_type ? "selected" : ""}>—</option>
          ${["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bt) => `<option ${existing?.blood_type === bt ? "selected" : ""}>${bt}</option>`).join("")}
        </select></div>
      <div><label>Allergies</label><input id="f-allergies" value="${esc(existing?.allergies || "")}" placeholder="e.g. Penicillin" /></div>
      <div><label>Emergency contact</label><input id="f-emergency" value="${esc(existing?.emergency_contact || "")}" placeholder="Name & phone" /></div>
    </div>
    <p class="error" id="pf-error"></p>
    <div class="record-actions" style="margin-top:0.25rem">
      <button class="primary" id="save-patient">${icon("check")} ${existing ? "Save changes" : "Save patient"}</button>
      <button class="ghost" id="cancel-patient">${icon("x")} Cancel</button>
    </div>`;

  $("cancel-patient").addEventListener("click", () => (card.style.display = "none"));
  setTimeout(() => $("f-mrn")?.focus(), 0);
  wireFormKeys(card, () => $("save-patient").click(), () => (card.style.display = "none"));
  $("save-patient").addEventListener("click", async () => {
    const errEl = $("pf-error");
    errEl.textContent = "";
    const payload = {
      mrn: $("f-mrn").value.trim(),
      full_name: $("f-name").value.trim(),
      dob: $("f-dob").value || null,
      phone: $("f-phone").value.trim(),
      email: $("f-email").value.trim(),
      address: $("f-address").value.trim(),
      gender: $("f-gender").value || null,
      blood_type: $("f-blood").value || null,
      allergies: $("f-allergies").value.trim(),
      emergency_contact: $("f-emergency").value.trim(),
    };
    if (!payload.mrn || !payload.full_name)
      return (errEl.textContent = "MRN and full name are required.");
    try {
      await withBusy($("save-patient"), async () => {
        if (existing) {
          unwrap(await sb.from("patients").update(payload).eq("id", existing.id));
          toast("Patient updated");
          renderPatientDetail(existing.id);
        } else {
          payload.created_by = CURRENT_USER;
          unwrap(await sb.from("patients").insert(payload).select().single());
          toast("Patient added");
          card.style.display = "none";
          loadPatients("");
        }
      });
    } catch (err) {
      errEl.textContent = friendly(err, { "23505": "That MRN already exists — use a different one." });
    }
  });
}

// ==========================================================================
// PATIENT DETAIL
// ==========================================================================
async function renderPatientDetail(id) {
  CURRENT_PATIENT = id;
  setActiveNav("patients");
  main.innerHTML = `<div style="height:18px"></div>${skeletonCards(3)}`;

  let patient, appointments, visits, documents;
  try {
    patient = unwrap(await sb.from("patients").select("*").eq("id", id).single());
    [appointments, visits, documents] = await Promise.all([
      sb.from("appointments").select("*, provider:provider_id(full_name)").eq("patient_id", id).order("scheduled_at", { ascending: false }).then(unwrap),
      sb.from("visits").select("*, provider:provider_id(full_name), prescriptions(*)").eq("patient_id", id).order("visit_date", { ascending: false }).then(unwrap),
      sb.from("documents").select("*").eq("patient_id", id).order("created_at", { ascending: false }).then(unwrap),
    ]);
  } catch (err) {
    main.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`;
    return;
  }

  const yrs = age(patient.dob);
  main.innerHTML = `
    <button class="back-link" id="back">${icon("arrowLeft")} All patients</button>
    <div class="page-head"><h2>${esc(patient.full_name)}</h2></div>

    <div class="card">
      <div class="card-head">
        <h3>Details</h3>
        <div class="record-actions">
          <button class="ghost small" id="edit-patient">${icon("edit")} Edit</button>
          <button class="danger small" id="delete-patient">${icon("trash")} Delete</button>
        </div>
      </div>
      <dl class="dl">
        <dt>MRN</dt><dd class="mono">${esc(patient.mrn)}</dd>
        <dt>Date of birth</dt><dd>${fmtDate(patient.dob)}${yrs != null ? ` · ${yrs} yrs` : ""}</dd>
        <dt>Gender</dt><dd>${esc(patient.gender || "—")}</dd>
        <dt>Blood type</dt><dd>${esc(patient.blood_type || "—")}</dd>
        <dt>Allergies</dt><dd>${patient.allergies ? `<span class="allergy-flag">${esc(patient.allergies)}</span>` : "—"}</dd>
        <dt>Emergency contact</dt><dd>${esc(patient.emergency_contact || "—")}</dd>
        <dt>Phone</dt><dd>${esc(patient.phone || "—")}</dd>
        <dt>Email</dt><dd>${esc(patient.email || "—")}</dd>
        <dt>Address</dt><dd>${esc(patient.address || "—")}</dd>
      </dl>
      <div id="patient-form-card" style="display:none;margin-top:1rem"></div>
    </div>

    <div class="card">
      <h3>Book appointment</h3>
      <div class="row">
        <div class="shrink" style="min-width:200px"><label>Provider</label>
          <select id="a-provider">${providerOptions()}</select></div>
        <div class="shrink"><label>When</label><input id="a-when" type="datetime-local" /></div>
        <div class="shrink" style="min-width:90px"><label>Minutes</label>
          <input id="a-dur" type="number" value="30" min="5" step="5" /></div>
        <div><label>Reason</label><input id="a-reason" placeholder="Follow-up, check-up…" /></div>
        <div class="shrink"><button class="primary" id="save-appt">${icon("plus")} Book</button></div>
      </div>
      <p class="error" id="a-error"></p>
      <div id="appt-list" class="stack" style="margin-top:1rem"></div>
    </div>

    <div class="card">
      <h3>New visit note</h3>
      <div class="row">
        <div class="shrink" style="min-width:200px"><label>Provider</label>
          <select id="v-provider">${providerOptions()}</select></div>
        <div><label>Diagnosis</label><input id="v-dx" placeholder="Optional if notes given" /></div>
      </div>
      <label>Notes</label>
      <textarea id="v-notes" rows="3" placeholder="Chief complaint, findings, plan…"></textarea>
      <p class="error" id="v-error"></p>
      <button class="primary" id="save-visit" style="margin-top:0.75rem">${icon("check")} Save visit</button>
      <div id="visit-list" class="stack" style="margin-top:1.25rem"></div>
    </div>

    <div class="card">
      <h3>Documents</h3>
      <div class="row">
        <div><label>File (lab result, scan…)</label><input id="d-file" type="file" /></div>
        <div class="shrink" style="min-width:150px"><label>Kind</label>
          <input id="d-kind" placeholder="lab_result" /></div>
        <div class="shrink"><button class="primary" id="upload-doc">${icon("upload")} Upload</button></div>
      </div>
      <p class="error" id="d-error"></p>
      <div id="doc-list" class="stack" style="margin-top:1rem"></div>
    </div>`;

  $("back").addEventListener("click", renderPatientList);
  $("edit-patient").addEventListener("click", () => patientForm(patient));
  $("delete-patient").addEventListener("click", () => deletePatient(patient));
  renderAppointments(id, appointments);
  renderVisits(visits);
  renderDocuments(documents);

  $("save-appt").addEventListener("click", async () => {
    const errEl = $("a-error");
    errEl.textContent = "";
    try {
      if (!$("a-when").value) throw new Error("Pick a date and time.");
      if (new Date($("a-when").value) < new Date()) throw new Error("Appointment can't be in the past.");
      await withBusy($("save-appt"), async () => {
        unwrap(
          await sb.from("appointments").insert({
            patient_id: id,
            provider_id: $("a-provider").value,
            scheduled_at: new Date($("a-when").value).toISOString(),
            duration_min: Number($("a-dur").value) || 30,
            reason: $("a-reason").value.trim(),
          }).select().single()
        );
        toast("Appointment booked");
        renderPatientDetail(id);
      });
    } catch (err) {
      errEl.textContent = friendly(err);
    }
  });

  $("save-visit").addEventListener("click", async () => {
    const errEl = $("v-error");
    errEl.textContent = "";
    const diagnosis = $("v-dx").value.trim();
    const notes = $("v-notes").value.trim();
    if (!diagnosis && !notes) return (errEl.textContent = "Add a diagnosis or some notes before saving.");
    try {
      await withBusy($("save-visit"), async () => {
        unwrap(
          await sb.from("visits").insert({
            patient_id: id,
            provider_id: $("v-provider").value,
            diagnosis,
            notes,
          }).select().single()
        );
        toast("Visit saved");
        renderPatientDetail(id);
      });
    } catch (err) {
      errEl.textContent = friendly(err);
    }
  });

  $("upload-doc").addEventListener("click", () => uploadDocument(id));
}

async function deletePatient(patient) {
  if (!(await confirmDialog(`Delete ${patient.full_name} and all their appointments, visits, and documents? This cannot be undone.`, { confirmLabel: "Delete patient" })))
    return;
  try {
    unwrap(await sb.from("patients").delete().eq("id", patient.id));
    toast("Patient deleted");
    renderPatientList();
  } catch (err) {
    toast(friendly(err), true);
  }
}

function refreshCurrentPatient() {
  if (CURRENT_PATIENT) renderPatientDetail(CURRENT_PATIENT);
}

// ---- appointments (reschedule + delete) ----------------------------------
function renderAppointments(patientId, appts) {
  const el = $("appt-list");
  if (!appts?.length) return (el.innerHTML = emptyState("calendar", "No appointments yet"));
  el.innerHTML = appts
    .map(
      (a) => `<div class="record status-${a.status}" data-appt-row="${a.id}">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap">
          <div>
            <strong>${fmtDateTime(a.scheduled_at)}</strong> · ${esc(a.provider?.full_name || "—")}
            <div class="muted">${esc(a.reason || "No reason noted")} · ${a.duration_min || 30} min</div>
          </div>
          <div class="record-actions">
            ${statusSelect(a.id, a.status)}
            <button class="ghost small" data-edit-appt="${a.id}">${icon("edit")} Edit</button>
            <button class="danger small" data-del-appt="${a.id}">${icon("trash")} Delete</button>
          </div>
        </div>
        <div data-apptform="${a.id}"></div>
      </div>`
    )
    .join("");

  wireStatusSelects(el, refreshCurrentPatient);

  el.querySelectorAll("button[data-del-appt]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Delete this appointment?"))) return;
      try {
        unwrap(await sb.from("appointments").delete().eq("id", btn.dataset.delAppt));
        toast("Appointment deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );

  el.querySelectorAll("button[data-edit-appt]").forEach((btn) =>
    btn.addEventListener("click", () => showApptEdit(appts.find((x) => x.id === btn.dataset.editAppt)))
  );
}

function showApptEdit(a) {
  const holder = document.querySelector(`[data-apptform="${a.id}"]`);
  if (holder.dataset.open) { holder.innerHTML = ""; delete holder.dataset.open; return; }
  holder.dataset.open = "1";
  holder.innerHTML = `
    <div class="row" style="margin-top:0.75rem">
      <div class="shrink" style="min-width:180px"><label>Provider</label>
        <select data-f="prov">${providerOptions(a.provider_id)}</select></div>
      <div class="shrink"><label>When</label>
        <input data-f="when" type="datetime-local" value="${toLocalInput(a.scheduled_at)}" /></div>
      <div class="shrink" style="min-width:90px"><label>Minutes</label>
        <input data-f="dur" type="number" value="${a.duration_min || 30}" min="5" step="5" /></div>
      <div><label>Reason</label><input data-f="reason" value="${esc(a.reason || "")}" /></div>
      <div class="shrink"><button class="primary small" data-save-appt>${icon("check")} Save</button></div>
    </div>
    <p class="error" data-err></p>`;
  setTimeout(() => holder.querySelector('[data-f="when"]')?.focus(), 0);
  wireFormKeys(holder, () => holder.querySelector("[data-save-appt]").click(), () => { holder.innerHTML = ""; delete holder.dataset.open; });
  holder.querySelector("[data-save-appt]").addEventListener("click", async () => {
    const g = (f) => holder.querySelector(`[data-f="${f}"]`).value;
    const errEl = holder.querySelector("[data-err]");
    errEl.textContent = "";
    try {
      await withBusy(holder.querySelector("[data-save-appt]"), async () => {
        unwrap(
          await sb.from("appointments").update({
            provider_id: g("prov"),
            scheduled_at: new Date(g("when")).toISOString(),
            duration_min: Number(g("dur")) || 30,
            reason: g("reason").trim(),
          }).eq("id", a.id)
        );
        toast("Appointment updated");
        refreshCurrentPatient();
      });
    } catch (err) {
      errEl.textContent = friendly(err);
    }
  });
}

// ---- visits + prescriptions ----------------------------------------------
function renderVisits(visits) {
  const el = $("visit-list");
  if (!visits?.length) return (el.innerHTML = emptyState("clipboard", "No visit notes yet"));
  el.innerHTML = visits
    .map((v) => {
      const rx = (v.prescriptions || [])
        .map(
          (p) => `<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
            <span>${esc(p.medication)}${p.dosage ? " " + esc(p.dosage) : ""}${p.frequency ? " · " + esc(p.frequency) : ""}</span>
            <button class="danger small" data-del-rx="${p.id}">${icon("trash")}</button></div>`
        )
        .join("");
      return `<div class="record">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
          <strong>${fmtDateTime(v.visit_date)}</strong>
          <div class="record-actions">
            <span class="muted">${esc(v.provider?.full_name || "—")}</span>
            <button class="danger small" data-del-visit="${v.id}">${icon("trash")} Delete</button>
          </div>
        </div>
        ${v.diagnosis ? `<div style="margin-top:0.35rem"><em>Dx:</em> ${esc(v.diagnosis)}</div>` : ""}
        ${v.notes ? `<div style="margin-top:0.35rem">${esc(v.notes)}</div>` : ""}
        <div class="rx">${rx ? `<div style="margin-top:0.4rem">${rx}</div>` : ""}</div>
        <button class="ghost small" data-visit="${v.id}" style="margin-top:0.6rem">${icon("plus")} Add prescription</button>
        <div data-rxform="${v.id}"></div>
      </div>`;
    })
    .join("");

  el.querySelectorAll("button[data-visit]").forEach((btn) =>
    btn.addEventListener("click", () => showRxForm(btn.dataset.visit))
  );
  el.querySelectorAll("button[data-del-visit]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Delete this visit note and its prescriptions?"))) return;
      try {
        unwrap(await sb.from("visits").delete().eq("id", btn.dataset.delVisit));
        toast("Visit deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );
  el.querySelectorAll("button[data-del-rx]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        unwrap(await sb.from("prescriptions").delete().eq("id", btn.dataset.delRx));
        toast("Prescription removed");
        refreshCurrentPatient();
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );
}

function showRxForm(visitId) {
  const holder = document.querySelector(`[data-rxform="${visitId}"]`);
  if (holder.dataset.open) { holder.innerHTML = ""; delete holder.dataset.open; return; }
  holder.dataset.open = "1";
  holder.innerHTML = `
    <div class="row" style="margin-top:0.6rem">
      <div><label>Medication</label><input data-f="med" /></div>
      <div class="shrink" style="min-width:110px"><label>Dosage</label><input data-f="dose" placeholder="500mg" /></div>
      <div class="shrink" style="min-width:130px"><label>Frequency</label><input data-f="freq" placeholder="twice daily" /></div>
      <div class="shrink"><button class="primary small" data-save>${icon("plus")} Add</button></div>
    </div>
    <p class="error" data-err></p>`;
  setTimeout(() => holder.querySelector('[data-f="med"]')?.focus(), 0);
  wireFormKeys(holder, () => holder.querySelector("[data-save]").click(), () => { holder.innerHTML = ""; delete holder.dataset.open; });
  holder.querySelector("[data-save]").addEventListener("click", async () => {
    const get = (f) => holder.querySelector(`[data-f="${f}"]`).value.trim();
    const errEl = holder.querySelector("[data-err]");
    errEl.textContent = "";
    if (!get("med")) return (errEl.textContent = "Medication is required.");
    try {
      await withBusy(holder.querySelector("[data-save]"), async () => {
        unwrap(
          await sb.from("prescriptions").insert({
            visit_id: visitId,
            medication: get("med"),
            dosage: get("dose"),
            frequency: get("freq"),
          }).select().single()
        );
        toast("Prescription added");
        refreshCurrentPatient();
      });
    } catch (err) {
      errEl.textContent = friendly(err);
    }
  });
}

// ---- documents -----------------------------------------------------------
async function uploadDocument(patientId) {
  const file = $("d-file").files[0];
  const errEl = $("d-error");
  errEl.textContent = "";
  if (!file) return (errEl.textContent = "Choose a file first.");
  if (file.size > 50 * 1024 * 1024) return (errEl.textContent = "File is over the 50 MB free-tier limit.");
  try {
    await withBusy($("upload-doc"), async () => {
      const path = `${patientId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await sb.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      unwrap(
        await sb.from("documents").insert({
          patient_id: patientId,
          file_path: path,
          kind: $("d-kind").value.trim(),
          uploaded_by: CURRENT_USER,
        }).select().single()
      );
      toast("File uploaded");
      renderPatientDetail(patientId);
    }, "Uploading…");
  } catch (err) {
    errEl.textContent = friendly(err);
  }
}

function renderDocuments(docs) {
  const el = $("doc-list");
  if (!docs?.length) return (el.innerHTML = emptyState("file", "No documents uploaded"));
  el.innerHTML = docs
    .map(
      (d) => `<div class="record" style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
        <div>${esc(d.file_path.split("/").pop())}
          <span class="badge">${esc(d.kind || "file")}</span>
          <div class="muted">${fmtDateTime(d.created_at)}</div></div>
        <div class="record-actions">
          <button class="ghost small" data-open="${esc(d.file_path)}">${icon("external")} Open</button>
          <button class="danger small" data-del-doc="${d.id}" data-path="${esc(d.file_path)}">${icon("trash")} Delete</button>
        </div>
      </div>`
    )
    .join("");

  el.querySelectorAll("button[data-open]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const { data, error } = await sb.storage.from("documents").createSignedUrl(btn.dataset.open, 60);
        if (error) throw error;
        window.open(data.signedUrl, "_blank");
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );

  el.querySelectorAll("button[data-del-doc]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Delete this document?"))) return;
      try {
        await sb.storage.from("documents").remove([btn.dataset.path]);
        unwrap(await sb.from("documents").delete().eq("id", btn.dataset.delDoc));
        toast("Document deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(friendly(err), true);
      }
    })
  );
}
