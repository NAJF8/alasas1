# Local-only migrations

These SQL files are retained historical test fixtures for the isolated restore.
They are deliberately outside `supabase/migrations`, so `supabase db push`,
`supabase db reset`, and CI migration discovery do not apply them.

The production registration candidate is the separately numbered file in
`supabase/migrations/20261011193000_registration_approval_foundation.sql`.
Run these fixtures only against the isolated restore with synthetic identities.
