# Dental public-media E2E

The live test uses an independent Playwright browser context and never copies
Chrome cookies, IndexedDB, or Firebase tokens. It creates synthetic PNG files
under the OS temp directory and removes them in `finally`.

From `admin-app`:

```powershell
$env:DENTAL_E2E_ADMIN_EMAIL = 'approved-test-admin@example.invalid'
$env:DENTAL_E2E_ADMIN_PASSWORD = '<secret-from-your-test-secret-store>'
npm run test:e2e:public-media
```

The credentials are read only from the process environment and are never
printed. Alternatively set `DENTAL_E2E_STORAGE_STATE` to an existing Playwright
state file outside this repository. Do not commit that file.

Without either an approved storage state or approved Email/Password test
secrets, the live test reports `ADMIN_TEST_AUTH=BLOCKED`; it does not fall back
to Google or guess credentials. `DENTAL_E2E_HEADLESS=1` makes this behavior
non-interactive.

The local Auth Emulator check is independent of live media acceptance:

```powershell
npx -y firebase-tools@latest emulators:exec --only auth "node tools/e2e/firebase-auth-emulator.mjs"
```

Emulator PASS proves only synthetic Auth signup/sign-in. It does not prove the
live Worker, GitHub Contents write, or Staging Admin role.
