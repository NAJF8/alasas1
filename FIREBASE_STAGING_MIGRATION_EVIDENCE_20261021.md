# AL ASAS Dental Firebase Staging Evidence — 2026-10-21

This file records live, read-only source verification and Firebase Staging verification performed on 2026-10-21. It intentionally contains no patient names, phone numbers, email addresses, access tokens, passwords, or image URLs.

## Approved boundary

- Source: Supabase project `nkzvxdobklsehdyzyzmy` (`alasas1`), read-only.
- Destination: Firebase project `al-asas-dental-staging`, Firestore `(default)`, Standard edition, `asia-southeast1`.
- Authenticated Google CLI identity: verified account `alasastech0@gmail.com`.
- No Supabase INSERT/UPDATE/DELETE, migration, Auth mutation, Storage mutation, or Production deployment was performed.
- No Blaze upgrade or paid resource was enabled.

## Direct source readback

Supabase connector readback confirmed an active/healthy PostgreSQL 17 project with 26 public tables, all with RLS enabled. The current row total is 59:

| Non-empty table | Rows |
| --- | ---: |
| provinces | 19 |
| areas | 8 |
| clinical_categories | 16 |
| profiles | 4 |
| subscription_plans | 2 |
| system_settings | 2 |
| universities | 2 |
| patient_preferred_universities | 2 |
| student_preferred_universities | 2 |
| branding_settings | 1 |
| matching_settings | 1 |

The remaining 15 public tables currently contain zero rows. Source Auth contains 4 users; the Auth UID hash and `public.profiles.id` hash are both `c4e250e6b9cc556d882a0e34f5b6a007`.

## Firebase Staging readback

- Firestore database exists and is Standard edition in `asia-southeast1`.
- Current Firestore state: 11 non-empty collections and 59 documents.
- The 59 documents are the same 26-table mapping: the 11 non-empty source tables have matching document counts and matching ordered ID hashes; the 15 empty source tables have zero documents.
- Firebase Auth export readback contains 4 users. Ordered Auth localId hash is `c4e250e6b9cc556d882a0e34f5b6a007`.
- Firestore `profiles` document-ID hash is also `c4e250e6b9cc556d882a0e34f5b6a007`; all four Auth IDs therefore have a matching profile ID.
- The existing Staging state was not replaced or padded. The 59/4 result is current direct readback, not a synthetic correction.

## Rules and application state

- `firestore.rules` is now hardened at commits `de3d8e5` and `047b2e9`: STAFF is no longer treated as an administrator; only verified Super Admins can manage roles, manager invitations, and permission documents; client profile creation is restricted to pending PATIENT/STUDENT records; client updates preserve ownership, role, status, and administrative fields; case/request status changes and match/appointment writes are Backend-only; clients cannot write audit records; students cannot directly read medical case-image documents.
- The hardened rules passed an authenticated Firestore Emulator matrix covering self-verification, role escalation, STAFF permission writes, student medical-case reads, patient self-approval, student match writes, patient-owned reads, Super Admin role management, and Backend-only matching enforcement.
- The hardened rules were deployed to Firebase Staging only with `firebase deploy --only firestore:rules --project al-asas-dental-staging`; the CLI returned `status: success`.
- Baseline Customer and Admin builds pass on this branch. They still import `@supabase/supabase-js`; therefore a build is not evidence of Firebase application E2E.
- Firebase Hosting sites exist for Customer (`al-asas-dental-staging.web.app`) and Admin (`al-asas-dental-admin.web.app`). No hosting deployment was performed in this turn because the built applications are still Supabase-backed.

## Status matrix

| Gate | Status | Evidence / boundary |
| --- | --- | --- |
| SOURCE_EXPORT_VERIFIED | PASS | Direct Supabase catalog, counts, Auth/profile ID hash, and read-only SQL fingerprints. A raw Auth export is stored locally under `_backups/` and is not tracked. |
| FIREBASE_PROJECT_VERIFIED | PASS | Direct CLI project list, Google identity, Firestore database metadata, web app list, and live document/Auth counts. |
| FIRESTORE_MIGRATION | PASS (existing state verified) | Counts and ordered ID hashes match the source mapping; no destructive replacement was needed. Full field-by-field content hash is not claimed until a protected canonical export comparison is completed. |
| AUTH_MIGRATION | PASS (identity linkage) | 4 Firebase users, 4 profiles, matching UID/profile hash. Password material was not exported or displayed. |
| SECURITY_RULES | PASS (Emulator + deployment) | Hardened rules passed the local authenticated Emulator matrix and deployed successfully to Staging. Full live multi-role E2E remains open. |
| CUSTOMER_FIREBASE | BLOCKED | Customer code still uses Supabase SDK and Supabase Auth/Storage/RPC. |
| ADMIN_FIREBASE | BLOCKED | Admin code still uses Supabase SDK, RPCs, Edge Functions, and Supabase Auth. |
| REGISTRATION_E2E | BLOCKED | Requires a deployed Firebase backend function/API and approved test identities; no fake client-only flow was introduced. |
| PATIENT_CASE_E2E | BLOCKED | Requires Firebase Auth + private image backend/storage path and rules-tested read/write flow. |
| STUDENT_MATCHING_E2E | BLOCKED | Requires backend matching logic and anonymized query endpoint; direct Firestore access is intentionally denied. |
| ADMIN_APPROVAL_E2E | BLOCKED | Requires server-side invitation/approval operations and audit writes; Firestore rules deny client audit writes. |
| STAGING_DEPLOY | PARTIAL | Firestore rules deployed successfully; Customer/Admin Hosting deployment intentionally withheld while both apps remain operationally Supabase-backed. |
| PRODUCTION_UNCHANGED | PASS | No Supabase Production write, migration, Auth change, Storage change, or deployment command was executed. |

## Why earlier reports said 59/4 and the latest check said 0/0

The live readback now reproduces 59 Firestore documents and 4 Firebase Auth users. The earlier 59/4 reports are consistent with this project and current Google account. The 0/0 result cannot be reconciled as a current state of this same `(default)` database: it indicates a different project, a different Firebase account/session, a different database/namespace, or a read performed before the Staging data was present. No evidence supports deleting or creating replacement data to force either number.

## Commit/deployment boundary

This evidence and the Rules change are Staging-only. The application SDK replacement, backend registration/approval/matching implementation, authenticated multi-role E2E, private image storage, and Hosting release remain open gates and must not be marked READY_FOR_USE from the current evidence.
