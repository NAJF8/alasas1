# ALASAS Dental — Recovery gap register

## Verified local archive

`C:\Users\MSI\Desktop\alasas-backup-20261011.zip.aes` was decrypted with
`C:\Users\MSI\Desktop\alasas-backup-20261011.key.dpapi` under the current
Windows account. AES-GCM authentication succeeded and all three manifest
hashes matched. The archive contains only the three exported SQL files and
`manifest.json`; it is not a complete Supabase project backup.

The DPAPI wrapper uses `CurrentUser`. A different Windows account or a machine
without the original DPAPI profile cannot currently decrypt it. The independent
decryption test therefore remains unproven.

## Not covered by the archive

- `auth.users`, identities, sessions, refresh tokens, MFA factors, and Auth configuration.
- `storage.objects` file bytes, bucket metadata, Storage service configuration, and managed Storage migration state.
- Edge Function deployed versions, Function secrets, and production environment values.
- Google OAuth client/configuration, redirect allow-list, SMTP provider/configuration, and email templates.
- DNS records, custom-domain/TLS state, GitHub Pages settings, and repository/CI secrets.
- Supabase project settings, RLS/policies outside the exported SQL, logs, scheduled jobs, and platform-managed metadata.

## Practical recovery path

1. Restore PostgreSQL/public SQL into an isolated Supabase project or local restore using the matching PostgreSQL major version.
2. Recreate Auth configuration and users through the supported Supabase Auth/admin paths; do not hand-edit managed Auth tables.
3. Restore Storage buckets and object bytes from a separately retained object backup; do not edit `storage.migrations` manually.
4. Re-deploy Functions from `supabase/functions/` after setting `ALLOWED_ORIGIN` and `RATE_LIMIT_SECRET` through Supabase Function Secrets. Built-in Supabase runtime variables remain platform-provided.
5. Re-enter OAuth/SMTP/DNS settings from an external configuration record, then run isolated and limited production canaries.

No external destination for the encrypted archive or DPAPI key was specified.
No copy was created, moved, or assumed to exist off-device.
