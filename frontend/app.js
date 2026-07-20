const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const main = $("main");

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

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// convert a stored ISO timestamp into a value a datetime-local input accepts
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

// lightweight toast for success / error feedback
let toastTimer;
function toast(msg, isError = false) {
  let el = $("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = isError ? "err show" : "show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = el.className.replace("show", "").trim()), 2600);
}

const STATUSES = ["scheduled", "checked_in", "completed", "cancelled", "no_show"];
let PROVIDERS = [];
let CURRENT_USER = null;
let CURRENT_PATIENT = null;

// ---- auth ----------------------------------------------------------------
$("login-btn").addEventListener("click", async () => {
  const btn = $("login-btn");
  const email = $("email").value.trim();
  const password = $("password").value;
  $("login-error").textContent = "";
  btn.disabled = true;
  btn.textContent = "Signing in…";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = "Sign in";
  if (error) $("login-error").textContent = error.message;
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());
$("home-link").addEventListener("click", renderDashboard);
$("nav-dashboard").addEventListener("click", renderDashboard);
$("nav-patients").addEventListener("click", renderPatientList);

sb.auth.onAuthStateChange((_event, session) => {
  if (session) showApp();
  else showLogin();
});

async function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
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
  $("login-view").classList.remove("hidden");
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
        toast(err.message, true);
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
      <div class="stat"><div class="num" id="s-patients">—</div><div class="lbl">Total patients</div></div>
      <div class="stat"><div class="num" id="s-today">—</div><div class="lbl">Appointments today</div></div>
      <div class="stat"><div class="num" id="s-upcoming">—</div><div class="lbl">Upcoming (scheduled)</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Today's schedule</h3></div>
      <div id="schedule"><p class="empty">Loading…</p></div>
    </div>`;

  try {
    const { start, end } = todayBounds();
    const nowIso = new Date().toISOString();

    const [patientCount, todayCount, upcomingCount, schedule] = await Promise.all([
      sb.from("patients").select("id", { count: "exact", head: true }),
      sb.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", start).lte("scheduled_at", end),
      sb.from("appointments").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", nowIso),
      sb.from("appointments")
        .select("*, patient:patient_id(id, full_name, mrn), provider:provider_id(full_name)")
        .gte("scheduled_at", start).lte("scheduled_at", end)
        .order("scheduled_at")
        .then(unwrap),
    ]);

    $("s-patients").textContent = patientCount.count ?? 0;
    $("s-today").textContent = todayCount.count ?? 0;
    $("s-upcoming").textContent = upcomingCount.count ?? 0;

    const el = $("schedule");
    if (!schedule.length) {
      el.innerHTML = `<p class="empty">No appointments scheduled for today.</p>`;
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

// ==========================================================================
// PATIENT LIST
// ==========================================================================
async function renderPatientList() {
  CURRENT_PATIENT = null;
  setActiveNav("patients");
  main.innerHTML = `
    <div class="page-head">
      <h2>Patients</h2>
      <button class="primary" id="new-patient-btn">+ New patient</button>
    </div>
    <div class="toolbar"><input id="search" type="search" placeholder="Search by name or MRN…" /></div>
    <div class="card" id="patient-form-card" style="display:none"></div>
    <div class="card"><table>
      <thead><tr><th>MRN</th><th>Name</th><th>DOB</th><th>Phone</th></tr></thead>
      <tbody id="patient-rows"><tr class="norow"><td colspan="4" class="empty">Loading…</td></tr></tbody>
    </table></div>`;

  $("new-patient-btn").addEventListener("click", () => patientForm());
  const search = $("search");
  let t;
  search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => loadPatients(search.value.trim()), 250);
  });
  loadPatients("");
}

async function loadPatients(search) {
  const rows = $("patient-rows");
  try {
    let query = sb.from("patients").select("*").order("full_name");
    if (search) query = query.or(`full_name.ilike.%${search}%,mrn.ilike.%${search}%`);
    const patients = unwrap(await query);
    if (!patients.length) {
      rows.innerHTML = `<tr class="norow"><td colspan="4" class="empty">No patients found.</td></tr>`;
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

// shared form for both "new" and "edit" patient
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
    </div>
    <p class="error" id="pf-error"></p>
    <div class="record-actions" style="margin-top:0.25rem">
      <button class="primary" id="save-patient">${existing ? "Save changes" : "Save patient"}</button>
      <button class="ghost" id="cancel-patient">Cancel</button>
    </div>`;

  $("cancel-patient").addEventListener("click", () => (card.style.display = "none"));
  $("save-patient").addEventListener("click", async () => {
    const payload = {
      mrn: $("f-mrn").value.trim(),
      full_name: $("f-name").value.trim(),
      dob: $("f-dob").value || null,
      phone: $("f-phone").value.trim(),
      email: $("f-email").value.trim(),
      address: $("f-address").value.trim(),
    };
    if (!payload.mrn || !payload.full_name)
      return ($("pf-error").textContent = "MRN and full name are required.");
    try {
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
    } catch (err) {
      $("pf-error").textContent = err.message;
    }
  });
}

