import type { AdFormat, AspectRatio, QualityTier } from "@/lib/types/domain";

/**
 * Model registry — the source of truth for the user-selectable models and their
 * capabilities. The Generate UI reads this to render the model dropdown, the
 * 1K/2K/4K quality toggle, the aspect-ratio buttons, and the live cost estimate.
 * `providerId` maps to a concrete impl in resolve.ts.
 *
 * NOTE: model ids / prices below are sensible defaults; verify against live
 * vendor docs when wiring real providers in Phase 4.
 */

export type MediaType = "image" | "video" | "tts" | "llm";

export interface ModelCapabilities {
  aspectRatios: AspectRatio[];
  qualityTiers: QualityTier[]; // tiers the model emits natively; gaps filled by an upscale step
  maxClipSeconds?: number;
  supportsInitImage?: boolean;
}

export interface CostHint {
  unit: "image" | "second" | "1k_chars" | "1k_tokens" | "run";
  usdPerUnit: number;
  qualityMultiplier?: Partial<Record<QualityTier, number>>;
}

export interface ModelDescriptor {
  id: string; // stable id stored in RenderSpec, e.g. 'gemini-nano-banana-2'
  label: string;
  providerId: string; // → resolve.ts, e.g. 'gemini'
  mediaType: MediaType;
  default?: boolean;
  badges?: string[]; // 'Default' | 'Best quality' | 'Fastest' | 'Cheapest'
  status?: "stable" | "beta";
  capabilities: ModelCapabilities;
  cost: CostHint;
}

export type ModelRegistry = Record<MediaType, ModelDescriptor[]>;

const ALL_RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

// Image + video generate exclusively through the Higgsfield MCP (connected in
// Settings). Ids below are Higgsfield model ids; Higgsfield bills in credits on
// the user's own account, so USD cost hints are 0 here.
export const MODEL_REGISTRY: ModelRegistry = {
  image: [
    {
      id: "nano_banana_pro",
      label: "Nano Banana Pro",
      providerId: "higgsfield",
      mediaType: "image",
      default: true,
      badges: ["Default"],
      status: "stable",
      capabilities: { aspectRatios: ALL_RATIOS, qualityTiers: ["1K"], supportsInitImage: true },
      cost: { unit: "image", usdPerUnit: 0 },
    },
    {
      id: "marketing_studio_image",
      label: "Marketing Studio Image",
      providerId: "higgsfield",
      mediaType: "image",
      badges: ["Best quality"],
      capabilities: { aspectRatios: ALL_RATIOS, qualityTiers: ["1K"], supportsInitImage: true },
      cost: { unit: "image", usdPerUnit: 0 },
    },
  ],
  video: [
    {
      id: "seedance_2_0",
      label: "Seedance 2.0",
      providerId: "higgsfield",
      mediaType: "video",
      default: true,
      badges: ["Default"],
      capabilities: {
        aspectRatios: ["9:16", "16:9", "1:1"],
        qualityTiers: ["1K"],
        maxClipSeconds: 10,
        supportsInitImage: true,
      },
      cost: { unit: "second", usdPerUnit: 0 },
    },
    {
      id: "kling3_0",
      label: "Kling 3.0",
      providerId: "higgsfield",
      mediaType: "video",
      badges: ["Best quality"],
      capabilities: {
        aspectRatios: ["9:16", "16:9", "1:1"],
        qualityTiers: ["1K"],
        maxClipSeconds: 10,
        supportsInitImage: true,
      },
      cost: { unit: "second", usdPerUnit: 0 },
    },
    {
      id: "kling3_0_turbo",
      label: "Kling 3.0 Turbo",
      providerId: "higgsfield",
      mediaType: "video",
      badges: ["Fastest"],
      capabilities: {
        aspectRatios: ["9:16", "16:9", "1:1"],
        qualityTiers: ["1K"],
        maxClipSeconds: 10,
        supportsInitImage: true,
      },
      cost: { unit: "second", usdPerUnit: 0 },
    },
    {
      id: "marketing_studio_video",
      label: "Marketing Studio Video",
      providerId: "higgsfield",
      mediaType: "video",
      capabilities: {
        aspectRatios: ["9:16", "16:9", "1:1"],
        qualityTiers: ["1K"],
        maxClipSeconds: 10,
        supportsInitImage: true,
      },
      cost: { unit: "second", usdPerUnit: 0 },
    },
  ],
  tts: [
    {
      id: "elevenlabs-multilingual-v2",
      label: "ElevenLabs Multilingual v2",
      providerId: "elevenlabs",
      mediaType: "tts",
      default: true,
      capabilities: { aspectRatios: [], qualityTiers: [] },
      cost: { unit: "1k_chars", usdPerUnit: 0.3 },
    },
    {
      id: "elevenlabs-turbo-v2-5",
      label: "ElevenLabs Turbo v2.5",
      providerId: "elevenlabs",
      mediaType: "tts",
      badges: ["Fastest"],
      capabilities: { aspectRatios: [], qualityTiers: [] },
      cost: { unit: "1k_chars", usdPerUnit: 0.15 },
    },
  ],
  llm: [
    {
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
      providerId: "anthropic",
      mediaType: "llm",
      default: true,
      badges: ["Default", "Fastest"],
      capabilities: { aspectRatios: [], qualityTiers: [] },
      cost: { unit: "1k_tokens", usdPerUnit: 0.003 },
    },
    {
      id: "claude-opus-4-8",
      label: "Claude Opus 4.8",
      providerId: "anthropic",
      mediaType: "llm",
      badges: ["Best quality"],
      capabilities: { aspectRatios: [], qualityTiers: [] },
      cost: { unit: "1k_tokens", usdPerUnit: 0.015 },
    },
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      providerId: "gemini",
      mediaType: "llm",
      badges: ["Cheapest"],
      capabilities: { aspectRatios: [], qualityTiers: [] },
      cost: { unit: "1k_tokens", usdPerUnit: 0.001 },
    },
  ],
};

/** Post + carousel produce images; video produces video. */
export function outputTypeToMedia(type: AdFormat): MediaType {
  return type === "video" ? "video" : "image";
}

export function modelsFor(type: AdFormat): ModelDescriptor[] {
  return MODEL_REGISTRY[outputTypeToMedia(type)];
}

export function defaultModel(type: AdFormat): ModelDescriptor {
  const list = modelsFor(type);
  return list.find((m) => m.default) ?? list[0];
}

export function findModel(modelId: string): ModelDescriptor | undefined {
  return (Object.values(MODEL_REGISTRY).flat() as ModelDescriptor[]).find((m) => m.id === modelId);
}

export function defaultLLM(): ModelDescriptor {
  return MODEL_REGISTRY.llm.find((m) => m.default) ?? MODEL_REGISTRY.llm[0];
}

export function defaultTTS(): ModelDescriptor {
  return MODEL_REGISTRY.tts.find((m) => m.default) ?? MODEL_REGISTRY.tts[0];
}

/** Rough cost estimate for a number of units, applying the quality multiplier. */
export function estimateCost(model: ModelDescriptor, quality: QualityTier, units: number): number {
  const mult = model.cost.qualityMultiplier?.[quality] ?? 1;
  return Math.round(model.cost.usdPerUnit * mult * units * 10000) / 10000;
}
