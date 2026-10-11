-- LOCAL TEST ONLY. Synthetic reference rows and minimal compatibility schema.
-- No patient data is imported; this exists so registration migrations can run
-- against an isolated local Supabase database.

create extension if not exists "uuid-ossp";

do $$ begin
  create type public.user_role as enum ('PATIENT', 'STUDENT', 'DENTIST', 'ADMIN', 'SUPER_ADMIN', 'STAFF');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('PENDING', 'VERIFIED', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

create table if not exists public.provinces (
  id uuid primary key default uuid_generate_v4(),
  name_ar text not null,
  name_en text not null,
  is_active boolean not null default true
);

create table if not exists public.areas (
  id uuid primary key default uuid_generate_v4(),
  province_id uuid not null references public.provinces(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  is_active boolean not null default true
);

create table if not exists public.universities (
  id uuid primary key default uuid_generate_v4(),
  province_id uuid references public.provinces(id),
  name_ar text not null,
  name_en text not null,
  has_dental_college boolean not null default true,
  is_active boolean not null default true
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'PATIENT',
  full_name text not null,
  phone text not null default '',
  status public.account_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.provinces (id, name_ar, name_en, is_active)
values ('00000000-0000-0000-0000-000000000101', 'محافظة اختبار', 'Synthetic Province', true)
on conflict (id) do nothing;

insert into public.areas (id, province_id, name_ar, name_en, is_active)
values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'منطقة اختبار', 'Synthetic Area', true)
on conflict (id) do nothing;

insert into public.universities (id, province_id, name_ar, name_en, has_dental_college, is_active)
values ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'جامعة اختبار', 'Synthetic University', true, true)
on conflict (id) do nothing;
