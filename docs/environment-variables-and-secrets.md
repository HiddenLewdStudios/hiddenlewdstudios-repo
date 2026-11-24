# Environment Variables & Secrets Checklist

This document is the definitive checklist for configuring environment variables, deployment tokens, and Supabase URL settings across all environments (**Production**, **Staging**, and **Local Development**).

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
> - Builds triggered by changes to `staging` (and preview pull requests) inherit the **Preview** variables.
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

_(Optional)_ Under **Repository variables** (`Variables` tab):

- `PUBLIC_SUPABASE_URL`: (Optional placeholder used as fallback during PR verification builds, e.g. `https://placeholder.supabase.co`).
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: (Optional placeholder string).

---

## 3. Supabase Cloud Auth URL Configuration

For each Supabase project, navigate to: **[Supabase Dashboard](https://supabase.com/dashboard)** → Select Project → **Authentication** → **URL Configuration**

### A. Production Project (`hiddenlewdstudios-prod`)

- **Site URL:**
  ```text
  https://hiddenlewdstudios.vercel.app
  ```
- **Redirect URLs (Allow list):**
  ```text
  http://localhost:4321/**
  https://hiddenlewdstudios.vercel.app/**
  ```

### B. Staging Project (`hiddenlewdstudios-stage`)

- **Site URL:**
  ```text
  https://hiddenlewdstudios-git-staging-*.vercel.app
  ```
- **Redirect URLs (Allow list):**
  ```text
  http://localhost:4321/**
  https://*-hiddenlewdstudios-projects.vercel.app/**
  https://hiddenlewdstudios-git-staging-*.vercel.app/**
  ```
  _(Add your staging custom domain or alias here if you configure one on Vercel)._

---

## 4. Supabase Hosted Edge Functions Secrets (Optional / Backend)

If deploying the hosted Edge Functions (`send-request-notifications` and `character-search`) on your Supabase projects, set the secrets via the Supabase CLI:

```bash
# Production
npx supabase secrets set --project-ref cwgsfhqrjzuvyuzieoai \
  RESEND_API_KEY="re_..." \
  SITE_URL="https://hiddenlewdstudios.vercel.app"

# Staging
npx supabase secrets set --project-ref <staging-ref> \
  RESEND_API_KEY="re_..." \
  SITE_URL="https://hiddenlewdstudios-git-staging-*.vercel.app"
```

---

## 5. Local Development Environment (`.env.local`)

For local offline development with the local Supabase stack (`npm run supabase:start`):

```bash
# .env.local
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

For OAuth testing locally, see [supabase/.env](file:///home/abu/workspace/mr-chungus/supabase/.env) and [docs/local-supabase-email-testing.md](file:///home/abu/workspace/mr-chungus/docs/local-supabase-email-testing.md).
