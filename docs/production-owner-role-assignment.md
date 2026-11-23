# Production Owner Role Assignment

This document outlines the procedure for assigning, verifying, and revoking the **Owner** role (`app_metadata.role = 'owner'`) on production accounts in the hosted Supabase project (`cwgsfhqrjzuvyuzieoai`).

---

## 1. Security Overview

- **Server-Managed Authorization (`app_metadata`)**:
  In Supabase, `raw_user_meta_data` is client-editable by end users and must **never** be used for authorization decisions or RLS policies. The application strictly checks the role stored in `raw_app_meta_data.role`, accessible in PostgreSQL RLS policies as `(auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'`.
- **No Hardcoded Owners**:
  No user account is automatically granted owner status during migrations or intake. The studio owner must be explicitly designated through the Supabase Dashboard SQL Editor.

---

## 2. Locating the Target Account UUID

1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/cwgsfhqrjzuvyuzieoai).
2. In the left navigation menu, click **Authentication** → **Users**.
3. Locate the intended owner's account (e.g. your studio Google, Discord, or Email account).
4. Click on the user or copy the UUID string under the **User UID** column (for example, `b69c3a35-0b39-486d-af84-197b1e2fee2c`).

---

## 3. SQL Prompt to Assign the Owner Role

1. In the Supabase Dashboard, navigate to the **SQL Editor** tab in the left sidebar.
2. Click **New query**.
3. Paste the following SQL prompt, replacing `'REPLACE_WITH_TARGET_USER_UUID'` with the copied User UID:

```sql
-- 1. Promote user to Owner role in raw_app_meta_data
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"owner"'::jsonb,
  true
)
WHERE id = 'REPLACE_WITH_TARGET_USER_UUID'::uuid;

-- 2. Verify the promotion
SELECT id, email, raw_app_meta_data->>'role' AS assigned_role, updated_at
FROM auth.users
WHERE id = 'REPLACE_WITH_TARGET_USER_UUID'::uuid;
```

4. Click **Run**.
5. The result grid will confirm that `assigned_role` is now `'owner'`.

---

## 4. Session Refresh (Crucial Step)

Because Supabase JWTs encode claims when issued:

1. Any currently active browser session for that account holds an existing JWT without the new `role` claim.
2. The user **must sign out and sign back in** (or wait for the automatic JWT token refresh).
3. Once re-authenticated, the user can navigate to `/owner/` and will see the full **Owner Dashboard** with access to:
   - Request review and detail stream.
   - Status transitions (`in_review`, `accepted`, `in_progress`, `completed`, `cancelled`).
   - Customer-visible updates and internal staff notes.
   - Planning due dates and priorities.
   - Finished deliverable file uploads and downloads.
   - Email template editor and preview tools.

---

## 5. SQL Prompt to Revoke the Owner Role

If the owner role needs to be demoted or removed:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role'
WHERE id = 'REPLACE_WITH_TARGET_USER_UUID'::uuid;

-- Verify revocation
SELECT id, email, raw_app_meta_data->>'role' AS assigned_role, updated_at
FROM auth.users
WHERE id = 'REPLACE_WITH_TARGET_USER_UUID'::uuid;
```
