-- PU Chronicles — initial schema
-- Security model: base tables are locked down entirely (no grants to anon/authenticated).
-- All student-facing reads go through SECURITY DEFINER functions that check the caller's
-- email domain themselves and return only an explicit allowlist of visible fields.
-- The only role that ever touches the base tables directly is service_role (import script).

create extension if not exists pgcrypto;

create type track_enum as enum ('placements', 'sip');

create table companies (
  id uuid primary key default gen_random_uuid(),
  track track_enum not null,
  canonical_name text not null,
  aliases text[] not null default '{}',
  sector text,
  created_at timestamptz not null default now(),
  unique (track, canonical_name)
);

create table field_definitions (
  key text primary key,
  label text not null,
  category text not null check (category in ('identifying', 'sensitive', 'context', 'core', 'internal')),
  visible_to_students boolean not null default false,
  display_order int not null,
  -- locked fields can never be toggled visible, even via the Supabase Table Editor.
  -- Protects the fields the site must never show under any circumstance (name/email/ID,
  -- plus the SIP-2022-23 form-meta questions that are feedback to the coordinator, not
  -- chronicle content).
  locked boolean not null default false
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  track track_enum not null,
  cycle_label text not null,
  submitted_at timestamptz,
  source_file text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  track track_enum not null,
  cycle_label text not null,
  imported_at timestamptz not null default now(),
  row_count int not null
);

create index responses_company_id_idx on responses (company_id);
create index companies_track_idx on companies (track);

-- Enforce the locked-field guarantee at the database level, not just in app code.
create or replace function enforce_locked_field_visibility()
returns trigger
language plpgsql
as $$
begin
  if new.locked and new.visible_to_students then
    raise exception 'field "%" is locked and cannot be made visible to students', new.key;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_locked_field_visibility
before insert or update on field_definitions
for each row execute function enforce_locked_field_visibility();

-- Lock down base tables: RLS on with zero policies = default deny for anon/authenticated.
-- service_role bypasses RLS entirely (used only by the import script).
alter table companies enable row level security;
alter table field_definitions enable row level security;
alter table responses enable row level security;
alter table import_batches enable row level security;

revoke all on companies, field_definitions, responses, import_batches from anon, authenticated;

-- ── Student-facing surface ──────────────────────────────────────────────────────────
-- Every function below checks the caller's JWT email domain itself, so access control
-- doesn't rely on the Next.js app remembering to check it. Domain is also checked in
-- Next.js proxy.ts as a first line of defense — this is the second, authoritative one.

create or replace function is_allowed_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@goa.bits-pilani.ac.in', false);
$$;

create or replace function list_companies(p_track track_enum)
returns table (id uuid, canonical_name text, sector text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.canonical_name, c.sector
  from companies c
  where is_allowed_student() and c.track = p_track
  order by c.canonical_name;
$$;

grant execute on function list_companies(track_enum) to authenticated;

create or replace function get_company(p_company_id uuid)
returns table (id uuid, canonical_name text, track track_enum, sector text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.canonical_name, c.track, c.sector
  from companies c
  where is_allowed_student() and c.id = p_company_id;
$$;

grant execute on function get_company(uuid) to authenticated;

-- Builds each response's visible field set from an ALLOWLIST (field_definitions where
-- visible_to_students), never a denylist — a newly-added canonical field defaults to
-- hidden until someone explicitly turns it on in the Table Editor.
create or replace function get_responses(p_company_id uuid)
returns table (
  id uuid,
  cycle_label text,
  submitted_at timestamptz,
  fields jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.cycle_label,
    r.submitted_at,
    (
      select coalesce(jsonb_object_agg(fd.key, r.data -> fd.key), '{}'::jsonb)
      from field_definitions fd
      where fd.visible_to_students
        and r.data ? fd.key
        and r.data ->> fd.key is not null
        and r.data ->> fd.key <> ''
    ) as fields
  from responses r
  where is_allowed_student() and r.company_id = p_company_id
  order by r.submitted_at desc nulls last;
$$;

grant execute on function get_responses(uuid) to authenticated;

-- Field labels/order for rendering (no student data involved, but gated for consistency).
create or replace function list_visible_fields()
returns table (key text, label text, display_order int)
language sql
stable
security definer
set search_path = public
as $$
  select fd.key, fd.label, fd.display_order
  from field_definitions fd
  where is_allowed_student() and fd.visible_to_students
  order by fd.display_order;
$$;

grant execute on function list_visible_fields() to authenticated;

-- ── Seed canonical field definitions ────────────────────────────────────────────────
-- 'timestamp' and 'company' are NOT here: timestamp lives in responses.submitted_at,
-- company is resolved to responses.company_id by the import script. Everything else
-- from the 9-cycle header survey is a jsonb field on responses.data.
insert into field_definitions (key, label, category, visible_to_students, display_order, locked) values
  ('email', 'Email', 'identifying', false, 0, true),
  ('name', 'Name', 'identifying', false, 1, true),
  ('id_number', 'ID Number', 'identifying', false, 2, true),
  ('branch', 'Branch', 'context', true, 10, false),
  ('cgpa', 'CGPA', 'context', true, 11, false),
  ('compensation', 'Compensation / Stipend', 'sensitive', false, 12, false),
  ('location', 'Location', 'context', true, 13, false),
  ('sector', 'Sector', 'context', false, 14, false),
  ('role', 'Role', 'core', true, 20, false),
  ('recruitment_process', 'Recruitment Process', 'core', true, 21, false),
  ('topics', 'Important Topics', 'core', true, 22, false),
  ('sources', 'Sources of Preparation', 'core', true, 23, false),
  ('questions_recalled', 'Questions Recalled', 'core', true, 24, false),
  ('unprepared_questions', 'Questions You Weren''t Prepared For', 'core', true, 25, false),
  ('courses_certifications', 'Relevant Courses & Certifications', 'core', true, 26, false),
  ('prior_experience', 'Prior Experience', 'core', true, 27, false),
  ('achievements', 'Standout Achievements', 'core', true, 28, false),
  ('additional_comments', 'Additional Comments', 'core', true, 29, false),
  ('training_comments', 'Other Training Notes', 'core', true, 30, false),
  ('when_start_prep', 'When Preparation Started', 'core', true, 31, false),
  ('form_meta_suggestions', 'Form feedback: suggestions for the form', 'internal', false, 90, true),
  ('form_meta_how_to_start', 'Form feedback: how to start preparation', 'internal', false, 91, true),
  ('form_meta_pu_feedback', 'Form feedback: for the Placement Unit', 'internal', false, 92, true)
on conflict (key) do nothing;
