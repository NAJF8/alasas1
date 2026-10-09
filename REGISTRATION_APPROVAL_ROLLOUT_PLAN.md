# Registration approval rollout and rollback gate

Status: **PREPARED, NOT EXECUTED**

The Production project was queried read-only on 2026-10-09. No registration tables, functions, or Edge Functions from this feature have been applied or deployed.

## Required backup gate

Before any Production write, an owner with Supabase backup access must create and verify a restorable backup/PITR point for the project `nkzvxdobklsehdyzyzmy`. The evidence must include:

- backup/PITR identifier and UTC timestamp;
- confirmation that `auth.users`, `profiles`, `provinces`, `universities`, `patient_cases`, `student_requests`, `audit_logs`, Storage metadata, and RLS policies are included;
- a restore or isolated-branch verification, not only a backup-success label;
- the person approving the restore test.

This repository does not contain a Production dump and must not manufacture one from application code.

## Isolated test gate

1. Apply `supabase/migrations/20261009_registration_approval_foundation.sql` to an isolated Supabase branch/local Supabase instance.
2. Run `supabase/tests/registration_approval_catalog.sql`.
3. Add synthetic anonymous, patient, student, staff, admin, and super-admin identities.
4. Exercise duplicate phone, phone-key rate limit across changing IPs, invalid province/university, request read isolation, approval/rejection race, audit atomicity, and WhatsApp URL contents.
5. Confirm no `auth.users` or existing production rows are changed.
6. Run Edge Functions with `verify_jwt=false` only for the public request function and `verify_jwt=true` for the admin function. The public function still requires the server-side `RATE_LIMIT_SECRET` and Supabase service environment.

## Production change set requiring approval

- create four new RLS-protected tables;
- create two service-role-only transactional RPCs;
- create two Edge Functions;
- set `RATE_LIMIT_SECRET` (at least 32 random characters) and `ALLOWED_ORIGIN`;
- do not alter `auth.users`, `profiles`, patient data, student data, Storage buckets, existing policies, or existing Google/email authentication.

## Rollback

Only after exporting any feature rows created after rollout and confirming no dependent objects exist:

```sql
drop function if exists public.create_registration_request(text,text,text,text,uuid,uuid,text,text);
drop function if exists public.review_registration_request(uuid,text,uuid,text);
drop function if exists public.consume_registration_rate_limit(text,integer,integer);
drop table if exists public.registration_rate_limits;
drop table if exists public.registration_audit_logs;
drop table if exists public.registration_activation_invites;
drop table if exists public.registration_requests;
```

Then disable/remove the two Edge Function versions and verify the existing Google/email flows, current profiles, patient cases, student requests, Storage, and RLS behavior. The rollback does not touch `auth.users` or existing application tables.

## Explicitly not included

Phone + PIN login, account recovery, activation verification, SMS, and medical-data access are separate gates. They must not be enabled by this Phase 1 rollout.
