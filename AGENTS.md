<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ads Maker — project conventions

**The loop:** Profile → Winning Ads → Generate (post/carousel/video). See `README.md`.

**UI is Base UI shadcn (`style: base-nova`), NOT Radix.** Key differences:
- Polymorphism uses `render={<El/>}`, NOT `asChild`. e.g. `<Button render={<Link href="…" />}>Label</Button>`.
- Menu items use `onClick`, not `onSelect`. Tooltip uses `delay`, not `delayDuration`.
- Read the component in `src/components/ui/*` before first use to confirm its props.

**Layering (do not cross these boundaries):**
- `src/skills/*` are **pure** `GenerationContext → RenderSpec`. No DB, no vendors, no I/O.
- `src/providers/*` wrap vendors behind interfaces. Never call a vendor SDK outside `providers/`. Add real impls and register in `providers/resolve.ts`; keep the stub fallback.
- `src/engine/*` is the ONLY place that calls providers + storage + writes `api_usage` (via `meter()` in `engine/meter.ts`).
- Mutations live in `src/server/actions/*` (`"use server"`); reads in `src/server/queries/*` (`import "server-only"`).

**Data:** Supabase = DB/Auth/RLS only (env keys, no `api_keys` table). Media = Cloudinary via `src/lib/storage` (`storage.upload`), local fallback when unconfigured. Every owner table has denormalized `user_id` + trivial RLS; the worker uses the service-role client (RLS-exempt). Schema lives in `supabase/migrations/0001_init.sql`.

**Jobs:** enqueue via `src/lib/jobs/queue.ts` → `after(() => kickTick())`; processors in `src/engine/processors.ts`; drained by `src/app/api/jobs/tick/route.ts`.

**Selectable models + quality (1K/2K/4K)** come from `src/providers/registry.ts`; the Generate UI renders from it.

Always run `npx tsc --noEmit` (and `npm run build` for bigger changes) before finishing.
