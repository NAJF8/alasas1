-- Run only against an isolated local Supabase/PostgreSQL database after applying
-- 20261009_registration_approval_foundation.sql. This is a catalog and privilege
-- gate; it never uses production data and does not create real accounts.

do $$
declare
  table_name text;
begin
  foreach table_name in array array['registration_requests','registration_activation_invites','registration_audit_logs','registration_rate_limits'] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
    if has_table_privilege('anon', format('public.%s', table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%s', table_name), 'SELECT') then
      raise exception 'direct SELECT is granted on public.%', table_name;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.create_registration_request(text,text,text,text,uuid,uuid,date,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_registration_request(text,text,text,text,uuid,uuid,date,uuid,text,text)', 'EXECUTE') then
    raise exception 'anonymous execution is granted for create_registration_request';
  end if;
  if has_function_privilege('anon', 'public.review_registration_request(uuid,text,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.review_registration_request(uuid,text,uuid,text)', 'EXECUTE') then
    raise exception 'anonymous execution is granted for review_registration_request';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='registration_requests_active_phone_uidx') then
    raise exception 'active phone uniqueness index is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='registration_requests' and column_name='area_id')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='registration_requests' and column_name='birth_date') then
    raise exception 'patient registration fields are missing';
  end if;
  if not has_function_privilege('service_role', 'public.create_registration_request(text,text,text,text,uuid,uuid,date,uuid,text,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.review_registration_request(uuid,text,uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.consume_registration_rate_limit(text,integer,integer)', 'EXECUTE') then
    raise exception 'service_role execution grants are incomplete';
  end if;
end $$;

select 'registration approval catalog/privilege checks: PASS' as result;
