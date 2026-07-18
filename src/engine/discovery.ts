import "server-only";

import { features } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveLLM, resolveScraper } from "@/providers/resolve";
import { meter } from "./meter";
import type { AdFormat } from "@/lib/types/domain";
import type { Job, JobsQueue } from "@/lib/jobs/types";

/**
 * Read the brand brain and turn it into SEVERAL distinct Meta Ad Library keyword
 * searches, each aimed at COMPETITORS (same category + market, not this brand's
 * own name) from a DIFFERENT angle (sub-category / benefit / audience). Multiple
 * angles + the scraper rotating across them keeps re-runs from returning the same
 * ads. Falls back to the raw niche + product terms when no LLM is keyed / it fails.
 */
export async function buildCompetitorQueries(opts: {
  userId: string;
  jobId?: string | null;
  brainMd: string;
  niche: string;
  productTerms: string;
}): Promise<string[]> {
  const fallback = [opts.niche, opts.productTerms].filter(Boolean).join(" ").trim() || "top performing ads";
  if (!features.anthropic && !features.gemini) return [fallback];

  try {
    const llm = resolveLLM();
    const { text } = await meter(
      opts.userId,
      null,
      llm.write({
        system:
          "You are a paid-ads researcher who finds COMPETITOR ads in the Meta (Facebook/Instagram) Ad Library.",
        prompt: [
          "Read the brand below and output 6 DISTINCT short keyword searches (3–6 words each) to find",
          "COMPETITOR ads in the Meta Ad Library. Each line must target a DIFFERENT angle — a different",
          "sub-category, product type, benefit, or audience — same market, NOT this brand's own name.",
          "Use the brand's primary market language. Output ONLY the searches, ONE per line: no numbering,",
          "no quotes, no explanation.",
          "",
          `NICHE: ${opts.niche || "(unspecified)"}`,
          `PRODUCTS: ${opts.productTerms || "(none listed)"}`,
          "BRAND BRAIN:",
          opts.brainMd.slice(0, 1500),
        ].join("\n"),
        maxTokens: 160,
      }),
      opts.jobId,
    );

    const queries = text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").replace(/^["'`]|["'`]$/g, "").trim())
      .filter((l) => l.length > 1 && !l.startsWith("[[stub"))
      .map((l) => l.slice(0, 100));

    const unique = Array.from(new Set(queries));
    return unique.length ? unique : [fallback];
  } catch {
    return [fallback];
  }
}

/** Processor for `discover_winning_ads` jobs (spec §6.3). */
export async function runDiscovery(job: Job, queue: JobsQueue) {
  const supabase = createSupabaseAdminClient();
  const userId = job.user_id;
  const profileId = String(job.payload.profileId ?? job.profile_id ?? "");
  if (!profileId) throw new Error("discover_winning_ads: missing profileId");

  await queue.heartbeat(job.id, 10, "Reading the brand brain…");

  const [{ data: profile }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("name,niche,brain_md").eq("id", profileId).maybeSingle(),
    supabase.from("products").select("name").eq("profile_id", profileId).limit(8),
  ]);

  const niche = (profile?.niche || profile?.name || "").trim();
  const productTerms = ((products ?? []) as { name: string }[]).map((p) => p.name).join(", ");

  // A user-edited topic (from the UI) overrides the brain-generated one. Otherwise
  // generate competitor search angles from the company brain.
  const topic = String(job.payload.topic ?? "").trim();
  const queries = topic
    ? topic
        .split(/[\n,،]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : await buildCompetitorQueries({
        userId,
        jobId: job.id,
        brainMd: (profile as { brain_md?: string | null } | null)?.brain_md ?? "",
        niche,
        productTerms,
      });

  // Optional ad-library content language filter (e.g. "ar", "en").
  const language = (String(job.payload.language ?? "").trim() || undefined) as string | undefined;

  // Skip ads already saved for this profile so each run brings NEW ones.
  const { data: existing } = await supabase
    .from("winning_ads")
    .select("source_url")
    .eq("profile_id", profileId)
    .not("source_url", "is", null);
  const excludeUrls = ((existing ?? []) as { source_url: string | null }[])
    .map((r) => r.source_url)
    .filter((u): u is string => !!u);

  // Which ad formats to search for (from the UI filter); default all three.
  const allFormats: AdFormat[] = ["video", "carousel", "post"];
  const payloadFormats = (job.payload.formats as AdFormat[] | undefined)?.filter((f) =>
    allFormats.includes(f),
  );
  const formats = payloadFormats?.length ? payloadFormats : allFormats;

  await queue.heartbeat(
    job.id,
    30,
    `Searching the ad library — ${formats.join(", ")}, ${queries.length} angles…`,
  );

  const scraper = resolveScraper();
  // Target a balanced mix across the requested formats, rotating search angles.
  const ads = await meter(
    userId,
    null,
    scraper.discover({ query: queries[0], queries, niche, excludeUrls, formats, language, limit: 20 }),
    job.id,
  );

  await queue.heartbeat(job.id, 65, "Saving results…");

  let saved = 0;
  for (const ad of ads) {
    const { data: adRow, error } = await supabase
      .from("winning_ads")
      .upsert(
        {
          profile_id: profileId,
          user_id: userId,
          format: ad.format,
          source_platform: ad.sourcePlatform ?? null,
          source_url: ad.sourceUrl ?? null,
          preview_url: ad.previewUrl ?? null,
          metrics: ad.metrics ?? {},
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,source_url" },
      )
      .select("id")
      .single();

    if (error || !adRow) continue;

    // Replace media for this ad (idempotent on re-run).
    await supabase.from("winning_ad_media").delete().eq("winning_ad_id", adRow.id);
    const media = ad.media ?? [];
    if (media.length) {
      await supabase.from("winning_ad_media").insert(
        media.map((m, i) => ({
          winning_ad_id: adRow.id,
          user_id: userId,
          url: m.url,
          kind: m.kind ?? null,
          order_index: m.orderIndex ?? i,
        })),
      );
    }
    saved += 1;
  }

  await queue.heartbeat(job.id, 100, `Found ${saved} ad${saved === 1 ? "" : "s"}`);
  return { saved };
}
