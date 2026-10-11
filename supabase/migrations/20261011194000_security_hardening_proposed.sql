-- PROPOSED PRODUCTION MIGRATION — NOT APPLIED.
-- Reviewed against the isolated restore on 2026-10-11 (Asia/Baghdad).
-- Apply only after a reviewed backup, schema preflight, and explicit approval.
-- This migration does not alter rows, auth identities, Storage migration history,
-- or Production from this task.

-- Remove the accidental direct Data API surface from profiles. RLS remains the
-- row-level control; these grants are the table-level control.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Public SECURITY DEFINER helpers are not public RPC endpoints. Keep only the
-- authenticated grants required by existing RLS policies and the authenticated
-- anonymized-search RPC. Trigger entrypoints remain non-callable by API roles.
revoke all on function public.audit_row_changes() from public, anon, authenticated;
revoke all on function public.current_user_role() from public, anon, authenticated;
revoke all on function public.fill_match_users() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_staff_or_admin() from public, anon, authenticated;
revoke all on function public.is_verified_dental_professional() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.search_anonymized_patient_cases(
  uuid, uuid, text, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.is_verified_dental_professional() to authenticated;
grant execute on function public.search_anonymized_patient_cases(
  uuid, uuid, text, integer, integer, integer, integer
) to authenticated;

-- STAFF must not receive the broad profile-read policy. They use the limited
-- directory function below for operational screens; ADMIN/SUPER_ADMIN retain
-- the existing full administrative policy.
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own"
  on public.profiles
  for select
  to authenticated
  using ((id = (select auth.uid()) or public.is_admin()));

create or replace function public.list_profiles_for_admin()
returns table(
  id uuid,
  full_name text,
  role public.user_role,
  status public.account_status,
  university_id uuid,
  stage text,
  phone text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id, p.full_name, p.role, p.status, p.university_id, p.stage,
         case when public.is_admin() then p.phone else null end,
         p.created_at
  from public.profiles p
  where public.is_staff_or_admin()
  order by p.created_at desc;
$$;

revoke all on function public.list_profiles_for_admin() from public, anon;
grant execute on function public.list_profiles_for_admin() to authenticated;

-- Storage schema and the four patient-case-images policies already match the
-- read-only Production catalog. They are intentionally not recreated here.

