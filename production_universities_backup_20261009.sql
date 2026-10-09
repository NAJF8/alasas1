-- Read-only snapshot captured from Production project alasas1
-- ref: nkzvxdobklsehdyzyzmy, 2026-10-09 Asia/Baghdad
-- Scope: public.universities rows only; this is not a full database backup.

insert into public.universities
  (id, province_id, name_ar, name_en, has_dental_college, is_active, created_at, updated_at)
values
  ('1959c03c-1aef-4631-b1bc-7c24ec0dc77a', '16a4c2af-9207-41da-aab9-f8ba99361761', 'جامعة الكفيل', 'Al-Kafeel University', true, true, '2026-10-07 17:15:36.995115+00', '2026-10-07 17:15:36.995115+00'),
  ('95879761-8fda-4e46-990f-8638f52890a0', '16a4c2af-9207-41da-aab9-f8ba99361761', 'جامعة الكوفة', 'University of Kufa', true, true, '2026-10-07 17:15:36.995115+00', '2026-10-07 17:15:36.995115+00')
on conflict (id) do update set
  province_id = excluded.province_id,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  has_dental_college = excluded.has_dental_college,
  is_active = excluded.is_active,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
