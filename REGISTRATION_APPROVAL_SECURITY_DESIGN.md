# Registration approval and WhatsApp activation — safety design

Status: **LOCAL/STAGING IMPLEMENTATION — NOT APPLIED TO Supabase Production**

## Why this is not activated

Production currently authenticates through Supabase Auth identities and `profiles.id = auth.users.id`. It has no phone identities, no PIN hash, no registration-request table, no activation-invitation table, no approval RPC, and no unique normalized-phone constraint. A phone + six-digit PIN without proof of phone ownership would allow account takeover and would not produce a trustworthy Supabase JWT for RLS.

The local UI therefore validates the request shape but intentionally does not write, create a session, or grant access.

## Required isolated implementation

1. `supabase/migrations/20261009_registration_approval_foundation.sql` adds a private-by-policy registration-request store with a random request id, normalized phone, role/profile data, a salted PBKDF2 hash of the PIN, rate-limit counters, activation records, and an explicit status state machine.
2. `supabase/functions/registration-request` accepts requests server-side. The service key and PIN hash never reach the browser. Duplicate-phone and atomic rate-limit checks are server-side.
3. `supabase/functions/registration-admin` verifies the current authenticated user and verified admin role before list/approve/reject, performs a conditional update/readback, and writes a dedicated audit record.
4. Approval must create a short-lived, single-use activation invitation. It must not itself prove phone ownership or expose medical data.
5. Choose and test a real ownership/recovery method before enabling phone + PIN login. Supabase Auth phone/password requires a verified phone identity for a safe flow; a custom username-only session must not be simulated with fake emails or client JWTs.
6. Add negative RLS tests with synthetic Patient A, Patient B, Student, Admin, and unauthenticated contexts. Add activation replay, expiry, lockout, recovery, and duplicate-phone tests.
7. Only after isolated tests pass, review a production backup and submit the migration for explicit approval. Do not reuse repository schema assumptions without a live catalog comparison.

## WhatsApp behavior

The admin UI may construct a `wa.me` link only after a server-readback-confirmed approval. Opening the link is recorded as `OPENED` at most; it is never recorded as `SENT` without an external delivery receipt. The welcome message contains the user's name and public site URL only — never a PIN, activation secret, or health data.

## Current local surfaces

- Customer: `/#/register-request` — still validation-only until the migration and Edge Function are deployed to an isolated project.
- Admin: `/admin/#/registration-requests` — still read-only until the migration and Edge Function are deployed to an isolated project.
- Backend: the Edge Functions and migration are source-ready but intentionally not deployed or applied.

