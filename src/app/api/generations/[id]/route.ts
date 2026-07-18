import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GenerationAssetRow, GenerationRow } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!features.supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();

  const { data: gen } = await supabase
    .from("generations")
    .select("*, generation_assets(*)")
    .eq("id", id)
    .maybeSingle();
  if (!gen) return NextResponse.json({ error: "not found" }, { status: 404 });

  const row = gen as GenerationRow & { generation_assets: GenerationAssetRow[] };
  const assets = [...(row.generation_assets ?? [])].sort((a, b) => a.order_index - b.order_index);

  const { data: job } = await supabase
    .from("jobs")
    .select("status,progress,progress_message,error")
    .eq("generation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const generation: Record<string, unknown> = { ...row };
  delete generation.generation_assets;
  return NextResponse.json({ generation, assets, job: job ?? null });
}
