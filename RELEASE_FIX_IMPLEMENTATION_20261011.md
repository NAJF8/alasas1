# ALASAS Dental — release-fix implementation evidence

Date: 2026-10-11 (Asia/Baghdad)

## Files changed for this task

- `supabase/migrations/20261011193000_registration_approval_foundation.sql` — production-numbered registration candidate.
- `supabase/migrations/20261011194000_security_hardening_proposed.sql` — ACL/RLS hardening plus the limited staff directory RPC; not applied to Production.
- `supabase/rollbacks/20261011194000_security_hardening_rollback.sql` — reviewed rollback-only SQL.
- `supabase/tests/migrations/*` — retained local synthetic fixtures outside the migration discovery path.
- `supabase/tests/migrations/README.md` — exclusion rule and provenance.
- `supabase/config.toml`, `.github/workflows/deploy-pages.yml` — safe function/flag configuration; flag defaults false.
- `supabase/functions/README.md` — secret manifest without secret values.
- `admin-app/src/pages/ManagementPage.tsx` — profile administration uses the limited RPC.
- `tools/restore_auth_trigger.sql`, `tools/local_auth_trigger_canary.mjs`, `tools/local_staff_privacy_canary.mjs` — isolated synthetic verification only.

## Actual verification

- The isolated restore accepted the security migration SQL without error.
- The Production `auth.users` trigger definition was read-only captured and reproduced in the restore. Trigger readback: `AFTER INSERT ON auth.users ... handle_new_user()`.
- Synthetic Auth canary: PASS — Auth user created, password sign-in succeeded, Profile was created/read back with the expected synthetic PATIENT role. No Production identity was used.
- Trigger/ACL readback: PASS — audit triggers on appointments/matches/patient_cases/student_requests and `fill_match_users` remained present; trigger functions have no anon/authenticated execute grant; RLS/search helpers retain authenticated execution.
- STAFF privacy canary: PASS — direct `profiles` returned only the staff canary's own row; the limited directory RPC returned operational rows with zero phone values for STAFF.
- `supabase/tests/registration_approval_catalog.sql`: PASS on the isolated restore.
- Customer build: PASS (`npm run build`). Admin build: PASS (`npm run build`). Existing Vite chunk-size warnings remain non-blocking and unrelated to this security change.
- Migration layout: PASS — only the two numbered production candidates remain in `supabase/migrations`; synthetic fixtures are under `supabase/tests/migrations` and are not discovered by the default `db push` path.

## Known execution limitation

The Supabase CLI executable is not installed on this machine, so CLI migration-list output could not be collected. The SQL ordering was verified from the numbered files and by applying the security candidate to the running isolated restore; a human/CI runner with the pinned Supabase CLI must run the final `migration list`/dry-run before Production.

## Remaining human gates

1. Obtain and verify an external encrypted PostgreSQL/Auth/Storage backup plus a separately escrowed recovery key; the Free plan does not itself establish a downloadable complete backup.
2. Review the exact pre-migration ACL snapshot and approve the two Production migrations in order: registration, then security.
3. Set Function secrets in Supabase without exposing values, deploy Functions, run limited approved Production canaries, then set the frontend flag secret to `true` in a separate deployment.

Production writes/deploys from this task: NONE.
