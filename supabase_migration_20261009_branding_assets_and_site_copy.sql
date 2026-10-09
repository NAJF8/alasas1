-- Prepared additive migration. Review and apply only in an approved staging project
-- with a backup and a rollback plan. This file is intentionally not applied here.

alter table public.branding_settings
  add column if not exists site_description text,
  add column if not exists hero_image_url text,
  add column if not exists hero_title_ar text,
  add column if not exists hero_subtitle_ar text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding-assets', 'branding-assets', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_assets_public_read') then
    create policy branding_assets_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'branding-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_assets_admin_insert') then
    create policy branding_assets_admin_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'branding-assets' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_assets_admin_update') then
    create policy branding_assets_admin_update on storage.objects
      for update to authenticated
      using (bucket_id = 'branding-assets' and public.is_admin())
      with check (bucket_id = 'branding-assets' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'branding_assets_admin_delete') then
    create policy branding_assets_admin_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'branding-assets' and public.is_admin());
  end if;
end
$$;

grant select on public.branding_settings to anon, authenticated;
