-- Staging-safe schema contract for the patient case wizard.
-- This migration only adds non-personal structure; it does not copy rows,
-- create users, or alter the Production project.

alter table if exists public.patient_cases
  add column if not exists preferred_periods jsonb;

alter table if exists public.case_images
  add column if not exists storage_path text;

alter table if exists public.case_images
  add column if not exists is_approved_for_student_view boolean not null default false;

create table if not exists public.patient_case_preferred_universities (
  case_id uuid not null references public.patient_cases(id) on delete cascade,
  university_id uuid not null references public.universities(id),
  created_at timestamptz not null default now(),
  primary key (case_id, university_id)
);

create index if not exists patient_case_preferred_universities_university_idx
  on public.patient_case_preferred_universities(university_id);

alter table if exists public.patient_case_preferred_universities enable row level security;

drop policy if exists "patients manage own preferred universities" on public.patient_case_preferred_universities;
create policy "patients manage own preferred universities"
  on public.patient_case_preferred_universities
  for all to authenticated
  using (exists (
    select 1 from public.patient_cases c
    where c.id = case_id and c.patient_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.patient_cases c
    where c.id = case_id and c.patient_id = (select auth.uid())
  ));

comment on column public.case_images.storage_path is
  'Private Storage object path; never expose a public URL as authorization.';
