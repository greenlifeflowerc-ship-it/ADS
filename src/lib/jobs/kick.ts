import "server-only";

import { env } from "@/lib/env";

/**
 * Fire-and-forget nudge to the drain endpoint. Called (via `after()`) right
 * after enqueue so work starts immediately without blocking the request. The
 * job is already durable in the DB, so a lost kick just means the Vercel Cron
 * (or local worker) picks it up on the next pass.
 */
export async function kickTick(): Promise<void> {
  try {
    await fetch(`${env.APP_URL}/api/jobs/tick`, {
      method: "POST",
      headers: { "x-cron-secret": env.CRON_SECRET },
      // don't keep the lambda alive waiting on the response
      cache: "no-store",
    });
  } catch {
    // ignore — cron/worker is the safety net
  }
}
