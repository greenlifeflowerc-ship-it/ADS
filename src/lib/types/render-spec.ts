import type { AspectRatio, QualityTier } from "./domain";

/**
 * RenderSpec — the pure output of a skill and the ONLY thing the engine executes.
 * Skills never call vendors; they return one of these. Extended (vs spec §6.5) to
 * carry the chosen model + quality via `target`.
 */

export type RenderTarget = { modelId: string; providerId: string; quality: QualityTier };
export type TransitionType = "cut" | "crossfade" | "fade" | "slide";

/** One prompt the skill produced, surfaced to the user for transparency. */
export type PromptLogEntry = { label: string; prompt: string };

export type PostRenderSpec = {
  type: "post";
  target: RenderTarget;
  image: {
    prompt: string;
    aspectRatio: AspectRatio;
    overlayText?: string;
    referenceImages: string[];
  };
  caption: string;
  promptLog: PromptLogEntry[];
};

export type CarouselSlideSpec = {
  index: number;
  prompt: string;
  aspectRatio: AspectRatio;
  overlayText?: string;
  referenceImages: string[];
};

export type CarouselRenderSpec = {
  type: "carousel";
  target: RenderTarget;
  slides: CarouselSlideSpec[]; // ordered 1..N
  caption?: string;
  continuity: { palette: string[]; styleTokens: string[]; productRef?: string };
  promptLog: PromptLogEntry[];
};

export type VideoClipSpec = {
  index: number;
  prompt: string;
  seconds: number;
  aspectRatio: AspectRatio;
  initImage?: string;
};

export type VideoRenderSpec = {
  type: "video";
  target: RenderTarget;
  clips: VideoClipSpec[];
  audio?: {
    voiceover?: { voiceoverScript: string; voiceId?: string; language?: string; ttsModelId?: string };
    music?: { musicRef?: string; gainDb?: number };
  };
  merge: {
    order: number[]; // clip indices in play order
    transitions: { after: number; type: TransitionType; durationMs: number }[];
    totalSeconds: number;
  };
  promptLog: PromptLogEntry[];
};

export type RenderSpec = PostRenderSpec | CarouselRenderSpec | VideoRenderSpec;
