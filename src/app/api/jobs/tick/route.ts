import { after } from "next/server";
import { NextResponse } from "next/server";
import { env, features } from "@/lib/env";
import { queue } from "@/lib/jobs/queue";
import { kickTick } from "@/lib/jobs/kick";
import { processors } from "@/engine/processors";

// Drain endpoint: claims and runs queued jobs until near the time budget, then
// re-kicks itself if work remains. Triggered by enqueue (after()), Vercel Cron,
// or the local worker. Idempotent and safe to call concurrently (SKIP LOCKED).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 50_000;

function isAuthorized(req: Request): boolean {
  // Accept our own kick header, or Vercel Cron's `Authorization: Bearer <secret>`.
  if (req.headers.get("x-cron-secret") === env.CRON_SECRET) return true;
  if (req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`) return true;
  return false;
}

async function drain(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!features.supabaseAdmin) {
    return NextResponse.json({ processed: 0, note: "supabase service role not configured" });
  }

  await queue.requeueExpired();

  const worker = env.WORKER_ID ?? `tick-${Math.random().toString(36).slice(2, 8)}`;
  const deadline = Date.now() + TIME_BUDGET_MS;
  let processed = 0;

  while (Date.now() < deadline) {
    const job = await queue.claimNext(worker, 120);
    if (!job) break;

    const proc = processors[job.type];
    try {
      if (!proc) throw new Error(`No processor registered for job type: ${job.type}`);
      const result = await proc(job, queue);
      await queue.complete(job.id, (result ?? undefined) as Record<string, unknown> | undefined);
    } catch (e) {
      const retry = job.attempts < job.max_attempts;
      await queue.fail(job.id, e instanceof Error ? e.message : String(e), {
        retry,
        backoffSec: 15 * Math.max(1, job.attempts),
      });
    }
    processed++;
  }

  if (processed > 0) after(() => kickTick());
  return NextResponse.json({ processed });
}

export async function POST(req: Request) {
  return drain(req);
}

// Vercel Cron issues GET requests; accept both.
export async function GET(req: Request) {
  return drain(req);
}
