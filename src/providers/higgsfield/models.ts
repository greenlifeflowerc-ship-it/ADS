import type { AdFormat } from "@/lib/types/domain";

/**
 * Map our registry model ids → Higgsfield model ids. Defaults favor the
 * Marketing Studio models (built for product/ad creatives). Unknown ids fall
 * back to the per-type default. Override the whole map as needed.
 */
const IMAGE_MODELS: Record<string, string> = {
  // Higgsfield-native ids (pass through).
  seedream_v4_5: "seedream_v4_5",
  nano_banana_pro: "nano_banana_pro",
  marketing_studio_image: "marketing_studio_image",
  // Registry / legacy ids → Seedream: far stronger photoreal SCENE composition than
  // nano_banana, which tends to just reproduce the product reference image.
  "gemini-nano-banana-2": "seedream_v4_5",
  "openai-gpt-image-1": "seedream_v4_5",
  "flux-1-1-pro": "seedream_v4_5",
};

const VIDEO_MODELS: Record<string, string> = {
  seedance_2_0: "seedance_2_0",
  kling3_0: "kling3_0",
  kling3_0_turbo: "kling3_0_turbo",
  marketing_studio_video: "marketing_studio_video",
  "seedance-1-pro": "seedance_2_0",
  "veo-3": "kling3_0",
  "kling-2": "kling3_0_turbo",
};

export const HIGGSFIELD_DEFAULT = {
  image: "seedream_v4_5",
  video: "marketing_studio_video",
  audio: "seed_audio",
};

export function higgsfieldModel(mediaType: "image" | "video", registryId: string): string {
  if (mediaType === "image") return IMAGE_MODELS[registryId] ?? HIGGSFIELD_DEFAULT.image;
  return VIDEO_MODELS[registryId] ?? HIGGSFIELD_DEFAULT.video;
}

export function mediaRoleForType(type: AdFormat): string {
  // Reference-image role hints for the Higgsfield tools.
  return type === "video" ? "start_image" : "image";
}
