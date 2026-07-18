import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveLLM } from "@/providers/resolve";
import { meter } from "./meter";
import type { AdAnalysis, AdFormat } from "@/lib/types/domain";

export function isAnalysisEmpty(a?: AdAnalysis | null): boolean {
  return !a || (!a.hook && (a.structure?.length ?? 0) === 0 && !a.message && !a.visualStyle);
}

/**
 * Return the winning ad's cached analysis, or run the LLM (vision) once and cache
 * it to winning_ads.analysis (spec §7 step 2).
 */
export async function ensureAnalysis(opts: {
  userId: string;
  jobId: string;
  winningAdId: string | null;
  current: AdAnalysis | null;
  mediaUrls: string[];
  brainMd: string;
  productName: string;
  format: AdFormat;
}): Promise<AdAnalysis> {
  if (!isAnalysisEmpty(opts.current)) return opts.current as AdAnalysis;

  const llm = resolveLLM();
  const analysis = await meter(
    opts.userId,
    null,
    llm.analyzeAd({
      mediaUrls: opts.mediaUrls,
      brainMd: opts.brainMd,
      productName: opts.productName,
      format: opts.format,
    }),
    opts.jobId,
  );

  if (opts.winningAdId) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("winning_ads").update({ analysis }).eq("id", opts.winningAdId);
  }
  return analysis;
}
