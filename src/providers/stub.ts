import type { AspectRatio, QualityTier } from "@/lib/types/domain";
import type {
  ImageProvider,
  LLMProvider,
  ScraperProvider,
  TTSProvider,
  VideoProvider,
} from "./types";

/**
 * Stub providers — deterministic fake output with $0 metered cost. They let the
 * whole pipeline (discovery → analysis → skill → generate → assemble) run before
 * real vendor keys exist. Usage is still recorded (units, $0) so metering is
 * exercised. Swapped for real impls via resolve.ts as keys become available.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function dims(aspect: AspectRatio): { w: number; h: number } {
  switch (aspect) {
    case "1:1":
      return { w: 1024, h: 1024 };
    case "4:5":
      return { w: 819, h: 1024 };
    case "9:16":
      return { w: 576, h: 1024 };
    case "16:9":
      return { w: 1024, h: 576 };
  }
}

function placeholderImage(seed: string, aspect: AspectRatio): { url: string; width: number; height: number } {
  const { w, h } = dims(aspect);
  return { url: `https://picsum.photos/seed/${hash(seed)}/${w}/${h}`, width: w, height: h };
}

const SAMPLE_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const SAMPLE_AUDIO = "https://file-examples.com/storage/fe0e2ab9c7e0e0c3f1b1d8e/2017/11/file_example_MP3_700KB.mp3";

export const stubLLM: LLMProvider = {
  id: "stub-llm",
  async analyzeAd({ format, productName }) {
    return {
      data: {
        hook: "Open on the problem the viewer feels every day, then a fast reveal of the fix.",
        structure: ["Hook / pattern-interrupt", "Problem agitation", "Product reveal", "Proof / benefit", "Call to action"],
        message: `Show how ${productName ?? "the product"} makes the desired outcome effortless.`,
        visualStyle: "Bright, high-contrast, punchy captions, product hero shots, quick cuts.",
        sequence: format === "carousel" ? ["Hook slide", "Problem", "Solution", "Proof", "CTA"] : undefined,
        copyAngles: ["Time saved", "Ease of use", "Social proof"],
        scriptBeats: format === "video" ? ["0-2s hook", "2-6s problem", "6-12s reveal", "12-18s proof", "18-20s CTA"] : undefined,
      },
      usage: { provider: "stub-llm", units: 1200, unitType: "tokens", costUsd: 0 },
    };
  },
  async write({ prompt }) {
    return {
      data: { text: `[[stub copy grounded on]]: ${prompt.slice(0, 140)}` },
      usage: { provider: "stub-llm", units: 400, unitType: "tokens", costUsd: 0 },
    };
  },
  async moderate() {
    return true;
  },
};

export const stubImage: ImageProvider = {
  id: "stub-image",
  async generate({ prompt, aspectRatio }) {
    const img = placeholderImage(prompt, aspectRatio);
    return {
      data: img,
      usage: { provider: "stub-image", units: 1, unitType: "images", costUsd: 0 },
    };
  },
};

export const stubVideo: VideoProvider = {
  id: "stub-video",
  async submit({ prompt, seconds }) {
    return { externalId: `stub:${hash(prompt)}:${seconds}` };
  },
  async poll(externalId) {
    const seconds = Number(externalId.split(":")[2] ?? 5);
    return {
      done: true,
      url: SAMPLE_VIDEO,
      seconds,
      usage: { provider: "stub-video", units: seconds, unitType: "seconds", costUsd: 0 },
    };
  },
};

export const stubTTS: TTSProvider = {
  id: "stub-tts",
  async synthesize({ text, targetSeconds }) {
    return {
      data: { url: SAMPLE_AUDIO, seconds: targetSeconds ?? Math.max(3, Math.round(text.length / 15)) },
      usage: { provider: "stub-tts", units: text.length, unitType: "characters", costUsd: 0 },
    };
  },
  async listVoices() {
    return [
      { voiceId: "stub-voice-rachel", name: "Rachel (stub)", language: "en" },
      { voiceId: "stub-voice-adam", name: "Adam (stub)", language: "en" },
      { voiceId: "stub-voice-sara", name: "Sara (stub)", language: "ar" },
    ];
  },
};

export const stubScraper: ScraperProvider = {
  id: "stub-scraper",
  async discover({ niche, limit = 5 }) {
    const formats: Array<"video" | "post" | "carousel"> = ["video", "post", "carousel", "post", "video"];
    const ads = Array.from({ length: limit }).map((_, i) => {
      const format = formats[i % formats.length];
      const previewAspect: AspectRatio = format === "video" ? "9:16" : "1:1";
      const preview = placeholderImage(`${niche}-${i}`, previewAspect);
      return {
        format,
        sourcePlatform: ["Meta Ad Library", "TikTok", "Instagram"][i % 3],
        sourceUrl: `https://example.com/ads/${hash(niche + i)}`,
        previewUrl: preview.url,
        metrics: { likes: 1000 + hash(`${niche}${i}`) % 90000, relevance: 0.9 - i * 0.1 },
        media:
          format === "carousel"
            ? Array.from({ length: 4 }).map((__, s) => ({
                url: placeholderImage(`${niche}-${i}-${s}`, "1:1").url,
                kind: "image",
                orderIndex: s,
              }))
            : format === "video"
              ? [{ url: SAMPLE_VIDEO, kind: "video", orderIndex: 0 }]
              : [{ url: preview.url, kind: "image", orderIndex: 0 }],
      };
    });
    return { data: ads, usage: { provider: "stub-scraper", units: 1, unitType: "run", costUsd: 0 } };
  },
};

// Quality tier is accepted by real providers; the stub ignores it but keeps the signature honest.
export const _acceptsQuality: QualityTier[] = ["1K", "2K", "4K"];
