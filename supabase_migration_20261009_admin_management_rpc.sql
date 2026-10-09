-- Prepared additive migration. Do not apply to Production without an approved
-- backup, schema preflight, and rollback plan.
-- This migration manages existing Supabase Auth users by email. It never creates
-- passwords, exposes a privileged server key, or creates shared accounts.

create or replace function public.admin_list_managers()
returns table (
  profile_id uuid,
  email text,
  full_name text,
  role public.user_role,
  status public.account_status,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  permissions text[]
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if public.current_user_role() not in ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role, 'STAFF'::public.user_role) then
    raise exception 'admin access required';
  end if;
  return query
    select p.id, u.email, p.full_name, p.role, p.status, p.created_at,
      u.last_sign_in_at,
      coalesce(array_agg(ap.permission_key order by ap.permission_key) filter (where ap.permission_key is not null), '{}'::text[])
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.admin_permissions ap on ap.profile_id = p.id
    where p.role in ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role, 'STAFF'::public.user_role)
    group by p.id, u.email, p.full_name, p.role, p.status, p.created_at, u.last_sign_in_at
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_update_manager(
  p_profile_id uuid,
  p_role public.user_role,
  p_status public.account_status,
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  before_row jsonb;
  target_row jsonb;
  current_role public.user_role;
  active_super_count integer;
  allowed_permissions constant text[] := array[
    'patients.manage','cases.manage','students.verify','matches.manage',
    'appointments.manage','universities.manage','reports.view',
    'settings.manage','branding.manage','users.manage'
  ];
begin
  if actor_id is null or public.current_user_role() <> 'SUPER_ADMIN'::public.user_role then
    raise exception 'SUPER_ADMIN access required';
  end if;
  if p_profile_id is null or p_profile_id = actor_id then
    raise exception 'a super admin cannot modify their own privileges';
  end if;
  if p_role not in ('ADMIN'::public.user_role, 'STAFF'::public.user_role) then
    raise exception 'managed accounts may only be ADMIN or STAFF';
  end if;
  if exists (select 1 from unnest(coalesce(p_permissions, '{}'::text[])) permission_key where not (permission_key = any(allowed_permissions))) then
    raise exception 'unsupported permission key';
  end if;

  select to_jsonb(p) into before_row from public.profiles p where p.id = p_profile_id for update;
  if before_row is null then raise exception 'manager profile not found'; end if;
  current_role := (before_row ->> 'role')::public.user_role;
  if current_role = 'SUPER_ADMIN'::public.user_role then
    select count(*) into active_super_count from public.profiles where role = 'SUPER_ADMIN'::public.user_role and status = 'VERIFIED'::public.account_status;
    if active_super_count <= 1 then raise exception 'cannot modify the last active SUPER_ADMIN'; end if;
  end if;
  update public.profiles set role = p_role, status = p_status, updated_at = timezone('utc'::text, now()) where id = p_profile_id returning to_jsonb(profiles.*) into target_row;
  delete from public.admin_permissions where profile_id = p_profile_id;
  insert into public.admin_permissions(profile_id, permission_key, granted_by)
    select p_profile_id, permission_key, actor_id from unnest(coalesce(p_permissions, '{}'::text[])) permission_key;
  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
    values (actor_id, 'admin_manager_update', 'profiles', p_profile_id, before_row,
      target_row || jsonb_build_object('permissions', coalesce(p_permissions, '{}'::text[])));
  return jsonb_build_object('profile_id', p_profile_id, 'role', p_role, 'status', p_status, 'permissions', coalesce(p_permissions, '{}'::text[]));
end;
$$;

create or replace function public.admin_add_manager(
  p_email text,
  p_role public.user_role,
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid;
  target_email text := lower(btrim(p_email));
  existing_profile jsonb;
begin
  if actor_id is null or public.current_user_role() <> 'SUPER_ADMIN'::public.user_role then
    raise exception 'SUPER_ADMIN access required';
  end if;
  select u.id into target_id from auth.users u where lower(u.email) = target_email limit 1;
  if target_id is null then raise exception 'an existing Supabase Auth user is required'; end if;
  if target_id = actor_id then raise exception 'a super admin cannot add themselves'; end if;
  select to_jsonb(p) into existing_profile from public.profiles p where p.id = target_id;
  if existing_profile is null then
    insert into public.profiles(id, role, full_name, phone, status)
      select u.id, 'ADMIN'::public.user_role,
        coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), target_email),
        coalesce(u.raw_user_meta_data ->> 'phone', ''), 'VERIFIED'::public.account_status
      from auth.users u where u.id = target_id;
  end if;
  return public.admin_update_manager(target_id, p_role, 'VERIFIED'::public.account_status, p_permissions);
end;
$$;

revoke all on function public.admin_list_managers() from public, anon;
revoke all on function public.admin_update_manager(uuid, public.user_role, public.account_status, text[]) from public, anon;
revoke all on function public.admin_add_manager(text, public.user_role, text[]) from public, anon;
grant execute on function public.admin_list_managers() to authenticated;
grant execute on function public.admin_update_manager(uuid, public.user_role, public.account_status, text[]) to authenticated;
grant execute on function public.admin_add_manager(text, public.user_role, text[]) to authenticated;
