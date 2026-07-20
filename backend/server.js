import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const app = express();
app.use(express.json());

// --- CORS -----------------------------------------------------------------
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // allow tools like curl / same-origin (no origin header)
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

// --- Auth middleware ------------------------------------------------------
// Every /api request must carry a valid Supabase access token:
//   Authorization: Bearer <token>
// We verify it and attach the user + their staff profile to req.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    req.profile = profile || null;

    next();
  } catch (err) {
    console.error("auth error:", err);
    res.status(500).json({ error: "Auth check failed" });
  }
}

// small helper to keep route bodies tidy
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  });

// --- Health check (used to keep Render awake / verify deploy) --------------
app.get("/", (_req, res) => res.json({ ok: true, service: "clinic-pms-api" }));

// Everything below requires a logged-in staff member
app.use("/api", requireAuth);

// --- Who am I -------------------------------------------------------------
app.get(
  "/api/me",
  wrap(async (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email }, profile: req.profile });
  })
);

// --- Staff profiles (for provider dropdowns) ------------------------------
app.get(
  "/api/profiles",
  wrap(async (_req, res) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name");
    if (error) throw error;
    res.json(data);
  })
);

// --- Patients -------------------------------------------------------------
app.get(
  "/api/patients",
  wrap(async (req, res) => {
    const search = (req.query.search || "").trim();
    let query = supabase.from("patients").select("*").order("full_name");
    if (search) query = query.or(`full_name.ilike.%${search}%,mrn.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  })
);

// Full patient record: details + appointments + visits + documents
app.get(
  "/api/patients/:id",
  wrap(async (req, res) => {
    const { id } = req.params;

    const { data: patient, error: pErr } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();
    if (pErr) return res.status(404).json({ error: "Patient not found" });

    const [{ data: appointments }, { data: visits }, { data: documents }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("*, provider:provider_id(full_name)")
          .eq("patient_id", id)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("visits")
          .select("*, provider:provider_id(full_name), prescriptions(*)")
          .eq("patient_id", id)
          .order("visit_date", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .eq("patient_id", id)
          .order("created_at", { ascending: false }),
      ]);

    res.json({ patient, appointments, visits, documents });
  })
);

app.post(
  "/api/patients",
  wrap(async (req, res) => {
    const { mrn, full_name, dob, phone, email, address } = req.body;
    if (!mrn || !full_name)
      return res.status(400).json({ error: "mrn and full_name are required" });

    const { data, error } = await supabase
      .from("patients")
      .insert({ mrn, full_name, dob: dob || null, phone, email, address, created_by: req.user.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  })
);

// --- Appointments ---------------------------------------------------------
app.get(
  "/api/appointments",
  wrap(async (req, res) => {
    // optional ?date=YYYY-MM-DD to show one day's schedule
    let query = supabase
      .from("appointments")
      .select("*, patient:patient_id(full_name, mrn), provider:provider_id(full_name)")
      .order("scheduled_at");
    if (req.query.date) {
      const day = req.query.date;
      query = query.gte("scheduled_at", `${day}T00:00:00`).lte("scheduled_at", `${day}T23:59:59`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  })
);

app.post(
  "/api/appointments",
  wrap(async (req, res) => {
    const { patient_id, provider_id, scheduled_at, duration_min, reason } = req.body;
    if (!patient_id || !provider_id || !scheduled_at)
      return res
        .status(400)
        .json({ error: "patient_id, provider_id and scheduled_at are required" });

    const { data, error } = await supabase
      .from("appointments")
      .insert({ patient_id, provider_id, scheduled_at, duration_min: duration_min || 30, reason })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  })
);

app.patch(
  "/api/appointments/:id",
  wrap(async (req, res) => {
    const { status } = req.body; // scheduled | checked_in | completed | cancelled | no_show
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  })
);

// --- Visits (clinical notes) ---------------------------------------------
app.post(
  "/api/visits",
  wrap(async (req, res) => {
    const { patient_id, provider_id, appointment_id, notes, diagnosis } = req.body;
    if (!patient_id || !provider_id)
      return res.status(400).json({ error: "patient_id and provider_id are required" });

    const { data, error } = await supabase
      .from("visits")
      .insert({ patient_id, provider_id, appointment_id: appointment_id || null, notes, diagnosis })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  })
);

// --- Prescriptions --------------------------------------------------------
app.post(
  "/api/prescriptions",
  wrap(async (req, res) => {
    const { visit_id, medication, dosage, frequency, duration, notes } = req.body;
    if (!visit_id || !medication)
      return res.status(400).json({ error: "visit_id and medication are required" });

    const { data, error } = await supabase
      .from("prescriptions")
      .insert({ visit_id, medication, dosage, frequency, duration, notes })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  })
);

// --- Documents ------------------------------------------------------------
// The browser uploads the file straight to Supabase Storage, then tells us
// the resulting path so we can record the metadata row here.
app.post(
  "/api/documents",
  wrap(async (req, res) => {
    const { patient_id, file_path, kind } = req.body;
    if (!patient_id || !file_path)
      return res.status(400).json({ error: "patient_id and file_path are required" });

    const { data, error } = await supabase
      .from("documents")
      .insert({ patient_id, file_path, kind, uploaded_by: req.user.id })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  })
);

// Return a short-lived signed URL so the frontend can view a stored file
app.get(
  "/api/documents/:id/url",
  wrap(async (req, res) => {
    const { data: doc, error } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "Document not found" });

    const { data: signed, error: sErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (sErr) throw sErr;
    res.json({ url: signed.signedUrl });
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`clinic-pms API listening on :${port}`));
