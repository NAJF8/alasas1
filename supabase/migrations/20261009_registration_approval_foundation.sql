-- LOCAL / STAGING ONLY. Do not apply to Production without a reviewed backup,
-- isolated synthetic-identity tests, and explicit rollout approval.
-- This migration does not touch auth.users or create sessions.

create schema if not exists private;

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  phone_e164 text not null check (phone_e164 ~ '^\+9647[0-9]{9}$'),
  role text not null check (role in ('PATIENT', 'STUDENT')),
  gender text not null check (gender in ('MALE', 'FEMALE')),
  province_id uuid not null references public.provinces(id),
  university_id uuid references public.universities(id),
  stage text,
  pin_hash text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')),
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_student_university check (role <> 'STUDENT' or university_id is not null),
  constraint registration_student_stage check (role <> 'STUDENT' or nullif(btrim(stage), '') is not null)
);

create unique index if not exists registration_requests_active_phone_uidx
  on public.registration_requests(phone_e164)
  where status in ('PENDING', 'VERIFIED', 'SUSPENDED');

create table if not exists public.registration_activation_invites (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null unique references public.registration_requests(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 10),
  created_at timestamptz not null default now()
);

create table if not exists public.registration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null references public.registration_requests(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null check (action in ('SUBMITTED', 'APPROVED', 'REJECTED', 'WHATSAPP_OPENED', 'ACTIVATION_ATTEMPTED', 'ACTIVATED')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.registration_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

alter table public.registration_requests enable row level security;
alter table public.registration_activation_invites enable row level security;
alter table public.registration_audit_logs enable row level security;
alter table public.registration_rate_limits enable row level security;

revoke all on public.registration_requests, public.registration_activation_invites,
  public.registration_audit_logs, public.registration_rate_limits from anon, authenticated;

create or replace function public.consume_registration_rate_limit(
  p_rate_key text,
  p_limit integer default 5,
  p_window_seconds integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row public.registration_rate_limits;
begin
  if p_rate_key is null or length(p_rate_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  insert into public.registration_rate_limits(rate_key, window_started_at, attempts)
  values (p_rate_key, clock_timestamp(), 1)
  on conflict (rate_key) do update
    set attempts = case
      when public.registration_rate_limits.window_started_at < clock_timestamp() - make_interval(secs => p_window_seconds)
        then 1
      else public.registration_rate_limits.attempts + 1
    end,
    window_started_at = case
      when public.registration_rate_limits.window_started_at < clock_timestamp() - make_interval(secs => p_window_seconds)
        then clock_timestamp()
      else public.registration_rate_limits.window_started_at
    end,
    updated_at = clock_timestamp()
  returning * into current_row;
  return current_row.attempts <= p_limit;
end;
$$;

revoke all on function public.consume_registration_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_registration_rate_limit(text, integer, integer) to service_role;

comment on table public.registration_requests is 'Server-created registration requests. PIN hashes are never exposed to clients or admins.';
comment on table public.registration_activation_invites is 'Single-use activation records; approval alone does not prove phone ownership.';

-- The Edge Functions call these transaction wrappers with the service role.
-- Keeping the request/decision and audit row in one transaction prevents a
-- success response when the audit write failed.
create or replace function public.create_registration_request(
  p_full_name text,
  p_phone_e164 text,
  p_role text,
  p_gender text,
  p_province_id uuid,
  p_university_id uuid,
  p_stage text,
  p_pin_hash text
) returns table(id uuid, status text, created_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  insert into public.registration_requests(full_name, phone_e164, role, gender, province_id, university_id, stage, pin_hash)
  values (p_full_name, p_phone_e164, p_role, p_gender, p_province_id, p_university_id, p_stage, p_pin_hash)
  returning registration_requests.id, registration_requests.status, registration_requests.created_at
  into id, status, created_at;

  insert into public.registration_audit_logs(registration_request_id, action, metadata)
  values (id, 'SUBMITTED', jsonb_build_object('role', p_role));
  return next;
end;
$$;

create or replace function public.review_registration_request(
  p_request_id uuid,
  p_next_status text,
  p_actor_id uuid,
  p_rejection_reason text default null
) returns table(id uuid, status text, reviewed_at timestamptz, full_name text, phone_e164 text)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  review_time timestamptz := clock_timestamp();
begin
  if p_next_status not in ('VERIFIED', 'REJECTED') then
    raise exception 'invalid registration decision';
  end if;

  update public.registration_requests r
    set status = p_next_status,
        rejection_reason = case when p_next_status = 'REJECTED' then p_rejection_reason else null end,
        reviewed_by = p_actor_id,
        reviewed_at = review_time,
        updated_at = review_time
  where r.id = p_request_id and r.status = 'PENDING'
  returning r.id, r.status, r.reviewed_at, r.full_name, r.phone_e164
  into id, status, reviewed_at, full_name, phone_e164;

  if id is null then
    raise exception 'registration request is missing or already reviewed';
  end if;

  insert into public.registration_audit_logs(registration_request_id, actor_id, action, reason)
  values (id, p_actor_id, case when p_next_status = 'VERIFIED' then 'APPROVED' else 'REJECTED' end, p_rejection_reason);
  return next;
end;
$$;

revoke all on function public.create_registration_request(text, text, text, text, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.review_registration_request(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_registration_request(text, text, text, text, uuid, uuid, text, text) to service_role;
grant execute on function public.review_registration_request(uuid, text, uuid, text) to service_role;
