-- LOCAL TEST ONLY. Protect synthetic reference tables with explicit read policies.
-- Registration Edge Functions use service_role and are unaffected by these policies.

alter table public.provinces enable row level security;
alter table public.areas enable row level security;
alter table public.universities enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "active provinces are readable" on public.provinces;
create policy "active provinces are readable"
  on public.provinces for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "active areas are readable" on public.areas;
create policy "active areas are readable"
  on public.areas for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "active universities are readable" on public.universities;
create policy "active universities are readable"
  on public.universities for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.provinces, public.areas, public.universities to anon, authenticated;
grant select on public.profiles to authenticated;
