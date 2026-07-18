"use server";

import { after } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { queue } from "@/lib/jobs/queue";
import { kickTick } from "@/lib/jobs/kick";
import { findModel } from "@/providers/registry";
import {
  CarouselParamsSchema,
  GenerateInput,
  GenerateInputSchema,
  PostParamsSchema,
  VideoParamsSchema,
} from "@/lib/validate";

export async function enqueueGenerationAction(
  input: GenerateInput,
): Promise<{ generationId: string; jobId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const base = GenerateInputSchema.parse(input);
  const model = findModel(base.modelId);
  if (!model) throw new Error("Unknown model");

  // Validate the type-specific params (aspect ratio is shared).
  const merged = { aspectRatio: base.aspectRatio, ...base.typeParams };
  const typeParams =
    base.type === "post"
      ? PostParamsSchema.parse(merged)
      : base.type === "carousel"
        ? CarouselParamsSchema.parse(merged)
        : VideoParamsSchema.parse(merged);

  const params = {
    modelId: base.modelId,
    providerId: model.providerId,
    quality: base.quality,
    ...typeParams, // includes aspectRatio
  };

  const supabase = await createSupabaseServerClient();
  const { data: gen, error } = await supabase
    .from("generations")
    .insert({
      profile_id: base.profileId,
      winning_ad_id: base.winningAdId,
      type: base.type,
      status: "queued",
      params,
      product_image_ids: base.productImageIds,
    })
    .select("id")
    .single();
  if (error) throw error;

  const generationId = gen!.id as string;

  const { jobId } = await queue.enqueue({
    type: "generate_content",
    userId: user.id,
    payload: { generationId },
    profileId: base.profileId,
    generationId,
  });

  after(() => kickTick());
  return { generationId, jobId };
}
