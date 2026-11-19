# Hidden Lewd Studio — Development Plan

## Current status

Phases 1 and 2 are complete. Phase 3 is the active milestone: customer request history and an
owner-only request-management dashboard.

### Phase 1 complete scope

- Astro, TypeScript, React, and Tailwind project foundation.
- Static GitHub Pages deployment workflow.
- A client-side request-form demo with tier/category rules, a local character catalog, cast and
  tag randomizers, review/receipt flow, copy, and PNG export.
- Adult-confirmation and commission-policy acknowledgements in the form.
- Terms, privacy, commission/content policy, contact, commission information, gallery, and FAQ
  preview pages.
- ESLint and Prettier commands for ongoing code quality.

### Phase 1 limits

- A receipt is a browser-local summary, not a submitted order or source of truth.
- Character data is a small local demo catalog and does not establish adult eligibility.
- Reference uploads, payment, Discord integration, emails, authentication, database records, and
  supporter verification are intentionally absent.

### Phase 1 release gate

The project now uses patched Astro 7.4.12, and `npm audit --omit=dev` reports no known
vulnerabilities. Before public deployment, upgrade the build runtime to Node.js 22.23.4 or newer,
which Astro 7.4.12 requires, then repeat the full browser and production-build verification.

## Pre-launch owner decisions

Before real request intake, the project owner must approve commission types and pricing, workload
capacity, revisions, delivery rules, refund/cancellation terms, privacy retention, prohibited
content rules, and the platform/provider policies that apply to the business model.

## Phase 2 — Secure request intake — Complete

1. Configure Supabase environments, authentication, database schema, and row-level security.
2. Persist requests, stable request IDs, and status-history records.
3. Add private reference-image uploads with file validation, safe processing, retention, and
   protected owner access.
4. Send customer confirmations and owner notifications through server-side services.
5. Before closing the phase, define and perform live browser regression testing for the complete
   request flow, including tier/category selection, cast randomization, receipt confirmation,
   clipboard copy, and PNG download.

### Phase 2 implementation status

- Supabase project `HiddenLewdStudios` now has RLS-protected profiles, requests, characters,
  references, and request-status history tables.
- The `request-references` Storage bucket is private, accepts only JPG, PNG, and WebP files up to
  10 MB, and permits authenticated users to access only files belonging to their own requests.
- The client supports password sign-in, sign-up, password recovery, email sign-in links, optional
  session-only sign-in, and Google/Discord OAuth entry points. OAuth provider credentials must be
  configured in Supabase before those two providers can be used.
- Each saved request queues one customer confirmation and one owner-notification delivery. The
  protected `send-request-notifications` Edge Function sends them through Resend only when
  notification delivery is explicitly enabled and its secrets are configured; no email-provider
  credential is exposed to the browser.
- Before deployment, configure Supabase Auth’s Site URL and redirect allow-list with
  `https://hiddenlewdstudios.github.io/hiddenlewdstudios-repo/`. Add the local development URL as
  needed.

### Notification and email decisions

- Use Resend as a temporary transactional-email provider during testing. Its free tier is adequate
  for testing; Hostinger email is the intended later provider. Keep the notification service behind
  a provider adapter so this future change does not alter request storage, templates, or retries.
- Customer confirmations go only to the signed-in account’s verified email and include the stable
  request number. Owner notifications include the request number and request summary, but never
  include private Storage URLs.
- Default templates are held in the Edge Function during Phase 2. Phase 3 adds an owner-only
  template editor with subject/body preview, test send, placeholder validation, version history,
  and restore-default controls.
- Delivery jobs are stored in `request_notification_deliveries` with an idempotent customer/owner
  pair, attempt count, provider message ID, and delivery error. The browser may start delivery, but
  email is rendered and sent only by the authenticated Edge Function.

### Phase 2 deployment configuration

Set the following repository **Actions variables** before deploying the authenticated build:

- `PUBLIC_SUPABASE_URL` — the hosted project URL from Supabase Dashboard → Connect.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the active Supabase publishable key.

These values are safe to expose to the browser. Do not add a service-role key to GitHub Actions,
frontend environment variables, or client-side source code.

Configure these **Supabase Edge Function secrets** before enabling live request notifications:

- `NOTIFICATION_DELIVERY_ENABLED` — set to `true` only in a hosted environment where outbound
  delivery is intended. Leave it unset or `false` during local development.
- `RESEND_API_KEY` — temporary Resend API key; never commit it.
- `OWNER_NOTIFICATION_EMAIL` — inbox that receives new-request alerts.
- `EMAIL_FROM` — Resend sender identity used for the testing sender/domain.

Delivery is disabled by default. In production it requires `NOTIFICATION_DELIVERY_ENABLED=true`
plus all three provider secrets; otherwise requests still save safely without calling Resend. In
local development, enabling that flag routes notifications to Mailpit through the local-only
`MAILPIT_URL` Edge Runtime setting, so no real email is sent.

### Local Auth email testing

The repository includes a local Supabase configuration for Mailpit-based Auth email testing. See
[Local Supabase email-flow testing](./local-supabase-email-testing.md) for setup, local environment
variables, and the test workflow. This stack is separate from the hosted Supabase project.

## Phase 3 — Dashboards

- Customer request history, status, messages, and secure delivered-file access.
- Owner request list, filters, status changes with notes, due dates, priority, export, and audit
  history.
- Owner-only email-template editor, preview, test-send, version history, and restore-default
  controls.

### Phase 3 implementation status

