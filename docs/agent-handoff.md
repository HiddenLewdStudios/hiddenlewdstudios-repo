# Agent handoff — 2026-11-24

## Current milestone

Phases 1 through 4 are complete, including production deployment of Phase 4 database migrations, Edge Functions, finished deliverable access, and OAuth provider alignment. Phase 5 remains deferred pending payment-processor eligibility.

## Completed product work

- Astro/React site configured with static output and verified clean build.
- Supabase Auth supports password sign-in/sign-up, email magic links, password recovery,
  session-only sign-in, and Google/Discord OAuth entry points. Local OAuth callback URL is aligned to
  `http://localhost:54321/auth/v1/callback` to adhere to provider restrictions against raw IP addresses.
- Request submission is authenticated and persists a stable request number, form detail, cast,
  initial status, and private JPG/PNG/WebP reference uploads.
- The `request-references` Storage bucket is private. Customers can only access their own objects.
- Finished Deliverable Access (Sprint 3.9):
  - Dedicated private `request-deliverables` storage bucket and `request_deliverables` database table.
  - Owners can upload finished artwork, variant files, image packs, and story archives directly from
    `/owner/` and delete them if needed.
  - Customers can review and download finished deliverables with one-hour signed URLs from their
    authenticated `/requests/` history.
- The `send-request-notifications` Edge Function verifies caller identity and request ownership. It
  sends customer/owner notifications through Resend in production when enabled. Local development
  routes notifications to Mailpit.
- Customer history at `/requests/` provides RLS-filtered request tracking, status timelines, customer
  updates, reference image previews, and finished deliverable downloads using one-hour signed URLs.
- Owner workspace at `/owner/` provides authenticated, server-verified request management: status
  transitions, customer-visible updates, internal staff notes, planning (due dates and priorities),
  client-side pagination (20/page), CSV export, email-template management, and deliverable file uploads.
- Profiles retain the last submitted supporter nickname, support platform, and Shinobi
  Registration, prefilling future requests safely with defensive rank lookups.

## Applied database migrations

All 12 migrations are applied and active across local development and the hosted Supabase project (`cwgsfhqrjzuvyuzieoai`):

1. `20261117194631_phase2_request_intake.sql`
2. `20261118134401_request_notification_deliveries.sql`
3. `20261118164530_remember_profile_request_details.sql`
4. `20261119175904_backfill_profile_request_details.sql`
5. `20261119180911_phase3_owner_authorization.sql`
6. `20261119221851_phase3_request_communications.sql`
7. `20261119224234_phase3_owner_status_transitions.sql`
8. `20261119232152_phase3_request_planning.sql`
9. `20261119235159_phase3_email_templates.sql`
10. `20261120092326_phase4_character_search_cache.sql`
11. `20261120120000_acdb_request_interval.sql`
12. `20261123150000_request_deliverables.sql`

## Required hosted Dashboard configuration

1. Assign the production owner account with the SQL documented in
   [Production owner role assignment](./production-owner-role-assignment.md). This modifies
   `auth.users.raw_app_meta_data.role` (never `user_metadata`). Sign out and back in (or refresh the
   session token) after running the query.
2. Hosted Edge Functions:
   - `send-request-notifications` deployed and configured with `NOTIFICATION_DELIVERY_ENABLED`,
     `RESEND_API_KEY`, `OWNER_NOTIFICATION_EMAIL`, and `EMAIL_FROM`.
   - `character-search` deployed and configured with secret `ACDB_EXTERNAL_ENABLED=true`.

## Local development

1. Start the local stack with `npm run supabase:start`.
2. Start Astro with `npm run dev`.
3. Mailpit is available at `http://127.0.0.1:54324`.
4. Run `npm run supabase:reset` to recreate disposable `HLS-DEV-*` request fixtures.
   `abu@gmail.com` has owner privileges; `abu2@gmail.com` is a customer. Both use
   `ChangeMe!LocalOnly2026`.

## Phase 4 — ACDB Character Search — Complete

- Authenticated character autocomplete uses `character-search`, a JWT-required Edge Function.
  Browser traffic never calls ACDB directly. Anonymous users and local development retain the
  local catalog fallback.
- `ACDB_EXTERNAL_ENABLED` is explicitly `false` in local Edge Runtime configuration. Production
  has the feature flag enabled as a hosted secret (`ACDB_EXTERNAL_ENABLED=true`).
- The proxy has a private database cache (`character_search_cache`), same-query cache-miss
  coalescing (`character_search_inflight`), a service-role-only atomic global one-request-per-second
  permit (`reserve_acdb_request`), timeout, no redirects, no automatic retries, and a shared
  failure cooldown honoring `Retry-After`.
- ACDB source links and Open Database License (ODbL) attributions are prominently displayed.
- Network-isolated tests pass via `npm run test:acdb`.

## Sprint 3.9 — Finished Deliverable Access — Complete

- Owners can upload finished art files to the private `request-deliverables` bucket and record them in
  `request_deliverables`.
- Customers can access and download finished artwork securely with one-hour signed URLs from
  `/requests/`.
- Owners can inspect, download, and delete deliverables from the request detail in `/owner/`.

## Verification baseline

```sh
npm run format:check
npm run lint
npm run check
npm run test:acdb
npm run build
```

The build is completely clean (0 errors, 0 warnings, 1 standard deprecation hint for the clipboard copy fallback in `RequestForm.tsx`).
