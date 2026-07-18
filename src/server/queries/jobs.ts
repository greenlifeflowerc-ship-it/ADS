import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO, DEMO_JOBS } from "@/lib/demo";
import type { JobRow } from "@/lib/types/db";

export type RunningJob = Pick<
  JobRow,
  "id" | "type" | "status" | "progress" | "progress_message" | "created_at" | "generation_id"
>;

export async function getRunningJobs(profileId?: string): Promise<RunningJob[]> {
  if (DEMO) return DEMO_JOBS;
  if (!features.supabase) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("jobs")
    .select("id,type,status,progress,progress_message,created_at,generation_id")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false });

  if (profileId) query = query.eq("profile_id", profileId);

  const { data } = await query;
  return (data ?? []) as RunningJob[];
}
