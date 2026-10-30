-- ROLLBACK PLAN ONLY — do not run automatically.
-- Use only if the proposed security migration was applied and its exact
-- pre-migration ACL snapshot has been reviewed. This restores the broad
-- pre-migration API grants observed in Production; it does not restore rows.

grant all on table public.profiles to anon, authenticated;

grant execute on function public.audit_row_changes() to public;
grant execute on function public.current_user_role() to public;
grant execute on function public.fill_match_users() to public;
grant execute on function public.handle_new_user() to public;
grant execute on function public.is_admin() to public;
grant execute on function public.is_staff_or_admin() to public;
grant execute on function public.is_verified_dental_professional() to public;
grant execute on function public.rls_auto_enable() to public;
grant execute on function public.search_anonymized_patient_cases(
  uuid, uuid, text, integer, integer, integer, integer
) to public;

drop function if exists public.list_profiles_for_admin();
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own"
  on public.profiles
  for select
  to authenticated
  using ((id = (select auth.uid()) or public.is_staff_or_admin()));
