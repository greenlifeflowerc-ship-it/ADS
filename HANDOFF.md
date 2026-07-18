# Ads Maker — Session Handoff

> ملف تسليم لمتابعة المشروع في شات ثاني. آخر تحديث: 2026-07-18.
> Read this first, then `AGENTS.md` / `README.md` for architecture.

---

## 1. ملخّص سريع (Arabic)

المشروع: أداة إعلانات AI — **Profile (عقل العلامة) → Winning Ads (إعلانات ناجحة) → Generate (بوست/كاروسيل/فيديو)**.
هالجلسة اشتغلنا على: ربط Higgsfield (توليد)، محلّل Sonnet، اكتشاف إعلانات Apify مع فلاتر، إصلاح رفع الصور، إصلاح إن التوليد كان يرجّع صورة المنتج بدل المولّدة، قواعد واقعية + ماركتنج، ونظام أنماط إبداعية (skills) مع خيار مع/بدون شخص، وترابط بصري للكاروسيل، واستخدام عدة صور منتج، وخيار "بدون إعلان مرجعي".

**الوضع:** يشتغل محلياً على `npm run dev` (http://localhost:3000). التوليد يمرّ عبر **Higgsfield MCP**. التحليل عبر **Claude Sonnet**.

---

## 2. Current config (`.env.local`)

| Var | State | Notes |
|---|---|---|
| Supabase (URL / anon / service_role) | SET | DB + Auth |
| STORAGE_DRIVER | `cloudinary` | media → Cloudinary (public) |
| CLOUDINARY_* | SET | |
| ANTHROPIC_API_KEY | SET | analysis = Claude **Sonnet** (registry default) |
| GEMINI_API_KEY | **empty** | Gemini analyzer available if set (falls back to Claude) |
| ELEVENLABS_API_KEY | SET | TTS |
| APIFY_TOKEN + APIFY_ADS_ACTOR | SET | `APIFY_ADS_ACTOR=apify/facebook-ads-scraper` |
| BUDGET_MONTHLY_USD | empty | no cap |

- **Image/Video/Voice generation** does NOT use env keys — it goes through the user's **Higgsfield MCP** connection (Settings → Higgsfield). Connect via OAuth ("Connect with Higgsfield") or a manual token.
- After editing `.env.local`, **restart `npm run dev`** (env is read at boot).

### Migrations (Supabase SQL Editor)
Run in order if not already applied: `supabase/migrations/0001_init.sql`, `0002_higgsfield.sql`, **`0003_higgsfield_oauth.sql`** (new this session — adds `higgsfield_oauth`, `higgsfield_oauth_pending` to `user_settings`).
Verify: `select column_name from information_schema.columns where table_name='user_settings';` should include `higgsfield_oauth`.
**No other SQL is needed** — all new features store data in existing jsonb columns (`jobs.payload`, `generations.params`).

---

## 3. What changed this session (by area, with files)

### Analysis LLM
- `src/providers/llm/gemini.ts` (new) — Gemini as an analyzer (vision, base64 images). `src/providers/llm/shared.ts` (new) — shared analyze prompt + JSON parse.
- `src/providers/resolve.ts` — `resolveLLM`: Claude first, Gemini fallback, else stub.
- `src/providers/registry.ts` — LLM default is now **claude-sonnet-5** (Opus still selectable). Added Gemini 2.5 Flash.
- `src/providers/llm/anthropic.ts` — **fetches images → base64** before sending to Claude (Anthropic's URL fetch is robots.txt-blocked on fbcdn/ad CDNs → was causing `400 disallowed by robots.txt`).

### env client bug fix
- `src/lib/env.ts` — added explicit `RAW_ENV` object referencing each `process.env.X` so `NEXT_PUBLIC_*` inline into the client bundle. Fixed the "Connect Supabase" screen persisting after keys were added (server saw keys, client didn't → hydration mismatch).

### Higgsfield OAuth (like how Claude connects)
- `supabase/migrations/0003_higgsfield_oauth.sql` (new).
- `src/lib/higgsfield/oauth.ts` (new) — `beginOAuth` (discovery + DCR + PKCE), `completeOAuth`, `getValidAccessToken` (auto-refresh), `clearOAuthConnection`.
- `src/app/api/higgsfield/callback/route.ts` (new) — OAuth redirect handler.
- `src/server/actions/higgsfield.ts` — `startHiggsfieldOAuthAction`; disconnect clears OAuth.
- `src/lib/higgsfield/config.ts` — prefers OAuth token, falls back to manual token.
- `src/server/queries/higgsfield.ts` — status returns `method: "oauth"|"manual"|null`.
- `src/components/settings/higgsfield-connect.tsx` — "Connect with Higgsfield" button + manual fallback (advanced).
- Endpoint: `https://mcp.higgsfield.ai/mcp` (OAuth: authorization_code + PKCE + dynamic client registration — verified working, localhost redirect allowed).

### Product/asset uploads
- `next.config.ts` — `experimental.serverActions.bodySizeLimit = "16mb"` (default 1MB was rejecting product photos → "Upload failed").
- `src/lib/storage/persist.ts` (`uploadFile`) — brand assets upload **public** (private Cloudinary URLs 401 → images didn't render).
- `src/engine/persist.ts` (`upsertAsset`) — generation outputs upload **public** (fixed "generated but didn't show on platform").

### Winning-ads discovery (Apify)
- `src/providers/scraper/apify.ts` — rewritten for `apify/facebook-ads-scraper`:
  - builds Meta Ad Library **search URLs** (`startUrls`), parses nested `snapshot.cards/images/videos`.
  - **media-type-aware classification** (image search → post/carousel; video search → video).
  - **multi-query rotation** (2 random angles/run), **exclude already-saved** source URLs, **shuffle**, **balance across requested formats**, **language** filter (`content_languages`).
- `src/engine/discovery.ts` — reads brain → `buildCompetitorQueries` (LLM produces 6 competitor angles); honors `payload.formats / language / topic`; excludes saved ads; target **20**.
- `src/server/actions/winning-ads.ts` — `enqueueDiscoveryAction(profileId, {formats, language, topic})`, `suggestDiscoveryTopicAction`, `deleteWinningAdAction`.
- `src/components/winning-ads/winning-ads-view.tsx` — search-format chips (Post/Carousel/Video), **language filter** (All/العربية/English), **editable topic** + "Suggest from brain", **delete button** per ad.
- `src/providers/types.ts` — `DiscoverInput` gained `queries`, `language`, `excludeUrls`.

### Generation quality
- `src/lib/higgsfield/client.ts` — **`findGeneratedUrl`** extracts only `results.rawUrl`/`minUrl`, skipping `input_images`/`params`/etc. **`findGenerationId`** for job id. Removed the unsafe first-URL regex fallback. **This fixed the core bug where generation returned the product/reference image instead of the generated output** (the pending response echoes input media; the old regex grabbed it).
- `src/providers/higgsfield/models.ts` — default image model → **`seedream_v4_5`** (nano_banana was just copying the product reference; seedream composes real scenes). Reference cap raised 3 → 6.
- `src/skills/grounding.ts` — `REALISM_DIRECTIVE` (photoreal rules: skin/hands/gaze/environment) appended to every prompt.

### Creative system (styles / people / continuity)
- `src/skills/styles.ts` (new) — **8 ad-style presets** (UGC, Expert/Authority, Product Hero, Lifestyle, Flatlay, Benefit/Result, Problem→Solution, Luxury Editorial), `MARKETING_DIRECTIVE`, `peopleDirective`, `resolvePeople`, `getAdStyle`.
- `src/lib/types/domain.ts` — `CreativeParams { adStyle?, people?: "auto"|"with"|"without", sceneHint? }` mixed into Post/Carousel/Video params.
- `src/lib/validate.ts` — optional creative fields on each schema.
- `src/skills/post.ts` — scene-driven prompt + style + people + marketing + realism; uses **all** selected product images; hook/caption fallbacks when no reference.
- `src/skills/carousel.ts` — shared **"Visual DNA"** injected into every slide (same person/set/palette/lighting + slide-to-slide continuity).
- `src/skills/video.ts` — talking-head (with person) vs b-roll (without); first-person vs narrator script; clip-to-clip continuity.
- `src/components/generate/generate-form.tsx` — "3. Creative direction" card (ad-style buttons, People auto/with/without, scene/direction input); summary shows style + people.

### Multiple images + optional reference
- Skills pass **all** selected product images (provider caps). Higgsfield ref cap = 6.
- `src/engine/generation.ts` — **skips analysis** when no winning ad (`generation.winning_ad_id` null) → "Composing from your brand…".
- `src/components/generate/generate-form.tsx` — **"No reference"** button; winning ad is now optional (`canSubmit` no longer requires one).

---

## 4. Known issues / caveats

- **Video multi-clip merge**: ffmpeg is local-only; on Vercel the merge falls back to the first clip (see README). Needs Cloudinary video concat for prod stitching.
- **Discovery on Vercel**: runs up to 4 parallel Apify runs; Vercel function `maxDuration=60s` + job lease 120s → risk of timeout/requeue on Vercel. Fine locally. Consider checkpointed cross-tick polling for prod.
- **Costs**: Apify ~$0.19–0.35 per discovery (pay-per-ad); Higgsfield credits per generation.
- **Pre-existing lint errors** (NOT from this session, but will block `npm run build`):
  - `src/components/winning-ads/winning-ads-view.tsx` — `react-hooks/set-state-in-effect` (job-polling effect).
  - `src/components/generate/generate-form.tsx` — `react-hooks/preserve-manual-memoization` (estCost `useMemo`).
  - Dev server runs fine; fix these before a production build.
- **seedream reference fidelity**: composes great scenes but exact product-label match can vary; `nano_banana_pro` is more literal if needed (`src/providers/higgsfield/models.ts`).
- **HMR + background worker**: editing engine/provider files sometimes doesn't hot-reload the worker (jobs run via `/api/jobs/tick`). **Restart `npm run dev` after engine/provider/skill changes** to be safe.

---

## 5. How to run / verify

```bash
npm run dev              # http://localhost:3000
npx tsc --noEmit         # must pass (currently clean)
npm run build            # will fail on the 2 pre-existing lint errors above
```
- Jobs drain via `/api/jobs/tick` (kicked on enqueue + Vercel cron). Local worker runs in-process.
- Verify generation: Generate → pick product image(s) → choose style + people (+ optional "No reference") → Generate → should show a **real generated scene** (not the product photo) after a short loading period.

---

## 6. Suggested next steps

1. Confirm end-to-end: a post/carousel/video generation returns a real ad scene (not the reference). If it still returns the product image, re-check `src/lib/higgsfield/client.ts` extraction against a live `show_generations` payload (output is under `results.rawUrl`).
2. Add more creative controls (camera angle, lighting mood, number of people) — extend `src/skills/styles.ts` + `CreativeParams` + form.
3. Prod video stitching (Cloudinary concat) to replace the ffmpeg-local merge.
4. Fix the 2 pre-existing lint errors so `npm run build` passes.
5. Optional: per-generation model picker already exists in the registry — could expose seedream vs nano_banana_pro in the Generate UI.

---

## 7. Architecture reminders (do not cross)

- `src/skills/*` = **pure** `GenerationContext → RenderSpec` (no DB/vendors/I-O). `styles.ts`/`grounding.ts` are pure and safe to import into client components.
- `src/providers/*` = vendors behind interfaces; unconfigured → stub. Never call a vendor SDK outside `providers/`.
- `src/engine/*` = the ONLY place that calls providers + storage + `meter()`.
- Mutations in `src/server/actions/*` (`"use server"`); reads in `src/server/queries/*` (`server-only`).
- Base UI (not Radix): polymorphism via `render={<El/>}`, menu items `onClick`, etc. Read `src/components/ui/*` before use.
