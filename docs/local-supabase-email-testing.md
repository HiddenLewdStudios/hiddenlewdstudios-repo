# Local Supabase email-flow testing

This project can test Supabase Auth emails without using the hosted project or sending an email to
the internet. The local Supabase stack includes Mailpit, which receives the messages in a browser
inbox.

## One-time setup

Install Docker Desktop (or Docker Engine with Docker Compose), then initialize and start the local
stack from the repository root:

```sh
npx --yes supabase@latest start
```

The repository's `supabase/config.toml` configures Auth and Studio with loopback URLs and enables
email confirmations so sign-up confirmation emails can also be tested. Use SSH port forwarding
when developing from another computer; this keeps the browser, Auth callback, and signed private
Storage URLs on loopback without exposing the local stack to the LAN.

`.env.local` is intentionally gitignored and points the app to the local stack. If it is missing,
run the following command and copy only its local `API_URL` and `PUBLISHABLE_KEY` values into it:

```sh
npx --yes supabase@latest status -o json
```

The required file shape is:

```dotenv
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never put a local or hosted secret/service-role key in this file.

## Local Google and Discord OAuth

The local Auth service reads provider credentials from the ignored supabase/.env file. Add the
existing development OAuth credentials there; do not put them in the Edge Function environment or
commit them. npm run supabase:start loads that ignored file before starting Auth.

In each provider console, register the local callback URL shown by **Supabase Studio →
Authentication → Providers**. Google requires a loopback localhost callback for HTTP local
development, so use the SSH forwarding workflow below when developing remotely.

For the hosted project, enable the same providers in **Supabase Dashboard → Authentication →
Providers**, keep credentials in the Dashboard only, and copy the hosted callback URL from that
screen into the matching Google/Discord OAuth application. Also retain the GitHub Pages URL in
Auth's Site URL and Redirect URLs. Do not hardcode a hosted project URL or client secret in this
repository.

## Test a flow

1. Start the local stack with `npm run supabase:start`, then start the app with `npm run dev`.
2. Open `http://localhost:4321/hiddenlewdstudios-repo/`. When working from another computer, use
   the SSH forwarding setup below and open the same loopback URL there.
3. Enter an email address and request the magic link (or use the relevant sign-up/recovery screen
   as those flows are added).
4. Open Mailpit at `http://127.0.0.1:54324` and open the received message.
5. Follow the link and verify that it returns to the loopback site URL.

## Developing remotely over SSH

For a remote computer on the local network, use SSH port forwarding instead of opening OAuth on a
raw LAN IP address:

```sh
ssh -L 4321:localhost:4321 -L 54321:localhost:54321 -L 54323:localhost:54323 your-user@your-development-machine
```

Open `http://localhost:4321/hiddenlewdstudios-repo/` on the remote computer. This is required for
local Google OAuth testing because Google permits HTTP callback URLs only for localhost.
Replace `your-development-machine` with the development computer's LAN hostname or IP address.

The local stack sends no real email. Local Auth permits one email per address per second by
default; the setting is `auth.email.max_frequency` in `supabase/config.toml`.

Request-notification delivery is disabled by default. When local
`NOTIFICATION_DELIVERY_ENABLED=true` is deliberately set in `supabase/functions/.env`, the request
notification Edge Function sends to the local Mailpit instance instead of Resend. No real email is
sent from the local stack.

## Switch back to hosted Supabase

Remove or rename `.env.local`, then start the app again. The regular `.env` values (or the GitHub
Actions variables used in the deployment workflow) will be used instead.

## Useful commands

```sh
npx --yes supabase@latest status
npx --yes supabase@latest stop
```

The Phase 2 request tables, RLS policies, and private Storage bucket are versioned in
`supabase/migrations`. Run `npm run supabase:reset` when setting up a fresh local database or
after adding a migration; this deletes only local Supabase database data and reapplies the
migrations.
