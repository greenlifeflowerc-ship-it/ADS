import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { defaultLLM } from "@/providers/registry";
import type { AdAnalysis } from "@/lib/types/domain";
import type { LLMAnalyzeInput, LLMProvider, LLMWriteInput, Metered } from "@/providers/types";
import { analyzeInstruction, parseAnalysis } from "./shared";

function client() {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

const ANTHROPIC_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Fetch a media URL and return it as a base64 image block. We download it
 * ourselves (rather than passing a URL source) because Anthropic's URL fetcher
 * honors robots.txt, and ad-library CDNs (fbcdn.net, etc.) disallow it → 400.
 * HEAD-probes first so we skip videos without downloading them. Returns null on
 * any non-image / failure so analysis proceeds with whatever images succeed.
 */
async function urlToImageBlock(url: string): Promise<Anthropic.ImageBlockParam | null> {
  try {
    let contentType = "";
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (head.ok) contentType = (head.headers.get("content-type") ?? "").split(";")[0].trim();
    } catch {
      /* some CDNs reject HEAD — fall through to GET */
    }
    if (contentType && !contentType.startsWith("image/")) return null;

    const res = await fetch(url);
    if (!res.ok) return null;
    contentType = (res.headers.get("content-type") ?? contentType).split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;

    const mediaType = ANTHROPIC_IMAGE_TYPES.has(contentType)
      ? (contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
      : "image/jpeg";
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") },
    };
  } catch {
    return null;
  }
}

// Approximate USD per 1K tokens {input, output}. Refine against live pricing.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 0.005, out: 0.025 },
  "claude-sonnet-5": { in: 0.003, out: 0.015 },
};

function cost(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5"];
  return (inTok / 1000) * p.in + (outTok / 1000) * p.out;
}

export const anthropicLLM: LLMProvider = {
  id: "anthropic",

  async analyzeAd(input: LLMAnalyzeInput): Promise<Metered<AdAnalysis>> {
    const model = input.model ?? defaultLLM().id;

    // Download images ourselves → base64 (Anthropic's URL fetch is robots-blocked
    // on ad CDNs). Try the first several media URLs; keep whichever are images.
    const blocks = (
      await Promise.all(input.mediaUrls.slice(0, 6).map((u) => urlToImageBlock(u)))
    ).filter((b): b is Anthropic.ImageBlockParam => b !== null);

    const content: Anthropic.ContentBlockParam[] = [
      ...blocks,
      { type: "text", text: analyzeInstruction(input) },
    ];

    const res = await client().messages.create({
      model,
      max_tokens: 1200,
      system: "You are an expert direct-response ad analyst. Output strictly valid minified JSON.",
      messages: [{ role: "user", content }],
    });

    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      data: parseAnalysis(text),
      usage: {
        provider: "anthropic",
        model,
        units: res.usage.input_tokens + res.usage.output_tokens,
        unitType: "tokens",
        costUsd: cost(model, res.usage.input_tokens, res.usage.output_tokens),
      },
    };
  },

  async write(input: LLMWriteInput): Promise<Metered<{ text: string }>> {
    const model = input.model ?? defaultLLM().id;
    const res = await client().messages.create({
      model,
      max_tokens: input.maxTokens ?? 800,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      data: { text },
      usage: {
        provider: "anthropic",
        model,
        units: res.usage.input_tokens + res.usage.output_tokens,
        unitType: "tokens",
        costUsd: cost(model, res.usage.input_tokens, res.usage.output_tokens),
      },
    };
  },

  async moderate() {
    // Provider-side moderation is applied by the image/video vendors; treat text
    // as allowed here. Tightened in Phase 6.
    return true;
  },
};
