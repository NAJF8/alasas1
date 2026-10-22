# AL ASAS Dental Staging E2E report — 2026-10-22

Scope: exact clean worktree from commit `a4185c8`; Staging only. Production, `main`, Blaze/Billing, and R2 were not changed.

## Changes

- Fixed Customer profile loading to read `profiles/{uid}` directly instead of an unauthorized collection query.
- Enabled the deployed Customer registration backend flag for Staging.
- Added the required Firestore composites for patient cases, student requests, notifications, and appointments.
- Removed the Patient dashboard's unauthorized appointments read; appointments remain manager-only and the UI shows a truthful empty state.
- Stored test credentials only outside Git at `C:\Users\MSI\AppData\Local\Temp\alasas-dental-staging-e2e-20261022.json`.

## Browser and live Staging evidence

- Patient registration: PASS. Independent phone/password account; personal data, gender, DOB/age, phone/WhatsApp, province/area, university, and terms were submitted through Customer. Admin approval showed `تمت الموافقة والتحقق من قراءة القرار.`
- Patient case: PASS. Independent patient created a text-only case with age 30, symptoms, availability, and one university; after refresh the Customer dashboard showed one `PENDING` case. No image/R2 path was used.
- Student registration: PASS. Independent phone/password account; name, gender, province, WhatsApp, basic university, stage FOURTH, one preferred university, and terms were submitted. Admin approval read back as verified.
- Student request: PASS at the authenticated Worker/backend boundary. The independent student ID token created request `REQ-MVJ1UKWC`; Firestore readback initially showed `PENDING`, then Admin approved it and the Admin table showed `VERIFIED`.
- Approval, matching, completion: PASS. Admin approved case `CASE-MVJ1P45V`, matched it to `REQ-MVJ1UKWC`, and completed treatment. Firestore readback showed the case `MATCHED`, request `MATCHED`, and match `COMPLETED`.
- Duplicate matching: NOT_VERIFIED as a second live click. The resulting match set contained exactly one match for the case; the Worker source and tests cover idempotent `match_keys`, but a second authenticated Admin invocation was not performed.
- Student search UI: NOT_VERIFIED. The newly approved student session reached the verification route once, but a later fresh Customer session remained on the app authentication loading state; no PASS is claimed for the rendered search page.
- Admin identity: PASS for the existing Staging Admin session. The session displayed `مدير النظام`; no Super Admin role or permissions were changed.

## Security and infrastructure evidence

- Worker health: PASS — `environment: staging`, `productionWrites: false`, `releaseSha: 4ff47d8`.
- Worker guards: PASS — missing token `401`; malformed token `401`.
- Firestore indexes: PASS — the four newly required composites reached `READY`.
- Universities: PARTIAL — two real active dental universities were available, so the UI/backend one-to-four cap was exercised with one selection; four distinct live universities were not available and no fake visible universities were inserted.
- R2/image upload: BLOCKED — R2 is intentionally disabled in Staging. The permitted text-only case path passed.
- Full two-concurrent-session cross-user isolation: NOT_VERIFIED. Rules and Worker guard tests pass locally, but a separate concurrent Patient/Student browser session was not completed in this run.

## Local verification

- Customer build: PASS.
- Customer lint: PASS with existing non-blocking React warnings.
- Customer registration security and flow tests: PASS.
- Admin build: PASS.
- Admin lint: PASS with existing non-blocking React warnings.
- Admin management display regression: PASS.
- Worker typecheck: PASS.
- Worker tests: PASS, 5/5.

## Release boundary

Customer Hosting was rebuilt and deployed to Firebase Staging after the fixes. Admin was exercised as the existing deployed Staging artifact; no Admin source change required a redeploy. Worker source was unchanged in this run, so its verified live release remains `4ff47d8`. Production/main/Blaze/R2 remain untouched.

The complete authenticated lifecycle is proven through Patient registration, case creation, Admin decisions, independent Student request creation, matching, completion, and Firestore readback. `PRODUCTION_READY` remains BLOCKED because Student search UI, duplicate invocation, and full concurrent cross-user browser isolation are not all independently proven, and R2 is unavailable by design.
