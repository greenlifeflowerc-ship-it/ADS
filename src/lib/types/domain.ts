/**
 * Shared domain primitives used across UI, skills, providers, and the engine.
 * These are the vocabulary of the whole app — keep them small and stable.
 */

export type QualityTier = "1K" | "2K" | "4K";
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type AdFormat = "video" | "post" | "carousel";

/** Generation type mirrors AdFormat (what the user produces). */
export type GenerationType = AdFormat;
export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";

export type JobType = "discover_winning_ads" | "generate_content";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export const QUALITY_TIERS: QualityTier[] = ["1K", "2K", "4K"];
export const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];
export const AD_FORMATS: AdFormat[] = ["video", "post", "carousel"];

export type ColorSwatch = { name: string; hex: string };
export type FontRef = { name: string; url?: string; family?: string };

/** Cached LLM analysis of a winning ad (spec §6.5). */
export type AdAnalysis = {
  hook: string;
  structure: string[];
  message: string;
  visualStyle: string;
  sequence?: string[];
  copyAngles?: string[];
  scriptBeats?: string[];
};

/** The model + quality + aspect ratio the user chose in the Generate UI. */
export type Selection = {
  modelId: string;
  providerId: string;
  quality: QualityTier;
  aspectRatio: AspectRatio;
};

/** Everything a skill needs to write grounded prompts (spec §6.5). */
export type GenerationContext<P = Record<string, unknown>> = {
  brainMd: string;
  identity: {
    logoUrl?: string;
    colors: ColorSwatch[];
    fonts: FontRef[];
    references: string[];
  };
  product: { name: string; description?: string; images: string[] };
  winningAd: { format: AdFormat; mediaUrls: string[]; analysis: AdAnalysis };
  params: P;
  selection: Selection;
};

// ---- Creative controls (shared by every type) ----
export type PeopleMode = "auto" | "with" | "without";
/** Creative direction the user picks in the Generate UI. */
export type CreativeParams = {
  /** Ad-style preset id (see src/skills/styles.ts). */
  adStyle?: string;
  /** Whether a person appears; "auto" defers to the style's default. */
  people?: PeopleMode;
  /** Optional free-text scene/direction the user adds. */
  sceneHint?: string;
};

// ---- Per-type params (validated before enqueue) ----
export type PostParams = { aspectRatio: AspectRatio } & CreativeParams;
export type CarouselParams = { slideCount: number; aspectRatio: AspectRatio } & CreativeParams;
export type VideoParams = {
  clips: number;
  clipSeconds: number;
  aspectRatio: AspectRatio;
  voiceover: { enabled: boolean; voiceId?: string; language?: string; ttsModelId?: string };
  music?: { enabled: boolean; ref?: string };
} & CreativeParams;
export type AnyTypeParams = PostParams | CarouselParams | VideoParams;
