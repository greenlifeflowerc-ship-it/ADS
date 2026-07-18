import type { AdAnalysis, AdFormat, AspectRatio, QualityTier } from "@/lib/types/domain";

/**
 * Provider interfaces — the ONLY surface the engine talks to. Concrete vendors
 * (Claude, Nano Banana, ElevenLabs, Apify, video vendors) implement these and
 * are swapped via the registry + resolver. Every call returns its metered usage
 * so the engine's single choke point can record api_usage.
 */

export type UsageUnit = "tokens" | "images" | "seconds" | "characters" | "run" | "credits";

export type UsageRecord = {
  provider: string;
  model?: string;
  units: number;
  unitType: UsageUnit;
  costUsd: number;
  /** Idempotency key so retries meter exactly once. */
  requestKey?: string;
};

export type Metered<T> = { data: T; usage: UsageRecord };

/** A provider output that is either a remote URL or in-memory bytes. */
export type MediaOut = { url?: string; bytes?: Buffer; mimeType?: string };

// ---- LLM / vision ----
export interface LLMAnalyzeInput {
  model?: string;
  mediaUrls: string[];
  brainMd: string;
  productName?: string;
  format: AdFormat;
}
export interface LLMWriteInput {
  model?: string;
  system?: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
}
export interface LLMProvider {
  readonly id: string;
  analyzeAd(input: LLMAnalyzeInput): Promise<Metered<AdAnalysis>>;
  write(input: LLMWriteInput): Promise<Metered<{ text: string }>>;
  moderate(text: string): Promise<boolean>;
}

// ---- Image ----
export interface ImageGenInput {
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  quality: QualityTier;
  referenceImages?: string[];
  overlayText?: string;
}
export interface ImageProvider {
  readonly id: string;
  generate(input: ImageGenInput): Promise<Metered<MediaOut & { width?: number; height?: number }>>;
}

// ---- Video (submit-then-poll to survive serverless time limits) ----
export interface VideoClipInput {
  model: string;
  prompt: string;
  seconds: number;
  aspectRatio: AspectRatio;
  quality: QualityTier;
  initImage?: string;
}
export interface VideoPollResult {
  done: boolean;
  url?: string;
  bytes?: Buffer;
  seconds?: number;
  usage?: UsageRecord;
  error?: string;
}
export interface VideoProvider {
  readonly id: string;
  submit(input: VideoClipInput): Promise<{ externalId: string }>;
  poll(externalId: string): Promise<VideoPollResult>;
}

// ---- TTS ----
export interface TTSInput {
  model?: string;
  text: string;
  voiceId?: string;
  language?: string;
  targetSeconds?: number;
}
export interface TTSVoice {
  voiceId: string;
  name: string;
  language?: string;
}
export interface TTSProvider {
  readonly id: string;
  synthesize(input: TTSInput): Promise<Metered<MediaOut & { seconds?: number }>>;
  listVoices(): Promise<TTSVoice[]>;
}

// ---- Scraper / ad discovery ----
export interface DiscoverInput {
  query: string;
  /** Multiple competitor search angles; the scraper rotates across them. */
  queries?: string[];
  niche: string;
  formats?: AdFormat[];
  platforms?: string[];
  /** Meta Ad Library content-language code (e.g. "ar", "en"). Omit for all languages. */
  language?: string;
  /** Ad source URLs already saved for this profile — skipped so re-runs bring new ads. */
  excludeUrls?: string[];
  limit?: number;
}
export type RawWinningAd = {
  format: AdFormat;
  sourcePlatform?: string;
  sourceUrl?: string;
  previewUrl?: string;
  metrics?: Record<string, unknown>;
  media?: { url: string; kind?: string; orderIndex?: number }[];
};
export interface ScraperProvider {
  readonly id: string;
  discover(input: DiscoverInput): Promise<Metered<RawWinningAd[]>>;
}

export type AnyProvider =
  | LLMProvider
  | ImageProvider
  | VideoProvider
  | TTSProvider
  | ScraperProvider;
