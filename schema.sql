-- ============================================================
-- Clinic Patient Management System — Supabase / Postgres schema
-- Paste this into the Supabase SQL editor and run it.
-- School project: use FAKE patient data only.
-- ============================================================

-- Enums for constrained fields ------------------------------
create type staff_role as enum ('admin', 'doctor', 'nurse', 'receptionist');
create type appt_status as enum ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show');

-- 1. STAFF PROFILES -----------------------------------------
-- Extends Supabase's built-in auth.users. One row per staff login.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        staff_role not null default 'receptionist',
  email       text,
  created_at  timestamptz not null default now()
);

-- 2. PATIENTS ------------------------------------------------
create table patients (
  id          uuid primary key default gen_random_uuid(),
  mrn         text unique not null,          -- medical record number
  full_name   text not null,
  dob         date,
  phone       text,
  email       text,
  address     text,
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles (id)
);

-- 3. APPOINTMENTS -------------------------------------------
create table appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients (id) on delete cascade,
  provider_id   uuid not null references profiles (id),
  scheduled_at  timestamptz not null,
  duration_min  int not null default 30,
  status        appt_status not null default 'scheduled',
  reason        text,
  created_at    timestamptz not null default now()
);

-- 4. VISITS (clinical encounters) ---------------------------
create table visits (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references appointments (id) on delete set null,
  patient_id      uuid not null references patients (id) on delete cascade,
  provider_id     uuid not null references profiles (id),
  visit_date      timestamptz not null default now(),
  notes           text,                       -- SOAP notes, chief complaint, etc.
  diagnosis       text,
  created_at      timestamptz not null default now()
);

-- 5. PRESCRIPTIONS ------------------------------------------
create table prescriptions (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references visits (id) on delete cascade,
  medication   text not null,
  dosage       text,
  frequency    text,
  duration     text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- 6. DOCUMENTS (files live in Supabase Storage; this is metadata)
create table documents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients (id) on delete cascade,
  file_path    text not null,                 -- path inside the storage bucket
  kind         text,                          -- 'lab_result', 'scan', 'referral'...
  uploaded_by  uuid references profiles (id),
  created_at   timestamptz not null default now()
);

-- Helpful indexes -------------------------------------------
create index on appointments (patient_id);
create index on appointments (provider_id);
create index on appointments (scheduled_at);
create index on visits (patient_id);
create index on prescriptions (visit_id);
create index on documents (patient_id);

-- ============================================================
-- Row Level Security
-- Simple model for a school project: any authenticated staff
-- member may read/write all clinical data. In a real system
-- you'd scope this far more tightly (e.g. providers see only
-- their own patients).
-- ============================================================
alter table profiles      enable row level security;
alter table patients      enable row level security;
alter table appointments  enable row level security;
alter table visits        enable row level security;
alter table prescriptions enable row level security;
alter table documents     enable row level security;

-- Every logged-in user can see all staff profiles
create policy "staff read profiles"
  on profiles for select using (auth.role() = 'authenticated');

-- A user can update their own profile row
create policy "update own profile"
  on profiles for update using (auth.uid() = id);

-- Clinical tables: any authenticated staff member gets full access.
-- (Repeat this pattern per table.)
create policy "staff full access patients"      on patients      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff full access appointments"  on appointments  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff full access visits"        on visits        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff full access prescriptions" on prescriptions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff full access documents"     on documents     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New staff'), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