// ==========================================================================
// PATIENT DETAIL
// ==========================================================================
async function renderPatientDetail(id) {
  CURRENT_PATIENT = id;
  setActiveNav("patients");
  main.innerHTML = `<p class="empty">Loading record…</p>`;

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

  main.innerHTML = `
    <button class="back-link" id="back">← All patients</button>
    <div class="page-head"><h2>${esc(patient.full_name)}</h2></div>

    <div class="card">
      <div class="card-head">
        <h3>Details</h3>
        <div class="record-actions">
          <button class="ghost small" id="edit-patient">Edit</button>
          <button class="danger small" id="delete-patient">Delete</button>
        </div>
      </div>
      <dl class="dl">
        <dt>MRN</dt><dd class="mono">${esc(patient.mrn)}</dd>
        <dt>Date of birth</dt><dd>${fmtDate(patient.dob)}</dd>
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
        <div class="shrink"><button class="primary" id="save-appt">Book</button></div>
      </div>
      <p class="error" id="a-error"></p>
      <div id="appt-list" class="stack" style="margin-top:1rem"></div>
    </div>

    <div class="card">
      <h3>New visit note</h3>
      <div class="row">
        <div class="shrink" style="min-width:200px"><label>Provider</label>
          <select id="v-provider">${providerOptions()}</select></div>
        <div><label>Diagnosis</label><input id="v-dx" placeholder="Optional" /></div>
      </div>
      <label>Notes</label>
      <textarea id="v-notes" rows="3" placeholder="Chief complaint, findings, plan…"></textarea>
      <p class="error" id="v-error"></p>
      <button class="primary" id="save-visit" style="margin-top:0.75rem">Save visit</button>
      <div id="visit-list" class="stack" style="margin-top:1.25rem"></div>
    </div>

    <div class="card">
      <h3>Documents</h3>
      <div class="row">
        <div><label>File (lab result, scan…)</label><input id="d-file" type="file" /></div>
        <div class="shrink" style="min-width:150px"><label>Kind</label>
          <input id="d-kind" placeholder="lab_result" /></div>
        <div class="shrink"><button class="primary" id="upload-doc">Upload</button></div>
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
    try {
      if (!$("a-when").value) throw new Error("Pick a date and time.");
      if (new Date($("a-when").value) < new Date())
        throw new Error("Appointment can't be in the past.");
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
    } catch (err) {
      $("a-error").textContent = err.message;
    }
  });

  $("save-visit").addEventListener("click", async () => {
    try {
      unwrap(
        await sb.from("visits").insert({
          patient_id: id,
          provider_id: $("v-provider").value,
          diagnosis: $("v-dx").value.trim(),
          notes: $("v-notes").value.trim(),
        }).select().single()
      );
      toast("Visit saved");
      renderPatientDetail(id);
    } catch (err) {
      $("v-error").textContent = err.message;
    }
  });

  $("upload-doc").addEventListener("click", () => uploadDocument(id));
}

async function deletePatient(patient) {
  if (!confirm(`Delete ${patient.full_name} and all their appointments, visits, and documents? This cannot be undone.`))
    return;
  try {
    unwrap(await sb.from("patients").delete().eq("id", patient.id));
    toast("Patient deleted");
    renderPatientList();
  } catch (err) {
    toast(err.message, true);
  }
}

function refreshCurrentPatient() {
  if (CURRENT_PATIENT) renderPatientDetail(CURRENT_PATIENT);
}

// ---- appointments (with reschedule + delete) -----------------------------
function renderAppointments(patientId, appts) {
  const el = $("appt-list");
  if (!appts?.length) return (el.innerHTML = `<p class="empty">No appointments yet.</p>`);
  el.innerHTML = appts
    .map(
      (a) => `<div class="record" data-appt-row="${a.id}">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap">
          <div>
            <strong>${fmtDateTime(a.scheduled_at)}</strong> · ${esc(a.provider?.full_name || "—")}
            <div class="muted">${esc(a.reason || "No reason noted")} · ${a.duration_min || 30} min</div>
          </div>
          <div class="record-actions">
            ${statusSelect(a.id, a.status)}
            <button class="ghost small" data-edit-appt="${a.id}">Edit</button>
            <button class="danger small" data-del-appt="${a.id}">Delete</button>
          </div>
        </div>
        <div data-apptform="${a.id}"></div>
      </div>`
    )
    .join("");

  wireStatusSelects(el, refreshCurrentPatient);

  el.querySelectorAll("button[data-del-appt]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this appointment?")) return;
      try {
        unwrap(await sb.from("appointments").delete().eq("id", btn.dataset.delAppt));
        toast("Appointment deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(err.message, true);
      }
    })
  );

  el.querySelectorAll("button[data-edit-appt]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const a = appts.find((x) => x.id === btn.dataset.editAppt);
      showApptEdit(a);
    })
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
      <div class="shrink"><button class="primary small" data-save-appt>Save</button></div>
    </div>
    <p class="error" data-err></p>`;
  holder.querySelector("[data-save-appt]").addEventListener("click", async () => {
    const g = (f) => holder.querySelector(`[data-f="${f}"]`).value;
    try {
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
    } catch (err) {
      holder.querySelector("[data-err]").textContent = err.message;
    }
  });
}

