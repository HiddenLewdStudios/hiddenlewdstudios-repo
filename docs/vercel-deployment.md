# Vercel Deployment & Environments Guide

This document describes how to deploy Hidden Lewd Studios on [Vercel](https://vercel.com/) using **Option 1: Single Vercel Project with Dual Environments (Production & Staging)**, automated via GitHub Actions.

---

## Architecture Overview

```
                      ┌───────────────┐
                      │ GitHub Repo   │
                      └───────┬───────┘
              Push to main    │    Push to staging
             ┌────────────────┴────────────────┐
             ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐
   │ CI & Deploy (main)│             │CI & Deploy(stage) │
   └─────────┬─────────┘             └─────────┬─────────┘
             │ vercel pull --prod              │ vercel pull --preview
             │ vercel build --prod             │ vercel build
             │ vercel deploy --prod            │ vercel deploy
             ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐
   │ Vercel Production │             │  Vercel Staging   │
   │  (Production Env) │             │   (Preview Env)   │
   └─────────┬─────────┘             └─────────┬─────────┘
             │                                 │
             ▼                                 ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  hiddenlewdstudios-prod  │     │  hiddenlewdstudios-stage │
│    (Supabase Cloud)      │     │    (Supabase Cloud)      │
└──────────────────────────┘     └──────────────────────────┘
```

---

## 1. Vercel Project Setup

1. Log in to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import the repository: `HiddenLewdStudios/hiddenlewdstudios-repo`.
4. Configure Project Settings:
   - **Framework Preset:** `Astro`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
   - **Node.js Version:** `22.x`

---

## 2. Environment Variables Configuration

In Vercel under **Project Settings** → **Environment Variables**, configure the variables scoped to **Production** vs **Preview**:

| Variable Name                     | Environment Scope | Target Supabase Project   | Example / Description                      |
| --------------------------------- | ----------------- | ------------------------- | ------------------------------------------ |
| `PUBLIC_SUPABASE_URL`             | **Production**    | `hiddenlewdstudios-prod`  | `https://cwgsfhqrjzuvyuzieoai.supabase.co` |
| `PUBLIC_SUPABASE_URL`             | **Preview**       | `hiddenlewdstudios-stage` | `https://<stage-ref>.supabase.co`          |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Production**    | `hiddenlewdstudios-prod`  | Production anon/publishable key            |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Preview**       | `hiddenlewdstudios-stage` | Staging anon/publishable key               |
| `SITE_URL` _(Optional)_           | **Production**    | Production                | `https://hiddenlewdstudios.vercel.app`     |

> [!IMPORTANT]
>
> - **Production scope:** Applied automatically to builds from `main`.
> - **Preview scope:** Applied automatically to builds from `staging` (and preview pull requests).
> - **Edge Function Secrets:** Secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and OAuth client secrets belong **only** inside Supabase Edge Functions (`supabase secrets set ...`), never inside Vercel.

---

## 3. GitHub Actions CI/CD Secrets

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs the ACDB compliance gate and code verification, then automatically deploys:

- **Pushes to `main`** $\rightarrow$ deployed to Vercel **Production** (`--prod`).
- **Pushes to `staging`** $\rightarrow$ deployed to Vercel **Staging / Preview**.

Add the following credentials in **GitHub Repository Settings** → **Secrets and variables** → **Actions**:

### Secrets (`Repository secrets`):

1. `VERCEL_TOKEN`: Your Vercel personal access token (create at [Vercel Account Tokens](https://vercel.com/account/tokens)).
2. `VERCEL_ORG_ID`: Found in your Vercel team/account settings or project `.vercel/project.json`.
3. `VERCEL_PROJECT_ID`: Found in **Vercel Project Settings** → **General** → **Project ID**.

_(Alternatively, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` can be placed in Repository Variables)._

---

## 4. Supabase Auth Configuration for Both Environments

Configure **Authentication** → **URL Configuration** in both Supabase projects:

### Production (`hiddenlewdstudios-prod`):

- **Site URL:** `https://hiddenlewdstudios.vercel.app` (or custom domain)
- **Redirect URLs:**
  - `http://localhost:4321/**`
  - `https://hiddenlewdstudios.vercel.app/**`

### Staging (`hiddenlewdstudios-stage`):

- **Site URL:** `https://hiddenlewdstudios-git-staging-*.vercel.app` (or your staging alias / custom domain)
- **Redirect URLs:**
  - `http://localhost:4321/**`
  - `https://*-hiddenlewdstudios-projects.vercel.app/**`
  - `https://hiddenlewdstudios-git-staging-*.vercel.app/**`
  - Any staging domain configured on Vercel

---

## 5. Security & Caching (Vercel Configuration)

The repository includes [vercel.json](../vercel.json) configuring:

- `cleanUrls: true` (clean routes without `.html`)
- `trailingSlash: true` (consistent directory-based routing)
- Security HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
