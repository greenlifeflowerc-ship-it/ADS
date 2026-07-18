import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Metered, UsageRecord } from "@/providers/types";

/**
 * The metering choke point (spec §7). Every provider call is wrapped by `meter`,
 * which records the usage row and rolls it into generations.cost_usd exactly once
 * (via the add_usage RPC). Skills never touch this; only the engine does.
 */

export async function recordUsage(
  userId: string,
  generationId: string | null,
  usage: UsageRecord,
  jobId?: string | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc("add_usage", {
    p_user: userId,
    p_generation: generationId,
    p_provider: usage.provider,
    p_units: usage.units,
    p_unit_type: usage.unitType,
    p_cost: usage.costUsd,
    p_request_key: usage.requestKey ?? null,
    p_job: jobId ?? null,
  });
}

export async function meter<T>(
  userId: string,
  generationId: string | null,
  call: Promise<Metered<T>>,
  jobId?: string | null,
): Promise<T> {
  const { data, usage } = await call;
  await recordUsage(userId, generationId, usage, jobId);
  return data;
}

/** Hard-stop new work if the month-to-date spend has hit the configured cap. */
export async function assertUnderBudget(userId: string): Promise<void> {
  if (!env.BUDGET_MONTHLY_USD || env.BUDGET_MONTHLY_USD <= 0) return;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.rpc("month_to_date_cost", { p_user: userId });
  const spent = Number(data ?? 0);
  if (spent >= env.BUDGET_MONTHLY_USD) {
    throw new Error(
      `Monthly budget of $${env.BUDGET_MONTHLY_USD} reached ($${spent.toFixed(2)} spent). Raise it in Settings to continue.`,
    );
  }
}
