-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users (Extending Supabase Auth)
-- RLS: Users can only read their own profile. Admins can read all.
create type user_role as enum ('PATIENT', 'STUDENT', 'DENTIST', 'ADMIN', 'SUPER_ADMIN', 'STAFF');
create type account_status as enum ('PENDING', 'VERIFIED', 'SUSPENDED');

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role user_role not null default 'PATIENT',
  full_name text not null,
  phone text not null,
  whatsapp text,
  gender text,
  birth_date date,
  province_id uuid,
  area_id uuid,
  status account_status default 'PENDING',
  
  -- Student/Dentist specific
  university_id uuid,
  stage text, -- الثالثة, الرابعة, الخامسة
  student_id_image_url text,
  workplace text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Lookup Tables (Provinces, Areas, Universities, Case Categories)
create table public.provinces (
  id uuid default uuid_generate_v4() primary key,
  name_ar text not null,
  name_en text not null,
  is_active boolean default true
);

create table public.areas (
  id uuid default uuid_generate_v4() primary key,
  province_id uuid references public.provinces(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  is_active boolean default true
);

create table public.universities (
  id uuid default uuid_generate_v4() primary key,
  province_id uuid references public.provinces(id),
  name_ar text not null,
  name_en text not null,
  has_dental_college boolean default true,
  is_active boolean default true
);

create table public.clinical_categories (
  id uuid default uuid_generate_v4() primary key,
  name_ar text not null,
  name_en text not null,
  description text,
  is_active boolean default true
);

-- 3. Patient Cases
create type case_status as enum (
  'NEW', 'UNDER_REVIEW', 'WAITING_FOR_MATCH', 'POTENTIAL_MATCH',
  'CONTACTING_PATIENT', 'APPOINTMENT_PENDING', 'APPOINTMENT_CONFIRMED',
  'IN_PROGRESS', 'COMPLETED', 'PATIENT_UNAVAILABLE', 'REJECTED', 'CANCELLED'
);

create table public.patient_cases (
  id uuid default uuid_generate_v4() primary key,
  case_number text unique not null,
  patient_id uuid references public.profiles(id) not null,
  province_id uuid references public.provinces(id),
  area_id uuid references public.areas(id),
  patient_age integer,
  patient_gender text,
  description text not null,
  symptoms jsonb, -- array of symptoms
  available_days jsonb, -- array of days
  status case_status default 'NEW',
  
  -- AI Fields
  ai_tags jsonb,
  ai_confidence numeric,
  ai_summary text,
  is_urgent boolean default false,
  
  -- Admin Fields
  admin_notes text,
  assigned_admin_id uuid references public.profiles(id),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.case_images (
  id uuid default uuid_generate_v4() primary key,
  case_id uuid references public.patient_cases(id) on delete cascade,
  image_url text not null,
  image_type text, -- photo, xray
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Student Requests
create type request_status as enum (
  'WAITING_FOR_MATCH', 'POTENTIAL_MATCH', 'ADMIN_REVIEW', 'CONTACTING_STUDENT',
  'APPOINTMENT_PENDING', 'APPOINTMENT_CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

create table public.student_requests (
  id uuid default uuid_generate_v4() primary key,
  request_number text unique not null,
  student_id uuid references public.profiles(id) not null,
  province_id uuid references public.provinces(id),
  clinical_category_id uuid references public.clinical_categories(id),
  tooth_area text,
  target_age_min integer,
  target_age_max integer,
  preferred_gender text,
  available_days jsonb,
  notes text,
  status request_status default 'WAITING_FOR_MATCH',
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Matches
create type match_status as enum (
  'POTENTIAL', 'ADMIN_REVIEW', 'PATIENT_CONTACTED', 'PATIENT_ACCEPTED',
  'STUDENT_CONTACTED', 'BOTH_CONFIRMED', 'APPOINTMENT_SET', 'IN_PROGRESS',
  'COMPLETED', 'FAILED', 'CANCELLED'
);

create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  patient_case_id uuid references public.patient_cases(id) not null,
  student_request_id uuid references public.student_requests(id) not null,
  
  match_score numeric,
  clinical_score numeric,
  location_score numeric,
  availability_score numeric,
  ai_reasons jsonb,
  
  status match_status default 'POTENTIAL',
  created_by_admin_id uuid references public.profiles(id),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Appointments
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) not null,
  patient_id uuid references public.profiles(id) not null,
  student_id uuid references public.profiles(id) not null,
  location text, -- clinic / university
  appointment_date timestamp with time zone not null,
  notes text,
  status text default 'SCHEDULED', -- SCHEDULED, COMPLETED, CANCELLED, NO_SHOW
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Audit Logs
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: RLS Policies need to be configured strictly to prevent data leaks.
