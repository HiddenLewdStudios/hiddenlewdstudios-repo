# Branching & Worktree Rules

- **Feature branches only**: Agents should only work on feature branches (`feat/...` or `feature/...`) that will eventually merge into `staging`. Never commit directly to `main` or `staging`.
- **Git worktrees**: Agents should use git worktrees whenever necessary and get rid of them whenever they are not in use unless told otherwise.

# ACDB integration

Before any live ACDB use, test, or deployment, all repository tests must pass on the exact revision and the ACDB integration must receive careful review. A green suite alone does not authorize live traffic. Keep routine development, CI, and regression tests offline from ACDB. Use fixtures for responses and disposable local Postgres for the global limiter.

Review the edge function, every outbound request path, the shared database permit, and attribution against the [ACDB API Access rules](http://wiki.animecharactersdatabase.com/index.php?title=API_Access). Recheck the current rules before live use. ACDB limits the bot to one request per second across all users and workers. Deployments using the same bot must share its budget. Every upstream attempt requires a fresh atomic permit. Denied or unavailable permits must stop the request. Cache hits must avoid upstream traffic. Redirects and retries must never create unmetered requests.

ACDB requires cookies unless the HTTP client uses a recognized user agent. Keep the real client and its identifying User-Agent aligned with ACDB’s current list. Preserve source credit and the Open Database License link.

Run `npm run test:acdb` for the network-isolated handler suite. The ACDB offline gate also applies the limiter migration to disposable Postgres and runs `bash tests/acdb/limiter.sh`. That script changes the permit clock. Use only a fresh test database. Review the permission checks, concurrency results, and minimum interval before approving live use. Any necessary live verification must go through the reviewed, rate-limited function after all tests pass.

# Testing guidelines for coding tasks

Every coding task (new feature, bug fix, refactoring, database migration, or configuration change) must be accompanied by relevant tests and must leave the entire test suite green. Do not mark a coding task as complete without verifying all test layers.

## Completion baseline

Before completing any task, run and verify the full gate:

```sh
npm run format:check   # Prettier formatting check
npm run lint           # ESLint codebase check (0 errors, 0 warnings)
npm run check          # Astro & TypeScript diagnostic check
npm test               # Automated test suite (unit, component, edge functions, ACDB)
npm run build          # Static site production build
```

If any check fails, resolve the underlying cause before reporting the task as done. Always run `npm run format` if new files were created or existing files were modified.

## Test suite architecture & responsibilities

### 1. Unit & helper tests (`tests/unit/`)

- Place unit tests for client libraries, data catalogs, utility functions, and storage helpers in `tests/unit/`.
- Test pure logic, boundary conditions, edge cases, string normalizations, and input validations.
- Run via:
  ```sh
  npm run test:unit
  ```

### 2. Component tests (`tests/components/`)

- Test React UI components using Vitest, `@testing-library/react`, and `jsdom`.
- Test role-based visibility, unauthenticated vs authenticated states, user form submissions, validation feedback, and DOM updates.
- Use `createMockSupabaseClient` from [`tests/helpers/mock-supabase.ts`](file:///home/abu/workspace/mr-chungus/.worktrees/feat-testing/tests/helpers/mock-supabase.ts) to simulate Supabase authentication, database queries, and storage operations in memory. Never make real network requests in component tests.
- When adding or modifying interactive UI components (forms, dashboards, navigation bars, modals), write or update the corresponding `.test.tsx` file in `tests/components/`.

### 3. Edge function tests (`tests/edge-functions/` and `tests/acdb/`)

- Test Supabase Edge Functions in network-isolated Node VM modules (`--experimental-vm-modules`) using `node:test`.\n- Mock all external dependencies (Supabase clients, Resend email dispatch, Mailpit API, upstream ACDB HTTP requests) via synthetic modules and fixture transports.
- Test HTTP methods (rejection of non-allowed verbs), CORS OPTIONS preflight headers, authentication validation (missing/invalid JWTs), parameter validation, idempotency, and error handling.
- Run via:
  ```sh
  npm run test:edge
  npm run test:acdb
  ```

### 4. Page integration & static build tests (`tests/integration/`)

- Verify static route generation and HTML structure across all public Astro pages (`/`, `/commissions/`, `/requests/`, `/gallery/`, `/faq/`, `/terms/`, `/privacy/`, `/commission-policy/`, `/contact/`, `/owner/`).
- Validate `<title>`, `<meta name="viewport">`, `<meta name="description">`, header navigation, and footer legal links.
- When creating a new route or page layout, add it to the expected pages in [`tests/integration/pages.test.ts`](file:///home/abu/workspace/mr-chungus/.worktrees/feat-testing/tests/integration/pages.test.ts).

### 5. Database & RLS security policy tests (`supabase/tests/`)

- Whenever a database migration adds or changes tables, views, functions, or Row Level Security (RLS) policies, write a corresponding pgTAP test in `supabase/tests/`.
- Test access boundaries across all relevant roles:
  - `anon`: Unauthenticated public visitors (should have zero read/write access to private tables).
  - `authenticated`: Logged-in customers (must only access and modify their own requests and deliverables).
  - `owner`: Authorized studio owner (`raw_app_meta_data.role = 'owner'`).
- Verify negative cases (e.g. attempting to read or update another user's rows must throw error `42501` or return zero rows).
- Run locally against disposable Postgres via:
  ```sh
  npm run test:db
  ```

## Testing rules

1. **Keep tests offline**: Development and CI test suites must run completely offline from external third-party services (ACDB, Resend, live Supabase). Use fixture mocks.
2. **Never bypass security in tests**: Do not test RLS or authorization by circumventing policies with service-role privileges where customer or anon privileges are expected.
3. **Preserve existing coverage**: Modifying an existing component or feature must not weaken or delete existing tests unless the requirements have explicitly changed.
