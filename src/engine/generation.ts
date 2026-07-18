import "server-only";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { skillFor } from "@/skills";
import { moderateText } from "@/lib/moderation";
import { getHiggsfieldConfig } from "@/lib/higgsfield/config";
import { connectHiggsfield } from "@/lib/higgsfield/client";
import { createHiggsfieldProviders } from "@/providers/higgsfield";
import { assertUnderBudget } from "./meter";
import { loadGenerationContext } from "./load-context";
import { ensureAnalysis } from "./analyze";
import { executeRenderSpec, type ProviderOverride } from "./execute";
import type { Job, JobsQueue } from "@/lib/jobs/types";

/** Processor for `generate_content` jobs — the §7 pipeline. */
export async function runGeneration(job: Job, queue: JobsQueue) {
  const supabase = createSupabaseAdminClient();
  const generationId = String(job.generation_id ?? job.payload.generationId ?? "");
  if (!generationId) throw new Error("generate_content: missing generationId");
  const userId = job.user_id;

  await supabase.from("generations").update({ status: "running" }).eq("id", generationId);
  await queue.heartbeat(job.id, 5, "Loading context…");

  let hfClient: Client | null = null;
  try {
    await assertUnderBudget(userId);

    const { generation, ctx } = await loadGenerationContext(generationId);

    // Only analyze when a winning ad was chosen. Generating WITHOUT a reference is
    // allowed — the skill then composes from the ad style + brand + product alone.
    if (generation.winning_ad_id && ctx.winningAd.mediaUrls.length) {
      await queue.heartbeat(job.id, 15, "Analyzing winning ad…");
      ctx.winningAd.analysis = await ensureAnalysis({
        userId,
        jobId: job.id,
        winningAdId: generation.winning_ad_id,
        current: ctx.winningAd.analysis,
        mediaUrls: ctx.winningAd.mediaUrls,
        brainMd: ctx.brainMd,
        productName: ctx.product.name,
        format: generation.type,
      });
    } else {
      await queue.heartbeat(job.id, 15, "Composing from your brand…");
    }

    // Pure skill → RenderSpec + prompt log (transparency).
    const spec = skillFor(generation.type)(ctx);
    await supabase.from("generations").update({ prompt_log: spec.promptLog }).eq("id", generationId);

    // Moderation gate before any spend on media (spec §9).
    for (const entry of spec.promptLog) {
      const m = moderateText(entry.prompt);
      if (!m.ok) throw new Error(m.reason ?? "Prompt failed moderation");
    }

    // Route generation through the Higgsfield MCP when the user has connected it
    // (Settings → Higgsfield). Otherwise fall back to the resolve() providers.
    let override: ProviderOverride | undefined;
    const hfCfg = await getHiggsfieldConfig(userId);
    if (hfCfg) {
      try {
        hfClient = await connectHiggsfield(hfCfg);
      } catch (e) {
        throw new Error(
          `Could not connect to Higgsfield MCP: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      override = createHiggsfieldProviders(hfClient);
    }

    await executeRenderSpec(spec, { userId, generationId, job, queue }, override);

    await supabase.from("generations").update({ status: "succeeded" }).eq("id", generationId);
    await queue.heartbeat(job.id, 100, "Done");
    return { generationId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Partial usage already recorded per successful call → cost stays visible.
    await supabase.from("generations").update({ status: "failed", error: message }).eq("id", generationId);
    throw e;
  } finally {
    if (hfClient) await hfClient.close().catch(() => {});
  }
}
