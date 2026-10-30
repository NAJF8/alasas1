# AL ASAS DENTAL — Medical Image Upload Readiness

Date: 2026-10-22
Target: `NAJF8/alasas1`, `codex/dental-staging-readiness`, Firebase project `al-asas-dental-staging`

## Decision

`MEDICAL_DATA_READY: BLOCKED`

The GitHub-backed medical-image path is intentionally not enabled. No patient
image was uploaded, no Production resource was changed, and no R2 or Blaze
resource was provisioned.

## Gate results

| Gate | Status | Evidence / reason |
|---|---|---|
| `GITHUB_PRIVATE_REPO` | `BLOCKED` | `NAJF8/alasas1` is public. The expected `NAJF8/alasas-assets` repository is not accessible from the authenticated account, and no dedicated private medical-image repository is present. |
| `GITHUB_APP_AUTH` | `BLOCKED` | The reference Worker requires `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, and `GITHUB_PRIVATE_KEY`, but no installation can be proven for a dedicated private medical repository. |
| `IMAGE_ENCRYPTION` | `NOT_VERIFIED` | The existing reference upload path sends raw bytes to GitHub Contents API and has no AES-256-GCM envelope-encryption or key-management implementation. |
| `UPLOAD_E2E` | `NOT_VERIFIED` | No approved private backend is available for a synthetic upload/readback test. |
| `IMAGE_VIEW_AUTHORIZATION` | `BLOCKED` | The reference implementation is admin-only and returns a GitHub raw URL; it does not implement patient ownership, case approval, or student isolation. |
| `PATIENT_IMAGE_ACCESS` | `NOT_VERIFIED` | No safe Worker route exists in this dental checkout. |
| `STUDENT_IMAGE_ISOLATION` | `NOT_VERIFIED` | Firestore rules intentionally do not grant students direct image-document reads; a trusted backend authorization path is still missing. |
| `ADMIN_IMAGE_ACCESS` | `NOT_VERIFIED` | Existing admin media code is for public site assets, not patient cases. |
| `DELETE_AND_RETENTION` | `BLOCKED` | A Git delete/commit is not sufficient proof of erasing history or copies. GitHub documents that sensitive data cannot be removed from other clones. |
| `FIRESTORE_METADATA` | `PARTIAL` | The current rules contain a `case_images` metadata path and keep image bytes out of Firestore, but the schema and backend lifecycle are not yet the approved encrypted-GitHub contract. |
| `WORKER_SECURITY` | `PARTIAL` | Firebase JWT verification and server-side role checks exist in related Worker code, but the reference media route is public-asset oriented and unsuitable for PHI. |
| `STAGING_DEPLOY` | `NOT_STARTED` | No medical-image Worker or UI change was deployed. |
| `MEDICAL_DATA_READY` | `BLOCKED` | Do not upload real patient data. |

## Reuse audit

The related AL ASAS media Worker was inspected for GitHub App token exchange,
Firebase token verification, Firestore metadata writes, MIME/magic-byte checks,
and rate limiting. It must not be copied as-is because it:

- writes through the GitHub Contents API;
- records and returns `raw.githubusercontent.com` URLs;
- treats media as public site assets;
- has no medical-case ownership, approval, or student-access decision;
- deletes a file reference/commit without proving repository-history and backup erasure.

## Technical constraints

The GitHub Contents API is not a suitable default transport for medical images:
GitHub recommends a 1 MB repository-file size, with a 100 MB hard limit, while
the existing dental UI accepts files up to 10 MiB. Cloudflare Workers also have
a 128 MB memory limit, so buffering, base64 expansion, encryption, and GitHub
API exchange must be designed and tested against the actual account limits.

## Required unblock conditions

Before implementation can continue, the project needs all of the following,
verified without exposing secrets:

1. A dedicated **private** repository owned by the intended organization/account,
   with Pages disabled and no public/raw delivery path.
2. A GitHub App installation on that repository with least-privilege Contents
   access, plus a confirmed installation ID. The App private key stays only in
   Cloudflare Secrets.
3. An approved key-management design independent of GitHub and Firestore,
   including AES-256-GCM, unique IVs, key versioning, rotation, and crypto-
   shredding/revocation.
4. A retention/deletion process that covers Git history, mirrors, backups,
   clones, and incident response. If that cannot be contractually and
   operationally guaranteed, use a private object store with lifecycle and
   deletion controls instead of GitHub for real patient data.
5. A dedicated Worker contract that verifies Firebase ID tokens, server-side
   UID/role/status, case ownership, approval, match scope, idempotency, MIME
   magic bytes, size limits, `Cache-Control: no-store`, and returns bytes only
   through the Worker—not a GitHub URL.

Until these conditions are met, the only permitted tests are synthetic,
non-patient fixtures against a local/emulator or an explicitly approved
isolated staging backend.
