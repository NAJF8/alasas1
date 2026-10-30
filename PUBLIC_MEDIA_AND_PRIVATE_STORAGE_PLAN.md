# AL ASAS Dental — Public media and private medical storage

Date: 2026-10-22  
Scope: Staging branch only. No Production, `main`, billing upgrade, patient data, or secret was changed.

## Implemented in this branch

- Added an authenticated Worker route, `POST/GET /api/public-media`, for public site assets only.
- The route requires a verified Firebase profile with `ADMIN` or `SUPER_ADMIN` role.
- GitHub App ID, installation ID, private key, and asset repository are read only from Cloudflare Worker secrets/vars; none are committed.
- Uploads are limited to PNG/JPEG/WebP/SVG and 5 MiB by default. Metadata is written to `public_media_assets`; the public URL is a versioned GitHub raw URL because these files are intentionally public.
- Admin branding now uses that route and provides upload, preview, library listing, and delete controls. Medical images are not accepted by this route.
- The patient case form now supports local selection and removal of synthetic/test files, but clearly reports that files are not transmitted while private medical storage is unavailable.

## Medical-storage decision

`MEDICAL_IMAGE_UPLOAD = BLOCKED` for this release. The existing Worker R2 path remains fail-closed with `R2_NOT_CONFIGURED`; no patient image was uploaded, viewed, or deleted. This is intentional: a GitHub repository/raw URL is not an acceptable medical transport, and the current Staging project has no approved private object-store binding.

| Option | Security/control | Free allowance / cost signal | Decision |
|---|---|---|---|
| Cloudflare R2 + Worker proxy | Private bucket, Worker authorization, `no-store`, object delete, lifecycle rules; encryption at rest is provider-managed. Requires application-level UID/case authorization and audit metadata. | 10 GB-month, 1M Class A, 10M Class B monthly; then $0.015/GB-month, $4.50/M Class A, $0.36/M Class B; egress is free. | Best fit for this Worker architecture, but adding the R2 subscription/bucket may require billing approval. |
| Firebase Cloud Storage | Firebase Auth/Rules integration and object lifecycle are familiar, but the current Staging plan intentionally does not have an enabled paid Storage path. | Firebase documents Cloud Storage as a paid-tier product with no-cost quotas; Blaze links a billing account and enables pay-as-you-go overage. | Do not enable without explicit billing approval and a dedicated bucket/rules test. |
| Supabase Storage | Private buckets, RLS policies, signed URLs, and object deletion are available; existing medical SQL/RLS material is not a live authorized deployment in this branch. | Free plan includes 1 GB storage and 5 GB egress; Pro starts at $25/month and includes 100 GB storage. | Viable only after an isolated, approved Supabase project and policy/readback test; not selected for this Firebase Staging release. |
| Amazon S3 | Strong IAM/KMS/lifecycle/versioning controls, but more services and operational cost; use short-lived presigned URLs or a backend proxy. | Pay-as-you-go; new AWS customers may receive credits, not a guaranteed ongoing free tier. | Not enabled; requires a new cloud account/billing/security review. |

## Required approval to unblock medical upload

1. Approve a private R2 bucket and the associated Cloudflare billing/subscription step, or name another approved private store.
2. Approve retention duration, deletion semantics, backup/versioning policy, and incident response.
3. Configure the bucket binding and Worker secrets outside Git; never add a service key to Pages or Firestore.
4. Run a Staging-only synthetic test proving upload, authorized patient read, authorized admin read, unauthorized student read denial, delete, Firestore metadata cleanup, and retention/lifecycle behavior.

Sources checked on 2026-10-22: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Supabase Storage pricing](https://supabase.com/docs/guides/storage/pricing), and [Supabase platform billing](https://supabase.com/docs/guides/platform/billing-on-supabase).
