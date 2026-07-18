import type { AdAnalysis } from "@/lib/types/domain";
import type { LLMAnalyzeInput } from "@/providers/types";

/** Vendor-agnostic pieces of the ad-analysis call, shared by every LLM provider. */

export const IMG_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

export function analyzeInstruction(input: LLMAnalyzeInput): string {
  return [
    `You are analyzing a proven, high-performing ${input.format} ad so we can adapt it to a different product.`,
    input.productName ? `Our product: ${input.productName}.` : "",
    "Study the attached ad media (and any text) and return a JSON object with EXACTLY these keys:",
    `{"hook": string, "structure": string[], "message": string, "visualStyle": string, "sequence": string[], "copyAngles": string[], "scriptBeats": string[]}`,
    "- hook: the opening pattern-interrupt / first-second grab.",
    "- structure: ordered beats of the ad.",
    "- message: the core persuasive message.",
    "- visualStyle: lighting, color, framing, pacing, on-screen text style.",
    "- sequence: for carousel/post sets, the slide-by-slide flow (else []).",
    "- copyAngles: 2-4 angles that make this ad work.",
    "- scriptBeats: for video, timed spoken beats (else []).",
    "Respond with ONLY minified JSON, no prose, no code fences.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseAnalysis(text: string): AdAnalysis {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const json = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;
    const obj = JSON.parse(json) as Partial<AdAnalysis>;
    return {
      hook: obj.hook ?? "",
      structure: obj.structure ?? [],
      message: obj.message ?? "",
      visualStyle: obj.visualStyle ?? "",
      sequence: obj.sequence ?? [],
      copyAngles: obj.copyAngles ?? [],
      scriptBeats: obj.scriptBeats ?? [],
    };
  } catch {
    return {
      hook: text.slice(0, 160),
      structure: [],
      message: "",
      visualStyle: "",
      sequence: [],
      copyAngles: [],
      scriptBeats: [],
    };
  }
}
