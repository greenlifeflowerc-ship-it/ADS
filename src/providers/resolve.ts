import { features } from "@/lib/env";
import { stubImage, stubLLM, stubScraper, stubTTS, stubVideo } from "./stub";
import { anthropicLLM } from "./llm/anthropic";
import { geminiLLM } from "./llm/gemini";
import { elevenLabsTTS } from "./tts/elevenlabs";
import { apifyScraper } from "./scraper/apify";
import type {
  ImageProvider,
  LLMProvider,
  ScraperProvider,
  TTSProvider,
  VideoProvider,
} from "./types";

/**
 * Resolve a `providerId` (from the model registry) to a concrete implementation,
 * falling back to the stub when the real provider isn't keyed — so the pipeline
 * always runs.
 */

export function resolveLLM(providerId?: string): LLMProvider {
  // Explicit choice (from the registry's llm providerId) is honored when keyed.
  if (providerId === "gemini") return features.gemini ? geminiLLM : stubLLM;
  if (providerId === "anthropic") return features.anthropic ? anthropicLLM : stubLLM;
  // No explicit choice: Claude first, Gemini as fallback, then stub.
  if (features.anthropic) return anthropicLLM;
  if (features.gemini) return geminiLLM;
  return stubLLM;
}

// Image + video generation run exclusively through the Higgsfield MCP (the
// engine passes it as a ProviderOverride when the user has connected it in
// Settings). These stubs only keep the pipeline alive when it isn't connected.
export function resolveImage(_providerId = "higgsfield"): ImageProvider {
  return stubImage;
}

export function resolveVideo(_providerId = "higgsfield"): VideoProvider {
  return stubVideo;
}

export function resolveTTS(_providerId = "elevenlabs"): TTSProvider {
  return features.elevenlabs ? elevenLabsTTS : stubTTS;
}

export function resolveScraper(_providerId = "apify"): ScraperProvider {
  return features.apify ? apifyScraper : stubScraper;
}
