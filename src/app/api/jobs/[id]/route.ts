import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Job status for client polling. RLS scopes reads to the authenticated user.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!features.supabase) {
    return NextResponse.json({ error: "not configured" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("jobs")
    .select("id,type,status,progress,progress_message,error,generation_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
