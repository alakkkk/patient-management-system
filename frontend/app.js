const { SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE } = window.CONFIG;
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

// Authenticated call to the Express API
async function api(path, options = {}) {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

let PROVIDERS = []; // cached staff list for dropdowns

// ---- auth flow -----------------------------------------------------------
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
  // onAuthStateChange handles the successful case
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());
$("home-link").addEventListener("click", renderPatientList);

sb.auth.onAuthStateChange((_event, session) => {
  if (session) showApp();
  else showLogin();
});

async function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  try {
    const me = await api("/api/me");
    const name = me.profile?.full_name || me.user.email;
    const role = me.profile?.role ? ` · ${me.profile.role}` : "";
    $("who").textContent = `${name}${role}`;
    PROVIDERS = await api("/api/profiles");
    renderPatientList();
  } catch (err) {
    main.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p>
      <p class="muted">Is the API running and is API_BASE set correctly in config.js?</p></div>`;
  }
}

function showLogin() {
  $("app-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
}

const providerOptions = (selected) =>
  PROVIDERS.map(
    (p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.full_name)}</option>`
  ).join("");

// ---- patient list --------------------------------------------------------
async function renderPatientList() {
  main.innerHTML = `
    <div class="page-head">
      <h2>Patients</h2>
      <button class="primary" id="new-patient-btn">+ New patient</button>
    </div>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Search by name or MRN…" />
    </div>
    <div class="card" id="patient-form-card" style="display:none"></div>
    <div class="card"><table>
      <thead><tr><th>MRN</th><th>Name</th><th>DOB</th><th>Phone</th></tr></thead>
      <tbody id="patient-rows"><tr class="norow"><td colspan="4" class="empty">Loading…</td></tr></tbody>
    </table></div>`;

  $("new-patient-btn").addEventListener("click", togglePatientForm);
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
    const patients = await api(`/api/patients?search=${encodeURIComponent(search)}`);
    if (!patients.length) {
      rows.innerHTML = `<tr class="norow"><td colspan="4" class="empty">No patients found.</td></tr>`;
      return;
    }
    rows.innerHTML = patients
      .map(
        (p) => `<tr data-id="${p.id}">
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

function togglePatientForm() {
  const card = $("patient-form-card");
  if (card.style.display === "block") return (card.style.display = "none");
  card.style.display = "block";
  card.innerHTML = `
    <h3>New patient</h3>
    <div class="grid-2">
      <div><label>MRN *</label><input id="f-mrn" placeholder="e.g. MRN-1042" /></div>
      <div><label>Full name *</label><input id="f-name" /></div>
      <div><label>Date of birth</label><input id="f-dob" type="date" /></div>
      <div><label>Phone</label><input id="f-phone" /></div>
      <div><label>Email</label><input id="f-email" type="email" /></div>
      <div><label>Address</label><input id="f-address" /></div>
    </div>
    <p class="error" id="pf-error"></p>
    <button class="primary" id="save-patient">Save patient</button>`;
  $("save-patient").addEventListener("click", async () => {
    const payload = {
      mrn: $("f-mrn").value.trim(),
      full_name: $("f-name").value.trim(),
      dob: $("f-dob").value || null,
      phone: $("f-phone").value.trim(),
      email: $("f-email").value.trim(),
      address: $("f-address").value.trim(),
    };
    try {
      await api("/api/patients", { method: "POST", body: JSON.stringify(payload) });
      card.style.display = "none";
      loadPatients("");
    } catch (err) {
      $("pf-error").textContent = err.message;
    }
  });
}

// ---- patient detail ------------------------------------------------------
async function renderPatientDetail(id) {
  main.innerHTML = `<p class="empty">Loading record…</p>`;
  let record;
  try {
    record = await api(`/api/patients/${id}`);
  } catch (err) {
    main.innerHTML = `<div class="card"><p class="error">${esc(err.message)}</p></div>`;
    return;
  }
  const { patient, appointments, visits, documents } = record;

  main.innerHTML = `
    <button class="back-link" id="back">← All patients</button>
    <div class="page-head"><h2>${esc(patient.full_name)}</h2></div>

    <div class="card">
      <h3>Details</h3>
      <dl class="dl">
        <dt>MRN</dt><dd class="mono">${esc(patient.mrn)}</dd>
        <dt>Date of birth</dt><dd>${fmtDate(patient.dob)}</dd>
        <dt>Phone</dt><dd>${esc(patient.phone || "—")}</dd>
        <dt>Email</dt><dd>${esc(patient.email || "—")}</dd>
        <dt>Address</dt><dd>${esc(patient.address || "—")}</dd>
      </dl>
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
  renderAppointments(appointments);
  renderVisits(visits);
  renderDocuments(documents);

  $("save-appt").addEventListener("click", async () => {
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: id,
          provider_id: $("a-provider").value,
          scheduled_at: new Date($("a-when").value).toISOString(),
          duration_min: Number($("a-dur").value) || 30,
          reason: $("a-reason").value.trim(),
        }),
      });
      renderPatientDetail(id);
    } catch (err) {
      $("a-error").textContent = err.message;
    }
  });

  $("save-visit").addEventListener("click", async () => {
    try {
      await api("/api/visits", {
        method: "POST",
        body: JSON.stringify({
          patient_id: id,
          provider_id: $("v-provider").value,
          diagnosis: $("v-dx").value.trim(),
          notes: $("v-notes").value.trim(),
        }),
      });
      renderPatientDetail(id);
    } catch (err) {
      $("v-error").textContent = err.message;
    }
  });

  $("upload-doc").addEventListener("click", () => uploadDocument(id));
}

