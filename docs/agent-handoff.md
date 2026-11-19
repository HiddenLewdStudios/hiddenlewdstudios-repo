# Agent handoff — 2026-11-19

## Current milestone

Phases 1 and 2 are complete. Phase 3 is active. Sprints 3.1–3.5 are complete; the next task is
operational controls such as due dates, priority, pagination, export, and regression coverage.

## Completed product work

- Astro/React site with a GitHub Pages deployment workflow and base path
  `/hiddenlewdstudios-repo/`.
- Supabase Auth supports password sign-in/sign-up, email magic links, password recovery,
  session-only sign-in, and visible Google/Discord OAuth entry points. Provider credentials have
  not been configured.
- Request submission is authenticated and persists a stable request number, form detail, cast,
  initial status, and private JPG/PNG/WebP reference uploads.
- The `request-references` Storage bucket is private. Customers can only access their own objects.
- The `send-request-notifications` Edge Function verifies the caller and request ownership. It
  sends customer/owner notifications through Resend in production when enabled. Local development
  sets `MAILPIT_URL=http://inbucket:8025`, so enabled notifications go to Mailpit instead.
- `/requests/` provides customer history. It uses RLS-filtered reads and uses one-hour signed URLs
  for private image previews; it does not expose object paths as public URLs.
- The request page and `/requests/` both provide sign-in flows. The request page displays **My
  requests** only for signed-in users.
- Profiles retain the last submitted supporter nickname, support platform, and Shinobi
  Registration, which prefill the next request form while remaining editable.

## Applied database migrations

- `20261117194631_phase2_request_intake.sql`
- `20261118134401_request_notification_deliveries.sql`
- `20261118164530_remember_profile_request_details.sql`
- `20261119175904_backfill_profile_request_details.sql`

The latest two add and backfill `profiles.last_supporter_nickname`,
`profiles.last_supporter_platform`, and `profiles.last_shinobi_registration`. They have been
applied to both local and hosted Supabase.

## Pending hosted database deployment

- `20261119180911_phase3_owner_authorization.sql` has been verified locally but still needs to be
  applied to the hosted project through the normal migration deployment process. After it is
  applied, assign the intended owner account using the Dashboard SQL in
  [Owner authorization](./owner-authorization.md). The owner must then sign out and back in (or
  refresh their token) before the role becomes active.
- `20261119221851_phase3_request_communications.sql` has been applied only to the local stack and
  likewise needs the normal hosted migration deployment before customer updates or internal notes
  are used in production. It requires no additional Dashboard configuration.
- `20261119224234_phase3_owner_status_transitions.sql` has been applied only to the local stack and
  requires the normal hosted migration deployment before owner status controls are used in
  production. It requires no additional Dashboard configuration.

## Local development

1. Start the local stack with `npm run supabase:start`.
2. Start Astro with `npm run dev`.
3. Use `http://127.0.0.1:4321/hiddenlewdstudios-repo/`.
4. Mailpit is available at `http://127.0.0.1:54324`.
5. For remote development, use the SSH port-forwarding command in `README.md` and browse the same
   loopback URL.

`supabase/functions/.env` is ignored. With `NOTIFICATION_DELIVERY_ENABLED=true`, local request
notifications go to Mailpit, not Resend. The function’s local Mailpit endpoint comes from
`[edge_runtime.secrets]` in `supabase/config.toml`; do not add that setting to hosted function
secrets.

The current local database includes disposable `HLS-DEV-*` request fixtures spanning accepted,
in-progress, completed, and cancelled work. `abu@gmail.com` has local server-managed owner app
metadata, and the fixtures include one customer-visible update and one internal note. This data is
local only and is removed by a local reset.

## Hosted configuration

- Frontend Actions variables: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Hosted function secrets: `NOTIFICATION_DELIVERY_ENABLED`, `RESEND_API_KEY`,
  `OWNER_NOTIFICATION_EMAIL`, and `EMAIL_FROM`.
