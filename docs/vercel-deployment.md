# Vercel Deployment Guide

This document describes how to deploy Hidden Lewd Studio on [Vercel](https://vercel.com/) and configure environment variables and authentication redirects.

---

## 1. Project Setup on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import the repository: `HiddenLewdStudios/hiddenlewdstudios-repo` (or your relevant repo name).
4. Configure Project Settings:
   - **Framework Preset:** `Astro`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
   - **Node.js Version:** `22.x`

---

## 2. Environment Variables

Under **Settings** → **Environment Variables** in your Vercel project, add the following variables for **Production**, **Preview**, and **Development**:

| Variable Name                     | Value / Description                                                            | Exposed to Client?     |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| `PUBLIC_SUPABASE_URL`             | Your hosted Supabase URL (e.g. `https://cwgsfhqrjzuvyuzieoai.supabase.co`)     | Yes (`PUBLIC_` prefix) |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your hosted Supabase publishable/anon key                                      | Yes (`PUBLIC_` prefix) |
| `SITE_URL`                        | (Optional) Your production domain, e.g. `https://hiddenlewdstudios.vercel.app` | No (used during build) |

> [!NOTE]
> Do NOT set `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, or any OAuth client secrets on Vercel. Those secrets belong exclusively inside hosted Supabase Edge Functions (`send-request-notifications` and `character-search`).

---

## 3. Supabase Auth Configuration for Vercel

Because the site is hosted on Vercel rather than GitHub Pages:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/cwgsfhqrjzuvyuzieoai) → **Authentication** → **URL Configuration**.
2. **Site URL:**
   - Set to your primary production URL: `https://hiddenlewdstudios.vercel.app` (or custom domain).
3. **Redirect URLs (Allow list):**
   Add your Vercel production and preview wildcards:
   - `http://localhost:4321/**` (for local development)
   - `https://hiddenlewdstudios.vercel.app/**` (production)
   - `https://*-hiddenlewdstudios-projects.vercel.app/**` (for preview deployments, if enabled)

---

## 4. OAuth Provider Callbacks

In provider consoles (Google Cloud Console, Discord Developer Portal):

- Your Supabase OAuth redirect URL remains unchanged:
  `https://cwgsfhqrjzuvyuzieoai.supabase.co/auth/v1/callback`
- For local development with Supabase CLI, retain:
  `http://localhost:54321/auth/v1/callback`

---

## 5. Security & Caching (Vercel Configuration)

The repository includes a [vercel.json](../vercel.json) file that automatically configures:

- `cleanUrls: true` (removes `.html` extensions from URLs)
- `trailingSlash: true` (ensures directory-based routing consistency)
- Recommended HTTP security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
