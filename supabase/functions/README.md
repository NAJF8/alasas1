# Registration Functions — release preparation

No function was deployed by this task. The source is prepared for a later,
explicit Production rollout.

## Secret manifest (values stay in Supabase secrets)

- `ALLOWED_ORIGIN=https://alasas.tech`
- `RATE_LIMIT_SECRET=<random high-entropy value, at least 32 characters>`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are the
  platform-provided runtime values; do not add them to the frontend, Git, or
  this file.

`registration-request` is deployed with JWT verification disabled because it
is the public registration endpoint; it still validates the payload, checks
reference data, applies HMAC-based phone/IP limits, and uses service role only
inside the function. `registration-admin` remains JWT verified and calls
`auth.getUser()` before checking a verified ADMIN/SUPER_ADMIN profile.

Before rollout, set only the three non-built-in settings through the Supabase
Function Secrets UI/CLI, deploy each function explicitly, and run the approved
synthetic/limited Production canaries. Never place a service key in a `VITE_*`
variable.
