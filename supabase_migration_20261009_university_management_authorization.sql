-- PREPARED ONLY. Do not apply to Production without explicit approval.
-- This migration is additive to the current eight-column universities schema.
-- It makes university writes depend on a verified admin role plus the
-- universities.manage permission (SUPER_ADMIN remains allowed), and removes
-- anonymous write grants. It does not delete or renumber any university.

create or replace function public.can_manage_universities()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'VERIFIED'::public.account_status
      and (
        p.role = 'SUPER_ADMIN'::public.user_role
        or (
          p.role = 'ADMIN'::public.user_role
          and exists (
            select 1 from public.admin_permissions ap
            where ap.profile_id = p.id
              and ap.permission_key = 'universities.manage'
          )
        )
      )
  );
$$;

revoke all on function public.can_manage_universities() from public, anon;
grant execute on function public.can_manage_universities() to authenticated;

drop policy if exists "lookup universities admin manage" on public.universities;
drop policy if exists "lookup universities read" on public.universities;

create policy "lookup universities read"
  on public.universities for select
  to anon, authenticated
  using (is_active = true or public.can_manage_universities());

create policy "lookup universities admin insert"
  on public.universities for insert
  to authenticated
  with check (public.can_manage_universities());

create policy "lookup universities admin update"
  on public.universities for update
  to authenticated
  using (public.can_manage_universities())
  with check (public.can_manage_universities());

revoke insert, update, delete, truncate on public.universities from anon;
revoke delete, truncate on public.universities from authenticated;
grant select on public.universities to anon, authenticated;
grant insert, update on public.universities to authenticated;
