import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO, DEMO_RECENT, demoGenerationDetail } from "@/lib/demo";
import type { GenerationAssetRow, GenerationRow } from "@/lib/types/db";

export type RecentGeneration = Pick<
  GenerationRow,
  "id" | "type" | "status" | "cost_usd" | "created_at"
> & { thumb_url: string | null };

type AssetLite = Pick<GenerationAssetRow, "url" | "kind" | "order_index">;

function pickThumb(assets: AssetLite[]): string | null {
  if (!assets.length) return null;
  const sorted = [...assets].sort((a, b) => a.order_index - b.order_index);
  return (
    sorted.find((a) => a.kind === "final")?.url ??
    sorted.find((a) => a.kind === "image")?.url ??
    sorted[0]?.url ??
    null
  );
}

export async function getRecentGenerations(
  profileId: string,
  limit = 8,
): Promise<RecentGeneration[]> {
  if (DEMO) return DEMO_RECENT;
  if (!features.supabase || !profileId) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("generations")
    .select("id,type,status,cost_usd,created_at, generation_assets(url,kind,order_index)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<GenerationRow & { generation_assets: AssetLite[] }>).map((g) => ({
    id: g.id,
    type: g.type,
    status: g.status,
    cost_usd: g.cost_usd,
    created_at: g.created_at,
    thumb_url: pickThumb(g.generation_assets ?? []),
  }));
}

export type GenerationDetail = GenerationRow & { assets: GenerationAssetRow[] };

export async function getGenerationDetail(id: string): Promise<GenerationDetail | null> {
  if (DEMO) return demoGenerationDetail(id);
  if (!features.supabase || !id) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("generations")
    .select("*, generation_assets(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as GenerationRow & { generation_assets: GenerationAssetRow[] };
  const assets = [...(row.generation_assets ?? [])].sort((a, b) => a.order_index - b.order_index);
  return { ...row, assets };
}
