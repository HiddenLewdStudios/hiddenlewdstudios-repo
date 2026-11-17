# Hidden Lewd Studio — Development Plan

## Current status

Phase 1 is the active milestone. It is a static, private-test-ready Astro site: it demonstrates
the request experience but does not accept real orders, payments, accounts, uploads, emails, or
external API requests.

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

## Phase 2 — Secure request intake

1. Configure Supabase environments, authentication, database schema, and row-level security.
2. Persist requests, stable request IDs, and status-history records.
3. Add private reference-image uploads with file validation, safe processing, retention, and
   protected owner access.
4. Send customer confirmations and owner notifications through server-side services.
5. Before closing the phase, define and perform live browser regression testing for the complete
   request flow, including tier/category selection, cast randomization, receipt confirmation,
   clipboard copy, and PNG download.

## Phase 3 — Dashboards

- Customer request history, status, messages, and secure delivered-file access.
- Owner request list, filters, status changes with notes, due dates, priority, export, and audit
  history.

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
`http://localhost:4321/mr-chungus/`.
