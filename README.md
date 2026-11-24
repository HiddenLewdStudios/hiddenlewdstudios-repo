# Hidden Lewd Studio

## Local development

Start local Supabase, including Auth, Storage, and Mailpit:

```sh
npm run supabase:start
```

In another terminal, start the Astro site:

```sh
npm run dev
```

Open `http://localhost:4321/`. Mailpit is available at `http://127.0.0.1:54324`.

## Developing from another computer over SSH

On the computer you are using to access the development machine, create SSH tunnels:

```sh
ssh -L 4321:localhost:4321 -L 54321:localhost:54321 -L 54323:localhost:54323 your-user@your-development-machine
```

Then use `http://localhost:4321/` in that computer's browser. This is also the required approach for local Google OAuth testing, because Google allows non-HTTPS OAuth callbacks only for localhost.

Replace `your-development-machine` with the development computer's LAN hostname or IP address.

See [local Supabase email-flow testing](./docs/local-supabase-email-testing.md) for the complete local email and Storage workflow.

## Database Seeding (Local & Staging)

### 1. Local Development Database

Whenever you want to reset your local database and re-seed it with test accounts and sample requests:

```sh
npm run supabase:reset
```

This automatically runs all migrations and applies [`supabase/seed.sql`](./supabase/seed.sql).

### 2. Staging Cloud Database (`hiddenlewdstudios-stage`)

To populate your cloud staging database with realistic sandbox data:

- **Option A (Supabase Dashboard - Recommended):**
  1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your staging project.
  2. Go to **SQL Editor** → **New Query**.
  3. Paste the contents of [`supabase/seed.stage.sql`](./supabase/seed.stage.sql) and click **Run**.
- **Option B (CLI):**
  Configure `STAGE_PROJECT_REF` and run:
  ```sh
  npx supabase db execute --project-ref <your-stage-ref> --file supabase/seed.stage.sql
  ```

### Seeded Credentials & Fixtures

Both seed files create:

- **Owner Account**: `abu@gmail.com` with password `ChangeMe!LocalOnly2026` (has `role: 'owner'`).
- **Customer Account**: `abu2@gmail.com` with password `ChangeMe!LocalOnly2026`.
- **Sample Requests**: 4 requests in multiple workflow states (`accepted`, `in_progress`, `completed`, `cancelled`) with characters, attached image references, customer updates, and planning entries.

> [!WARNING]
> Fixtures are for local and staging environments only. **Never run seed scripts against production.**

## Owner authorization

Owner access is a server-managed Supabase Auth app-metadata role. The private reference and deliverable buckets are not public. See [Production owner role assignment](./docs/production-owner-role-assignment.md) and [owner authorization](./docs/owner-authorization.md) for the required Supabase Dashboard SQL and token-refresh step; never use editable user metadata or frontend credentials to grant owner access.

## Character search

Local development never calls Anime Characters Database (ACDB):
`ACDB_EXTERNAL_ENABLED` is fixed to `false` in `supabase/config.toml`. Production-only search uses
a JWT-protected server-side proxy, with a shared one-request-per-second upstream budget, caching,
and visible ACDB/ODbL attribution. See [the dated ACDB reference](./docs/acdb-api-reference-2026-11-20.md).

## Production deployment (Vercel)

The site is configured for deployment on Vercel:

- Framework: **Astro**
- Build command: `npm run build`
- Output directory: `dist`
- Security headers and routing are configured in [vercel.json](./vercel.json).
- See [Vercel deployment guide](./docs/vercel-deployment.md) and [Environment Variables & Secrets Checklist](./docs/environment-variables-and-secrets.md) for environment variables and Supabase configuration.
