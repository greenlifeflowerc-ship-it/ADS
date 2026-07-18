import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GenerationRow } from "@/lib/types/db";
import type {
  AdAnalysis,
  AdFormat,
  AspectRatio,
  ColorSwatch,
  FontRef,
  GenerationContext,
  QualityTier,
  Selection,
} from "@/lib/types/domain";

export function emptyAnalysis(): AdAnalysis {
  return { hook: "", structure: [], message: "", visualStyle: "", sequence: [], copyAngles: [], scriptBeats: [] };
}

export type LoadedGeneration = {
  generation: GenerationRow;
  ctx: GenerationContext;
};

/** Load everything a skill needs to produce a grounded RenderSpec (spec §7 step 1). */
export async function loadGenerationContext(generationId: string): Promise<LoadedGeneration> {
  const supabase = createSupabaseAdminClient();

  const { data: gen } = await supabase.from("generations").select("*").eq("id", generationId).maybeSingle();
  if (!gen) throw new Error("Generation not found");
  const generation = gen as GenerationRow;

  const [{ data: profile }, { data: identity }, { data: identityImages }] = await Promise.all([
    supabase.from("profiles").select("brain_md,name").eq("id", generation.profile_id).maybeSingle(),
    supabase.from("profile_identity").select("*").eq("profile_id", generation.profile_id).maybeSingle(),
    supabase.from("identity_images").select("url").eq("profile_id", generation.profile_id),
  ]);

  // Chosen product image(s) → product name/description + image URLs.
  const imageIds = generation.product_image_ids ?? [];
  let productName = "Product";
  let productDescription: string | undefined;
  let productImages: string[] = [];
  if (imageIds.length) {
    const { data: imgs } = await supabase
      .from("product_images")
      .select("url,product_id")
      .in("id", imageIds);
    const rows = (imgs ?? []) as { url: string; product_id: string }[];
    productImages = rows.map((r) => r.url);
    const productId = rows[0]?.product_id;
    if (productId) {
      const { data: product } = await supabase
        .from("products")
        .select("name,description")
        .eq("id", productId)
        .maybeSingle();
      if (product) {
        productName = (product as { name: string }).name;
        productDescription = (product as { description: string | null }).description ?? undefined;
      }
    }
  }

  // Winning ad + cached analysis.
  let winningAd: GenerationContext["winningAd"] = {
    format: generation.type,
    mediaUrls: [],
    analysis: emptyAnalysis(),
  };
  if (generation.winning_ad_id) {
    const [{ data: ad }, { data: media }] = await Promise.all([
      supabase.from("winning_ads").select("format,analysis,preview_url").eq("id", generation.winning_ad_id).maybeSingle(),
      supabase.from("winning_ad_media").select("url").eq("winning_ad_id", generation.winning_ad_id).order("order_index"),
    ]);
    const mediaUrls = ((media ?? []) as { url: string }[]).map((m) => m.url);
    const preview = (ad as { preview_url: string | null } | null)?.preview_url;
    if (preview && !mediaUrls.includes(preview)) mediaUrls.unshift(preview);
    winningAd = {
      format: ((ad as { format: AdFormat } | null)?.format ?? generation.type) as AdFormat,
      mediaUrls,
      analysis: ((ad as { analysis: AdAnalysis | null } | null)?.analysis ?? emptyAnalysis()) as AdAnalysis,
    };
  }

  const params = (generation.params ?? {}) as Record<string, unknown>;
  const selection: Selection = {
    modelId: String(params.modelId ?? ""),
    providerId: String(params.providerId ?? ""),
    quality: (params.quality as QualityTier) ?? "1K",
    aspectRatio: (params.aspectRatio as AspectRatio) ?? "1:1",
  };

  const ctx: GenerationContext = {
    brainMd: (profile as { brain_md: string } | null)?.brain_md ?? "",
    identity: {
      logoUrl: (identity as { logo_url: string | null } | null)?.logo_url ?? undefined,
      colors: (((identity as { colors: ColorSwatch[] } | null)?.colors) ?? []) as ColorSwatch[],
      fonts: (((identity as { fonts: FontRef[] } | null)?.fonts) ?? []) as FontRef[],
      references: ((identityImages ?? []) as { url: string }[]).map((r) => r.url),
    },
    product: { name: productName, description: productDescription, images: productImages },
    winningAd,
    params,
    selection,
  };

  return { generation, ctx };
}
