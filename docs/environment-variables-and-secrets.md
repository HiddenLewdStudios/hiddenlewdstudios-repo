# Environment Variables & Secrets Checklist

This document is the definitive checklist for configuring environment variables, deployment tokens, and Supabase URL settings across all environments (**Production**, **Staging**, and **Local Development**).

---

## 0. Local Single Sources of Truth

All environment secrets and configuration values are maintained locally in three git-ignored files at the repository root:

| Environment    | Local File                                                       | Purpose                                                                                                |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Production** | [`.env`](file:///home/abu/workspace/mr-chungus/.env)             | Canonical secrets for `hiddenlewdstudios-prod`, production Vercel config, and Edge Functions.          |
| **Staging**    | [`.env.stage`](file:///home/abu/workspace/mr-chungus/.env.stage) | Canonical secrets for `hiddenlewdstudios-stage`, staging Vercel preview config, and Edge Functions.    |
| **Local Dev**  | [`.env.local`](file:///home/abu/workspace/mr-chungus/.env.local) | Canonical secrets for local Docker Supabase (`npm run supabase:start`), test OAuth IDs, and Astro dev. |

> [!NOTE]
> All `.env`, `.env.local`, and `.env.stage` files are strictly included in `.gitignore` to prevent any secrets from being committed.

---

## 1. Vercel Project Configuration

Navigate to: **[Vercel Dashboard](https://vercel.com/dashboard)** → Select Project → **Settings** → **Environment Variables**

When adding environment variables in Vercel, select the corresponding environment checkbox (**Production** or **Preview**):

| Variable Name                     | Target Value                               | Scopes to Select in Vercel                     | Exposed to Client? | Description / Notes                                         |
| --------------------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | `https://cwgsfhqrjzuvyuzieoai.supabase.co` | ☑ **Production**<br>☐ Preview<br>☐ Development | Yes (`PUBLIC_`)    | Production Supabase project URL (`hiddenlewdstudios-prod`). |
| `PUBLIC_SUPABASE_URL`             | `https://<stage-ref>.supabase.co`          | ☐ Production<br>☑ **Preview**<br>☐ Development | Yes (`PUBLIC_`)    | Staging Supabase project URL (`hiddenlewdstudios-stage`).   |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (Prod anon key)       | ☑ **Production**<br>☐ Preview<br>☐ Development | Yes (`PUBLIC_`)    | Production Supabase publishable/anon key.                   |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (Stage anon key)      | ☐ Production<br>☑ **Preview**<br>☐ Development | Yes (`PUBLIC_`)    | Staging Supabase publishable/anon key.                      |
| `SITE_URL` _(Optional)_           | `https://hiddenlewdstudios.vercel.app`     | ☑ **Production**<br>☐ Preview<br>☐ Development | No                 | Primary canonical production site domain.                   |

> [!NOTE]
>
> - Builds triggered by changes to `main` inherit the **Production** variables.
> - Builds triggered by changes to `staging` inherit the **Preview** variables.
> - Do **not** store backend secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) on Vercel. They belong strictly inside Supabase Edge Functions.

---

## 2. GitHub Actions Secrets (CI/CD Pipeline)

Navigate to: **[GitHub Repository](https://github.com/HiddenLewdStudios/hiddenlewdstudios-repo)** → **Settings** → **Secrets and variables** → **Actions**

Under **Repository secrets**, click **New repository secret** and add the following 3 secrets required by `.github/workflows/ci.yml`:

| Secret Name         | Description                                   | Where to find it                                                                                                |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Personal access token with deploy permissions | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create token with scope for your account/team.     |
| `VERCEL_ORG_ID`     | Vercel team/account ID                        | In your Vercel team settings URL or run `npx vercel link` locally and inspect `.vercel/project.json` (`orgId`). |
| `VERCEL_PROJECT_ID` | Vercel project ID                             | In **Vercel Project Settings** → **General** → **Project ID** (or in `.vercel/project.json` under `projectId`). |

---

## 3. Supabase Cloud Auth URL Configuration

For each Supabase project, navigate to: **[Supabase Dashboard](https://supabase.com/dashboard)** → Select Project → **Authentication** → **URL Configuration**

> [!IMPORTANT]
> **Supabase `Site URL` does not allow wildcards** (`*`). It must be a single, exact, fully-qualified URL. Wildcards are only supported in **Redirect URLs (Allow list)**.

### A. Production Project (`hiddenlewdstudios-prod`)

- **Site URL:** _(Exact production domain, no wildcards)_
  ```text
  https://hiddenlewdstudios.vercel.app
  ```
- **Redirect URLs (Allow list):**
  ```text
  http://localhost:4321/**
  https://hiddenlewdstudios.vercel.app/**
  ```

### B. Staging Project (`hiddenlewdstudios-stage`)

- **Site URL:** _(Exact staging branch URL, no wildcards)_
  ```text
  https://hidden-lewd-studios-cu1zs72n3-guirosaalves.vercel.app
  ```
  _(Or your permanent staging branch alias / custom domain if configured)._
- **Redirect URLs (Allow list):** _(Wildcards ARE supported here)_
  ```text
  http://localhost:4321/**
  https://*-guirosaalves.vercel.app/**
  https://*-hiddenlewdstudios-projects.vercel.app/**
  https://hidden-lewd-studios-*-guirosaalves.vercel.app/**
  ```

---

## 4. Seeding the Staging Database

The staging database seed script is stored at [`supabase/seed.stage.sql`](file:///home/abu/workspace/mr-chungus/supabase/seed.stage.sql). It mirrors local seed data with staging-appropriate fixtures.

### Option A: Supabase Dashboard (Fastest)

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select `hiddenlewdstudios-stage`.
2. Navigate to **SQL Editor** → **New Query**.
3. Copy the contents of [`supabase/seed.stage.sql`](file:///home/abu/workspace/mr-chungus/supabase/seed.stage.sql), paste them, and click **Run**.

### Option B: Supabase CLI

```bash
npx supabase db execute --project-ref <your-stage-ref> --file supabase/seed.stage.sql
```

---

## 5. Supabase Hosted Edge Functions Secrets

If deploying hosted Edge Functions (`send-request-notifications` and `character-search`) on your Supabase projects, set the secrets via the Supabase CLI:

```bash
# Production
npx supabase secrets set --project-ref cwgsfhqrjzuvyuzieoai \
  RESEND_API_KEY="re_..." \
  SITE_URL="https://hiddenlewdstudios.vercel.app"

# Staging
npx supabase secrets set --project-ref <staging-ref> \
  RESEND_API_KEY="re_..." \
  SITE_URL="https://hidden-lewd-studios-cu1zs72n3-guirosaalves.vercel.app"
```
