"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { queue } from "@/lib/jobs/queue";
import { kickTick } from "@/lib/jobs/kick";
import { buildCompetitorQueries } from "@/engine/discovery";

const VALID_FORMATS = ["video", "carousel", "post"] as const;
type DiscoverFormat = (typeof VALID_FORMATS)[number];

export type DiscoverOptions = {
  formats?: DiscoverFormat[];
  /** Content-language code ("ar", "en"); omit/blank for all languages. */
  language?: string;
  /** User-edited search topic; overrides the brain-generated one when set. */
  topic?: string;
};

export async function enqueueDiscoveryAction(
  profileId: string,
  opts?: DiscoverOptions,
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!profileId) throw new Error("No active profile");

  const chosen = (opts?.formats ?? []).filter((f): f is DiscoverFormat => VALID_FORMATS.includes(f));
  const formatsPayload = chosen.length ? chosen : [...VALID_FORMATS];
  const language = (opts?.language ?? "").trim().slice(0, 8) || null;
  const topic = (opts?.topic ?? "").trim().slice(0, 300) || null;

  const { jobId } = await queue.enqueue({
    type: "discover_winning_ads",
    userId: user.id,
    payload: { profileId, formats: formatsPayload, language, topic },
    profileId,
  });

  after(() => kickTick());
  revalidatePath("/winning-ads");
  return jobId;
}

/**
 * Generate a suggested search topic from the brand brain so the user can review
 * and edit it before discovering. Returns a comma-separated list of angles.
 */
export async function suggestDiscoveryTopicAction(profileId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!profileId) throw new Error("No active profile");

  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("name,niche,brain_md").eq("id", profileId).maybeSingle(),
    supabase.from("products").select("name").eq("profile_id", profileId).limit(8),
  ]);

  const p = profile as { name?: string; niche?: string | null; brain_md?: string | null } | null;
  const niche = (p?.niche || p?.name || "").trim();
  const productTerms = ((products ?? []) as { name: string }[]).map((r) => r.name).join(", ");

  const queries = await buildCompetitorQueries({
    userId: user.id,
    jobId: null,
    brainMd: p?.brain_md ?? "",
    niche,
    productTerms,
  });
  return queries.join(", ");
}

export async function deleteWinningAdAction(input: { id: string; profileId?: string }): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createSupabaseServerClient();
  // RLS scopes this to the owner; winning_ad_media cascades on delete.
  const { error } = await supabase.from("winning_ads").delete().eq("id", input.id);
  if (error) throw error;
  revalidatePath("/winning-ads");
}
