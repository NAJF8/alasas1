# AL ASAS Dental Staging E2E completion report — 2026-10-22

Scope: `codex/dental-staging-readiness`, starting at `25368fd785d8edc37a0287ee8e14b1dcbb75e04f`. Production, `main`, Blaze/Billing, and R2 were not changed.

## Implemented

- Admin cases, student requests, matches, and treatment completion now use authenticated Worker routes for decisions; the Admin client does not write approval/status/match/audit documents directly through the Firestore SDK.
- Case approval/rejection, student-request approval/rejection, match creation, idempotent match response, and treatment completion refresh the Admin table after the Worker response for Firestore readback.
- `/users`, `/patients`, `/students`, and `/admins` no longer call the missing `list_profiles_for_admin` RPC; they read Firebase profiles under the existing Firestore manager rules.
- Worker `/health` exposes a non-secret `releaseSha` fingerprint for the Staging artifact.

## Evidence

- Admin build: PASS (`npm run build`); existing lint warnings only, no lint error.
- Customer build: PASS (`npm run build`); existing lint warnings only, no lint error.
- Worker typecheck/tests: PASS (`npm run typecheck`, `npm test`, 3/3 tests).
- Customer registration tests: PASS (`registration security matrix`, `registration flow validation matrix`).
- Admin display regression: PASS.
- Local rendered QA: PASS on Desktop 1440x900 and Mobile 390x844 for Customer/Admin; meaningful DOM, no framework overlay, no console errors, no horizontal overflow; Customer login navigation exercised.
- Staging rendered QA: PASS on Desktop/Mobile for Customer/Admin; no console errors, no horizontal overflow, no Supabase runtime requests.
- Staging Worker health: PASS — `productionWrites:false`, `releaseSha:85283ec`.
- Staging Worker auth guards: PASS — missing token `401 AUTH_REQUIRED`, malformed token `401 INVALID_TOKEN`, expired-token payload `401 INVALID_TOKEN`.
- Staging Hosting deploy: PASS — Customer and Admin releases completed.
- Staging Worker deploy: PASS — version `96c40ab9-a15c-4d76-b182-afffbb1bb48c`.

## Gate matrix

| Gate | Result | Boundary |
| --- | --- | --- |
| `ADMIN_ACTIONS_E2E` | NOT_VERIFIED | UI wiring and local Worker guards pass; no authenticated Admin identity was used for a Firestore mutation/readback. |
| `PATIENT_REGISTRATION` | NOT_VERIFIED | Validation tests pass; no separate Staging test account completed the full authenticated flow. |
| `STUDENT_REGISTRATION` | NOT_VERIFIED | Same boundary as Patient registration. |
| `CASE_CREATION` | NOT_VERIFIED | Requires an authenticated Patient and live Worker/Firestore readback. |
| `STUDENT_SEARCH` | NOT_VERIFIED | Requires an authenticated Student and approved live case. |
| `STUDENT_REQUEST` | NOT_VERIFIED | Requires an authenticated Student and live request readback. |
| `ADMIN_APPROVAL` | NOT_VERIFIED | Worker route exists and is protected; no live Admin decision was executed. |
| `MATCHING` | NOT_VERIFIED | Idempotent transaction path exists; no live pair was matched twice. |
| `CASE_COMPLETION` | NOT_VERIFIED | Worker route exists and is protected; no live match was completed. |
| `CROSS_USER_ISOLATION` | NOT_VERIFIED | Full two-session Patient/Student isolation was not executed in this run. |
| `FIRESTORE_READBACK` | NOT_VERIFIED | No live test data was created, so no mutation readback can be claimed. |
| `STAGING_DEPLOY` | PASS | Hosting and Worker Staging deployments completed; release fingerprint and health checked. |
| `PRODUCTION_READY` | BLOCKED | Full authenticated lifecycle and multi-user isolation remain open; Google human sessions and R2/image path are intentionally not required for the UI repair but are required for a full release decision. |

## Required next human-controlled step

Provide or authorize three separate non-human Firebase Auth Staging test accounts (PATIENT, STUDENT, ADMIN) using supported non-Google sign-in, or explicitly open the two required Google sessions. Then execute the lifecycle with fresh tokens and record Firestore readback plus Audit Logs. Do not reuse real-person accounts or create fake Google OAuth sessions.
