-- Isolated restore only. Read-only Production trigger definition was captured
-- on 2026-10-11 and reproduced here for synthetic Auth canaries.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role public.user_role;
begin
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'PATIENT'));
  safe_role := case requested_role
    when 'STUDENT' then 'STUDENT'::public.user_role
    when 'DENTIST' then 'DENTIST'::public.user_role
    else 'PATIENT'::public.user_role
  end;

  insert into public.profiles (id, role, status, full_name, phone, whatsapp)
  values (
    new.id,
    safe_role,
    case when safe_role = 'PATIENT'
      then 'VERIFIED'::public.account_status
      else 'PENDING'::public.account_status
    end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
