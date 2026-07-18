# Ads Maker

AI ad-creation web app. Build a brand **Profile** (company brain + visual identity + products), pull **proven winning ads** for that niche, then **generate a new on-brand ad** — post, carousel, or video — that adapts a winning ad to your own product.

```
Profile  →  Winning Ads  →  Generate (Post | Carousel | Video)
```

Every generation is grounded in your brand + a real winning ad, assembled into a ready-to-use asset, and metered for cost.

---

## Tech stack

- **Next.js 16 (App Router) + TypeScript**, **Tailwind v4 + shadcn/ui (Base UI)**
- **Supabase** — Postgres + Auth + RLS (data & auth only)
- **Cloudinary** — media storage (behind a `StorageProvider`, with a local dev fallback)
- **TanStack Query** — client cache + job polling
- **Postgres-backed job queue** — drained by a route + Vercel Cron (no external queue)
- Providers behind swappable interfaces: **Claude / Gemini** (analysis/prompts), **Higgsfield MCP** (image + video — connected per-user in Settings), **ElevenLabs** (voice), **Apify** (ad discovery)

Every external vendor sits behind a small interface in `src/providers`, so unconfigured providers fall back to a **stub** — the whole app runs end-to-end before you add any keys.

---

## Quick start (stub mode, no keys)

```bash
npm install
# .env.local is already present; leave keys blank for stub mode
npm run dev
```

Without Supabase, the app renders a "connect Supabase" screen. To use it fully, connect Supabase (below). With Supabase connected but no provider keys, generation still works using placeholder assets.

---

## Full setup

### 1. Supabase (required for auth + data)

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → API** → copy `Project URL`, `anon` key, and `service_role` key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Apply the schema: open **SQL Editor**, paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. This creates all tables, RLS policies, and the queue/metering RPCs.
4. In **Authentication → Providers**, keep Email enabled. For quick local testing you can disable "Confirm email".

Restart `npm run dev` and create an account at `/login`.

### 2. Cloudinary (media storage)

Set `STORAGE_DRIVER=cloudinary` and add your Cloudinary credentials:
```
STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```
With `STORAGE_DRIVER=local`, uploads are written under `public/.localstore` and provider outputs pass through as remote URLs (dev only — Vercel's filesystem is ephemeral).

### 3. Providers

Add whichever keys you want (each is optional; missing ones use a stub):

| Capability | Env | Notes |
|---|---|---|
| Analysis & prompts | `ANTHROPIC_API_KEY` | Claude; falls back to Gemini (`GEMINI_API_KEY` + optional `GEMINI_LLM_MODEL`) when unset |
| Image + video | — (no env key) | Higgsfield MCP: connect per-user in **Settings → Higgsfield**; stub placeholders when not connected |
| Voice | `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`) | ElevenLabs |
| Ad discovery | `APIFY_TOKEN` + `APIFY_ADS_ACTOR` | choose an ad-library actor |
| Budget cap | `BUDGET_MONTHLY_USD` | optional hard stop |

See `/settings` in the app for a live view of what's configured.

---

## How it works

```
src/
  app/                 routes: (auth)/login, (app)/{dashboard,profiles,winning-ads,generate,settings}, api/*
  components/          ui (shadcn), layout, profiles, winning-ads, generate, settings, common
  lib/                 env, supabase clients, storage (cloudinary|local), jobs (queue), query, types, validate
  providers/           interfaces + registry + resolve + stubs + llm/image/video/tts/scraper impls
  skills/              PURE context → RenderSpec (post, carousel, video)
  engine/              the ONLY place that calls providers + storage + metering
  server/              actions (mutations) + queries (reads)
supabase/migrations/   0001_init.sql (schema + RLS + RPCs)
```

- **Jobs**: `discover_winning_ads` and `generate_content` run async via a `jobs` table.
  Enqueue kicks `/api/jobs/tick` (via `after()`), which claims + runs jobs (`SKIP LOCKED`,
  leases, retries). Vercel Cron hits the same endpoint every minute as a safety net.
- **Engine** (`src/engine`): loads context → analyzes the winning ad (Claude vision, cached) →
  runs the type-specific **skill** (pure) → executes the `RenderSpec` (image/video/TTS + ffmpeg
  merge) → uploads assets → records `api_usage` via the single `meter()` choke point.
- **Model selection**: `src/providers/registry.ts` lists selectable models + quality tiers
  (1K/2K/4K) per media type; the Generate page renders selectors from it.

---

## Deploy (Vercel)

1. Push to a Git repo and import into Vercel.
2. Add all env vars from `.env.local` (set `STORAGE_DRIVER=cloudinary`, real `APP_URL`/`NEXT_PUBLIC_APP_URL`, and a strong `CRON_SECRET`).
3. `vercel.json` already registers the cron for `/api/jobs/tick` (every minute).
4. Note: heavy video merges use ffmpeg locally; on Vercel the merge currently falls back to the
   first clip for multi-clip videos — wire Cloudinary video concat for full prod stitching.

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the build
npm run lint     # eslint
```