// ---- visits (with delete) + prescriptions (add + delete) -----------------
function renderVisits(visits) {
  const el = $("visit-list");
  if (!visits?.length) return (el.innerHTML = `<p class="empty">No visit notes yet.</p>`);
  el.innerHTML = visits
    .map((v) => {
      const rx = (v.prescriptions || [])
        .map(
          (p) => `<div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
            <span>${esc(p.medication)}${p.dosage ? " " + esc(p.dosage) : ""}${p.frequency ? " · " + esc(p.frequency) : ""}</span>
            <button class="danger small" data-del-rx="${p.id}">×</button></div>`
        )
        .join("");
      return `<div class="record">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
          <strong>${fmtDateTime(v.visit_date)}</strong>
          <div class="record-actions">
            <span class="muted">${esc(v.provider?.full_name || "—")}</span>
            <button class="danger small" data-del-visit="${v.id}">Delete</button>
          </div>
        </div>
        ${v.diagnosis ? `<div style="margin-top:0.35rem"><em>Dx:</em> ${esc(v.diagnosis)}</div>` : ""}
        ${v.notes ? `<div style="margin-top:0.35rem">${esc(v.notes)}</div>` : ""}
        <div class="rx">${rx ? `<div style="margin-top:0.4rem">${rx}</div>` : ""}</div>
        <button class="ghost small" data-visit="${v.id}" style="margin-top:0.6rem">+ Add prescription</button>
        <div data-rxform="${v.id}"></div>
      </div>`;
    })
    .join("");

  el.querySelectorAll("button[data-visit]").forEach((btn) =>
    btn.addEventListener("click", () => showRxForm(btn.dataset.visit))
  );
  el.querySelectorAll("button[data-del-visit]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this visit note and its prescriptions?")) return;
      try {
        unwrap(await sb.from("visits").delete().eq("id", btn.dataset.delVisit));
        toast("Visit deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(err.message, true);
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
        toast(err.message, true);
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
      <div class="shrink"><button class="primary small" data-save>Add</button></div>
    </div>
    <p class="error" data-err></p>`;
  holder.querySelector("[data-save]").addEventListener("click", async () => {
    const get = (f) => holder.querySelector(`[data-f="${f}"]`).value.trim();
    try {
      if (!get("med")) throw new Error("Medication is required.");
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
    } catch (err) {
      holder.querySelector("[data-err]").textContent = err.message;
    }
  });
}

// ---- documents (upload + open + delete) ----------------------------------
async function uploadDocument(patientId) {
  const file = $("d-file").files[0];
  const errEl = $("d-error");
  errEl.textContent = "";
  if (!file) return (errEl.textContent = "Choose a file first.");
  if (file.size > 50 * 1024 * 1024)
    return (errEl.textContent = "File is over the 50 MB free-tier limit.");
  try {
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
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function renderDocuments(docs) {
  const el = $("doc-list");
  if (!docs?.length) return (el.innerHTML = `<p class="empty">No documents uploaded.</p>`);
  el.innerHTML = docs
    .map(
      (d) => `<div class="record" style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
        <div>${esc(d.file_path.split("/").pop())}
          <span class="badge">${esc(d.kind || "file")}</span>
          <div class="muted">${fmtDateTime(d.created_at)}</div></div>
        <div class="record-actions">
          <button class="ghost small" data-open="${esc(d.file_path)}">Open</button>
          <button class="danger small" data-del-doc="${d.id}" data-path="${esc(d.file_path)}">Delete</button>
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
        toast(err.message, true);
      }
    })
  );

  el.querySelectorAll("button[data-del-doc]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this document?")) return;
      try {
        await sb.storage.from("documents").remove([btn.dataset.path]); // remove the file
        unwrap(await sb.from("documents").delete().eq("id", btn.dataset.delDoc)); // remove the row
        toast("Document deleted");
        refreshCurrentPatient();
      } catch (err) {
        toast(err.message, true);
      }
    })
  );
}
