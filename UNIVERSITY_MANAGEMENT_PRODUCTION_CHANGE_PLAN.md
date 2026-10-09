# University management Production change plan

## Current baseline

- Project: `alasas1` / `nkzvxdobklsehdyzyzmy`
- `public.universities`: 2 rows, eight legacy columns only.
- Existing read policy exposes active rows to `anon` and `authenticated`.
- Existing write policy uses `is_admin()` for all authenticated admin writes.
- The prepared advanced migration is not in the Production migration list.

## Proposed change (not applied)

Apply `supabase_migration_20261009_university_management_authorization.sql` only after approval. It adds database-level `universities.manage` authorization for verified `ADMIN` users, keeps `SUPER_ADMIN` access, removes anonymous write grants, preserves active public reads, and permits only insert/update (hide/show is an update; delete remains unavailable).

## Backup and rollback

`production_universities_backup_20261009.sql` is a restorable row snapshot, not a full Supabase backup. Before approval, take the project backup/PITR snapshot and save the migration execution result. Rollback is: restore the database snapshot if the policy change causes an incident, or restore the previous two policies/grants from the preflight output. Do not use the row snapshot as a substitute for a full backup.

## Verification gate

1. Verify the backup can be restored in an isolated database.
2. Apply the migration only with explicit approval.
3. Run positive/negative RLS tests with an isolated verified admin, verified admin without `universities.manage`, student, and anon sessions.
4. Run one clearly named university test row through insert, update, hide, show, and independent readback; clean it only after recording the readback and confirming no foreign-key references.
5. Re-run advisors and inspect the applied migration list.
