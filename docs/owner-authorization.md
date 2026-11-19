# Owner authorization

Sprint 3.2 adds a single `owner` role for read-only owner access to request data. The role is
stored in Supabase Auth's server-managed `raw_app_meta_data`, exposed to authenticated database
policies as `auth.jwt() -> 'app_metadata'`. It never uses `raw_user_meta_data` or browser-editable
`user_metadata` as an authorization source.

## Access model

- Customers retain the existing RLS access to only their own requests, cast, reference metadata,
  private reference files, and status history.
- An authenticated account whose app metadata has `{"role":"owner"}` can read all of those
  request records and the existing objects in the private `request-references` bucket.
- No owner write, delete, or public-Storage policy is included. The bucket remains private and
  owner reads still use authenticated Storage requests or short-lived signed URLs.
- Owner navigation is rendered only after `auth.getUser()` verifies the session and its
  server-managed app metadata. Database and Storage RLS remain the authority; hiding navigation is
  not relied on for security.
- This sprint does not add request status writes, customer messages, or a staff-note editor.
  Those need separate customer-visible update and staff-only-note models before any editor exists.

## Required Supabase Dashboard configuration

After applying migration `20261119180911_phase3_owner_authorization.sql`, assign the role from
**Supabase Dashboard → SQL Editor**. Copy the intended account UUID from **Authentication → Users**;
do not identify the account by an unverified browser value and do not put this role in user metadata.

```sql
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"owner"'::jsonb,
  true
)
where id = 'replace-with-the-owner-account-uuid'::uuid;
```

The owner must sign out and sign back in (or refresh their token) before the new `app_metadata`
claim is present in their JWT. To revoke the role, run:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
where id = 'replace-with-the-owner-account-uuid'::uuid;
```

Do not make `request-references` public, add a service-role key to the frontend, or commit a
project URL, service-role key, Resend credential, or OAuth secret.
