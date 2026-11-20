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

Open `http://localhost:4321/hiddenlewdstudios-repo/`. Mailpit is available at
`http://127.0.0.1:54324`.

## Developing from another computer over SSH

On the computer you are using to access the development machine, create SSH tunnels:

```sh
ssh -L 4321:localhost:4321 -L 54321:localhost:54321 -L 54323:localhost:54323 your-user@your-development-machine
```

Then use `http://localhost:4321/hiddenlewdstudios-repo/` in that computer's browser. This is also
the required approach for local Google OAuth testing, because Google allows non-HTTPS OAuth
callbacks only for localhost.

Replace `your-development-machine` with the development computer's LAN hostname or IP address.

See [local Supabase email-flow testing](./docs/local-supabase-email-testing.md) for the complete
local email and Storage workflow.

## Owner authorization

Owner access is a server-managed Supabase Auth app-metadata role. The private reference bucket is
not public. See [owner authorization](./docs/owner-authorization.md) for the required Supabase
Dashboard SQL and token-refresh step; never use editable user metadata or frontend credentials to
grant owner access.

## Local development fixtures

`npm run supabase:reset` recreates disposable `HLS-DEV-*` request fixtures for manual testing.
Use `abu@gmail.com` (server-managed owner) or `abu2@gmail.com` (customer), each with
`ChangeMe!LocalOnly2026`. Fixtures are local-only. Never use `--include-seed` against production.

## Character search

Local development never calls Anime Characters Database (ACDB):
`ACDB_EXTERNAL_ENABLED` is fixed to `false` in `supabase/config.toml`. Production-only search uses
a JWT-protected server-side proxy, with a shared one-request-per-second upstream budget, caching,
and visible ACDB/ODbL attribution. See [the dated ACDB reference](./docs/acdb-api-reference-2026-11-20.md).
