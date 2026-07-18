import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProviderUsage = { provider: string; units: number; costUsd: number; calls: number };

export type UsageSummary = {
  totalCost: number;
  mtdCost: number;
  byProvider: ProviderUsage[];
  generationsCost: number;
  generationCount: number;
};

const EMPTY: UsageSummary = {
  totalCost: 0,
  mtdCost: 0,
  byProvider: [],
  generationsCost: 0,
  generationCount: 0,
};

export async function getUsageSummary(): Promise<UsageSummary> {
  if (!features.supabase) return EMPTY;
  const supabase = await createSupabaseServerClient();

  const { data: usage } = await supabase
    .from("api_usage")
    .select("provider,units,cost_usd,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (usage ?? []) as { provider: string; units: number; cost_usd: number; created_at: string }[];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let totalCost = 0;
  let mtdCost = 0;
  const map = new Map<string, ProviderUsage>();
  for (const r of rows) {
    totalCost += r.cost_usd ?? 0;
    if (new Date(r.created_at) >= startOfMonth) mtdCost += r.cost_usd ?? 0;
    const cur = map.get(r.provider) ?? { provider: r.provider, units: 0, costUsd: 0, calls: 0 };
    cur.units += r.units ?? 0;
    cur.costUsd += r.cost_usd ?? 0;
    cur.calls += 1;
    map.set(r.provider, cur);
  }

  const { data: gens } = await supabase.from("generations").select("cost_usd");
  const genRows = (gens ?? []) as { cost_usd: number }[];
  const generationsCost = genRows.reduce((s, g) => s + (g.cost_usd ?? 0), 0);

  return {
    totalCost,
    mtdCost,
    byProvider: [...map.values()].sort((a, b) => b.costUsd - a.costUsd),
    generationsCost,
    generationCount: genRows.length,
  };
}