- The notification Edge Function is deployed at version 4.
- Do not add hosted project URLs, service-role keys, Resend keys, or OAuth client secrets to tracked
  files.

## Next implementation boundary

Add operational controls in narrow, separately authorized increments: due dates and priority first,
then pagination/export and a browser regression checklist. Keep private files private, retain
immutable status history, and do not weaken customer isolation.

## Sprint 3.2 — owner authorization and owner-only policies — Complete

- Owner authorization uses the server-managed `auth.users.raw_app_meta_data.role` claim only;
  `user_metadata` is never used for authorization.
- Narrow, read-only owner RLS policies allow an authenticated `owner` to read requests, request
  characters, reference metadata, status history, and existing reference objects in the private
  `request-references` bucket. Customer ownership policies remain unchanged.
- The reference bucket remains private. No Storage object is public and no owner write/delete
  policy was added.
- The footer shows **Owner workspace** only after the browser verifies the authenticated user with
  `auth.getUser()` and checks server-managed app metadata. RLS remains the access authority.
- The owner workspace is an authorization-checked placeholder only; no dashboard, status editor,
  customer-update editor, or staff-note editor has been built. Customer-visible updates and
  internal notes must be modeled separately first.
- See [Owner authorization](./owner-authorization.md) for the required Dashboard SQL to grant or
  revoke the role, including the required owner token refresh.

## Sprint 3.3 — read-only owner request dashboard — Complete

- `/owner/` now provides a server-verified, read-only owner workspace. It lists all RLS-authorized
  requests, supports request-number/supporter/platform/email search and status filtering, and
  opens a selected request's full detail.
- Detail loads cast, brief, customer contact fields, status history, reference metadata, and
  one-hour signed previews for private reference images only after selection. It never exposes a
  public Storage URL.
- The dashboard performs no mutations: no status changes, customer updates, staff notes, due dates,
  priorities, exports, or email-template editing are present.
- The owner authorization pgTAP suite was made fixture-specific so it remains reliable when the
  local database contains other requests. It continues to assert customer isolation, rejection of
  `user_metadata` escalation, owner reads, and the private bucket setting.

## Sprint 3.4 — customer updates and internal notes — Complete

- Customer-visible updates and internal notes now use separate immutable tables, constraints, and
  RLS policies. Customer updates are readable by the request owner and owners; internal notes are
  readable only by owners. Both creation policies require server-managed owner app metadata and
  `created_by = auth.uid()`.
- Owners can post either type from a selected request in `/owner/`. `/requests/` shows only the
  customer-visible update timeline; internal notes are never queried or rendered there.
- The communications pgTAP suite covers customer read access, denial of customer creation,
  rejection of `user_metadata` escalation, and owner reads/creates for both streams.

## Sprint 3.5 — owner status controls and audit history — Complete

- Owners can change a request only along these server-enforced transitions: `submitted` →
  `in_review`/`cancelled`; `in_review` → `accepted`/`cancelled`; `accepted` →
  `in_progress`/`cancelled`; and `in_progress` → `completed`/`cancelled`. `completed` and
  `cancelled` are terminal.
- The `requests` table now grants authenticated users update permission only for the `status`
  column, and an owner-only RLS policy plus a protected trigger validates every change. A permitted
  change creates an immutable `request_status_history` record with the authenticated owner ID.
- `/owner/` offers only valid next-status choices. The trigger remains authoritative even if a
  client request is manipulated.
- The status pgTAP suite proves customer and `user_metadata` denial, valid owner changes, history
  attribution, invalid-transition rejection, and rejection of non-status request updates.

## Deferred item

Post-release: allow sign-in by supporter nickname as well as email. First make the canonical
nickname case-insensitively unique, resolve existing duplicates, and perform nickname-to-account
resolution only in a protected server-side path.

## Verification baseline

Run:

```sh
npm run lint
npm run format:check
npm run build
git diff --check
```

The build currently has one pre-existing hint: `document.execCommand("copy")` is deprecated in the
clipboard fallback in `src/components/RequestForm.tsx`. It has no build errors or warnings.
