# Clinic Patient Management System (school project)

A small full-stack patient management system.

- **Frontend** — plain HTML/CSS/JS (`frontend/`), deploys to Netlify
- **Backend** — Node.js + Express API (`backend/`), deploys to Render
- **Database + Auth + Storage** — Supabase

> Use fake/test data only. This project is not configured for real health information.

```
Browser ──auth──▶ Supabase Auth
   │
   └──data (Bearer token)──▶ Express API ──service key──▶ Supabase DB + Storage
```

The browser signs in directly with Supabase and gets an access token. Every data
request goes to the Express API with that token attached; the API verifies it,
then uses the Supabase **service key** (which never leaves the server) to read
and write the database.

---

## 1. Supabase

1. Create a project at supabase.com.
2. SQL editor → run `schema.sql`, then `seed.sql`.
3. Storage → create a bucket named **`documents`** (keep it private).
4. Authentication → Users → add a user (email + password). This is your staff
   login. The database trigger auto-creates their `profiles` row.
   - Tip: to set a name/role, edit that new row in the `profiles` table.
5. Project Settings → API — copy these for later:
   - Project URL
   - `anon` public key (for the frontend)
   - `service_role` secret key (for the backend)

## 2. Backend (local)

```bash
cd backend
npm install
cp .env.example .env      # then fill in SUPABASE_URL + SUPABASE_SERVICE_KEY
npm run dev               # starts on http://localhost:3000
```

Visit http://localhost:3000 — you should see `{"ok":true,...}`.

## 3. Frontend (local)

Edit `frontend/config.js` with your Supabase URL, anon key, and
`API_BASE: "http://localhost:3000"`.

Serve the folder with any static server, e.g.:

```bash
cd frontend
npx serve -l 5500        # or use the VS Code "Live Server" extension
```

Open the printed URL, sign in with the staff user you created, and you're in.

## 4. Deploy

**Backend → Render**
- New → Web Service → connect your repo, root directory `backend`.
- Build command `npm install`, start command `npm start`.
- Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and
  `ALLOWED_ORIGINS` (set this to your Netlify URL once you have it).
- Note: the free tier sleeps after ~15 min idle; the first request then takes
  30–60s to wake. Normal for free Render.

**Frontend → Netlify**
- Drag-and-drop the `frontend` folder, or connect the repo with publish
  directory `frontend`.
- Update `config.js` `API_BASE` to your Render URL and redeploy.
- Add the Netlify URL to the backend's `ALLOWED_ORIGINS` and redeploy the API.

---

## Files

```
clinic-pms/
├── schema.sql            database tables + RLS + signup trigger
├── seed.sql              12 fake patients
├── backend/
│   ├── server.js         Express API (auth middleware + routes)
│   ├── supabaseClient.js service-role client
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js            auth + views + API calls
    └── config.js         your keys go here
```

## API routes (all require `Authorization: Bearer <token>`)

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/me` | current user + profile |
| GET    | `/api/profiles` | staff list (provider dropdowns) |
| GET    | `/api/patients?search=` | list / search patients |
| POST   | `/api/patients` | add a patient |
| GET    | `/api/patients/:id` | full record (appts, visits, docs) |
| GET    | `/api/appointments?date=` | schedule |
| POST   | `/api/appointments` | book |
| PATCH  | `/api/appointments/:id` | change status |
| POST   | `/api/visits` | add visit note |
| POST   | `/api/prescriptions` | add prescription to a visit |
| POST   | `/api/documents` | record an uploaded file |
| GET    | `/api/documents/:id/url` | signed URL to view a file |