- Sprint 3.1 is complete: `/requests/` is an authenticated customer history page. It lists only
  the signed-in user’s requests through existing RLS policies, including request numbers, status,
  submitted brief, cast, and private reference-image previews made with expiring signed URLs.
- The requests page contains its own password and magic-link sign-in modal, so customers do not
  need to return to the request form to authenticate.
- The request form now presents a signed-in user with a **My requests** link beside **Sign out**.
- Profiles retain the latest submitted supporter nickname, support platform, and Shinobi
  Registration. Those values prefill the next request form but remain editable. The profile
  backfill migration covers accounts that submitted requests before this feature was added.
- Sprint 3.2 is complete: server-managed owner authorization and owner-only read policies use
  server-managed app metadata, never editable user metadata.

### Sprint 3.2 implementation status

- Owner authorization is held only in Supabase Auth `raw_app_meta_data.role`, which is managed by
  a trusted server-side administrator. RLS reads it through `auth.jwt()` app metadata; browser
  editable user metadata is not an authorization source.
- Read-only owner policies cover requests, request characters, reference metadata, status history,
  and request-reference Storage objects. Existing customer RLS policies continue to isolate each
  customer to their own data.
- The Storage bucket remains private. The owner policy permits authenticated reads only and does
  not make private reference objects public.
- An owner workspace link is rendered only after a verified `auth.getUser()` result includes the
  owner app-metadata role. The linked workspace is an access-checked placeholder, not a dashboard.
- Request status writes, customer-visible updates, and staff notes remain deferred until
  customer-visible updates and internal notes have separate data models.
- Dashboard role assignment and revocation steps are in
  [Owner authorization](./owner-authorization.md).

### Sprint 3.3 implementation status

- `/owner/` is a server-verified, read-only dashboard. Owners can search and filter all requests,
  select a request, and review its submitted details, cast, customer contact fields, status
  history, and expiring signed previews of its private reference images.
- The dashboard uses the existing owner RLS policies; it does not expose Storage objects publicly
  and does not include a service-role credential.
- No mutable owner controls were introduced. Status changes, customer updates, staff notes, due
  dates, priorities, exports, and template editing remain deferred until customer-visible updates
  and internal notes have explicit separate data models and policies.

### Sprint 3.4 implementation status

- Customer-visible updates and staff-only internal notes are now distinct immutable tables with
  separate RLS policies. The customer request page reads only customer-visible updates; it cannot
  read or create internal notes.
- The owner dashboard can create both records for a selected request. Each insert records the
  authenticated owner as `created_by`; no edit or delete UI or policy is present.
- The next owner write boundary is request status: permitted transitions and immutable audit
  behavior must be defined and enforced server-side before a status-control UI is added.

### Sprint 3.5 implementation status

- Owner status updates are limited to server-enforced forward transitions with cancellation from
  each active state. Completed and cancelled requests are terminal.
- A protected database trigger records each valid owner status change in the existing immutable
  status history with the authenticated owner as `changed_by`. RLS and column-level grants prevent
  customers and owners from updating other request fields through this control.
- `/owner/` renders only permitted next statuses; the database remains the source of truth for
  authorization and transition validation.

### Sprint 3.6 and 3.7 implementation status

- Owners can set due dates and a constrained priority on owner-only planning rows. Customers cannot
  read planning data through the API.
- The owner request list is paginated at 20 filtered rows per page and can export its current
  filtered result as CSV. Exports contain no private Storage paths or signed URLs.
- The Phase 3 authorization, communications, status-transition, and planning migrations are
  deployed to the hosted project. The remaining manual task is assigning the intended production
  owner role as documented in [Owner authorization](./owner-authorization.md).

### Phase 3 delivery sequence

1. **Customer history:** add an authenticated `/requests` page that shows only the signed-in
   customer’s requests, stable request numbers, current statuses, submitted details, and their own
   private reference-file metadata.
2. **Owner authorization:** establish a server-managed owner role (never editable user metadata),
   then add owner-only access policies and navigation.
3. **Owner dashboard:** the completed list/detail view, separate customer-update and staff-note
   streams, server-enforced status updates, planning controls, pagination, and constrained export
   are the base. Next, add the email-template workflow and operational regression coverage.
4. **Customer updates:** surface status history and approved customer-facing messages in the
   customer page; keep internal notes private.
5. **Operational controls:** add export, pagination, empty/error states, and a regression/security
   checklist covering customer isolation and owner-only actions.

### Post-release authentication enhancement

- Allow sign-in with either email or supporter nickname. Before implementing it, make the canonical
  supporter nickname a case-insensitive unique account field, migrate and resolve existing duplicate
  values, and perform the nickname-to-account lookup only in a protected server-side flow. Never
  expose an account-email lookup to the browser.

## Phase 4 — Character and platform integrations

- A cached, rate-limited server-side Anime Characters Database proxy with attribution.
- Search/autocomplete with a safe local fallback.
- Optional permitted Discord and supporter-platform account integrations.

## Phase 5 — Payments

Only begin after confirming processor eligibility for the studio’s content and business model.
Use hosted checkout and server-side webhook verification; keep payment state distinct from request
status.

## Phase 6 — Gallery and analytics

- Publish only customer-approved completed work with credit preferences.
- Add privacy-conscious aggregate funnel and business metrics.

## Development commands

```sh
npm run dev
npm run check
npm run lint
npm run format:check
npm run build
```

For the configured GitHub Pages project site, open the local server at
`http://localhost:4321/hiddenlewdstudios-repo/`.
