-- Prepared only. Do not apply to Production without an isolated test database,
-- RLS read/write tests, backup verification, and separate approval.
-- Backwards-compatible extension of public.universities.

alter table public.universities
  add column if not exists university_type text not null default 'PUBLIC',
  add column if not exists management_status text not null default 'active',
  add column if not exists allow_patient_selection boolean not null default true,
  add column if not exists allow_student_registration boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists admin_notes text;

alter table public.universities
  drop constraint if exists universities_university_type_check,
  drop constraint if exists universities_management_status_check;

alter table public.universities
  add constraint universities_university_type_check
    check (university_type in ('PUBLIC', 'PRIVATE')),
  add constraint universities_management_status_check
    check (management_status in ('active', 'hidden', 'disabled'));

create index if not exists universities_public_order_idx
  on public.universities (management_status, display_order, name_ar);

-- Keep legacy is_active compatible while the application migrates to the
-- explicit status. This does not alter or delete existing university rows.
update public.universities
set management_status = case when is_active then 'active' else 'hidden' end
where management_status = 'active' and not is_active;