function renderAppointments(appts) {
  const el = $("appt-list");
  if (!appts?.length) return (el.innerHTML = `<p class="empty">No appointments yet.</p>`);
  const STATUSES = ["scheduled", "checked_in", "completed", "cancelled", "no_show"];
  el.innerHTML = appts
    .map(
      (a) => `<div class="record">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap">
          <div>
            <strong>${fmtDateTime(a.scheduled_at)}</strong> · ${esc(a.provider?.full_name || "—")}
            <div class="muted">${esc(a.reason || "No reason noted")}</div>
          </div>
          <select data-appt="${a.id}" class="shrink" style="max-width:150px">
            ${STATUSES.map((s) => `<option value="${s}" ${s === a.status ? "selected" : ""}>${s.replace("_", " ")}</option>`).join("")}
          </select>
        </div>
      </div>`
    )
    .join("");
  el.querySelectorAll("select[data-appt]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      try {
        await api(`/api/appointments/${sel.dataset.appt}`, {
          method: "PATCH",
          body: JSON.stringify({ status: sel.value }),
        });
      } catch (err) {
        alert(err.message);
      }
    })
  );
}

function renderVisits(visits) {
  const el = $("visit-list");
  if (!visits?.length) return (el.innerHTML = `<p class="empty">No visit notes yet.</p>`);
  el.innerHTML = visits
    .map((v) => {
      const rx = (v.prescriptions || [])
        .map((p) => `${esc(p.medication)}${p.dosage ? " " + esc(p.dosage) : ""}${p.frequency ? " · " + esc(p.frequency) : ""}`)
        .join("<br>");
      return `<div class="record">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
          <strong>${fmtDateTime(v.visit_date)}</strong>
          <span class="muted">${esc(v.provider?.full_name || "—")}</span>
        </div>
        ${v.diagnosis ? `<div style="margin-top:0.35rem"><em>Dx:</em> ${esc(v.diagnosis)}</div>` : ""}
        ${v.notes ? `<div style="margin-top:0.35rem">${esc(v.notes)}</div>` : ""}
        <div class="rx">${rx ? "Rx: " + rx : ""}</div>
        <button class="ghost small" data-visit="${v.id}" style="margin-top:0.6rem">+ Add prescription</button>
        <div data-rxform="${v.id}"></div>
      </div>`;
    })
    .join("");
  el.querySelectorAll("button[data-visit]").forEach((btn) =>
    btn.addEventListener("click", () => showRxForm(btn.dataset.visit))
  );
}

function showRxForm(visitId) {
  const holder = document.querySelector(`[data-rxform="${visitId}"]`);
  if (holder.dataset.open) {
    holder.innerHTML = "";
    delete holder.dataset.open;
    return;
  }
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
      await api("/api/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          visit_id: visitId,
          medication: get("med"),
          dosage: get("dose"),
          frequency: get("freq"),
        }),
      });
      refreshCurrentPatient(); // reload the detail view to show the new Rx
    } catch (err) {
      holder.querySelector("[data-err]").textContent = err.message;
    }
  });
}

// remembers which patient detail is open so we can refresh after edits
let CURRENT_PATIENT = null;
const _origDetail = renderPatientDetail;
renderPatientDetail = async function (id) {
  CURRENT_PATIENT = id;
  return _origDetail(id);
};
function refreshCurrentPatient() {
  if (CURRENT_PATIENT) renderPatientDetail(CURRENT_PATIENT);
}

async function uploadDocument(patientId) {
  const fileInput = $("d-file");
  const file = fileInput.files[0];
  const errEl = $("d-error");
  errEl.textContent = "";
  if (!file) return (errEl.textContent = "Choose a file first.");
  try {
    const path = `${patientId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from("documents").upload(path, file);
    if (upErr) throw upErr;
    await api("/api/documents", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, file_path: path, kind: $("d-kind").value.trim() }),
    });
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
        <button class="ghost small" data-doc="${d.id}">Open</button>
      </div>`
    )
    .join("");
  el.querySelectorAll("button[data-doc]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const { url } = await api(`/api/documents/${btn.dataset.doc}/url`);
        window.open(url, "_blank");
      } catch (err) {
        alert(err.message);
      }
    })
  );
}
