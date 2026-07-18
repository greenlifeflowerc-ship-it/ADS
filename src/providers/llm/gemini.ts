import "server-only";

import { GoogleGenAI, type Part } from "@google/genai";
import { env } from "@/lib/env";
import type { AdAnalysis } from "@/lib/types/domain";
import type { LLMAnalyzeInput, LLMProvider, LLMWriteInput, Metered } from "@/providers/types";
import { IMG_RE, analyzeInstruction, parseAnalysis } from "./shared";

// Our registry id → Gemini API model. Override with GEMINI_LLM_MODEL.
const MODEL_MAP: Record<string, string> = {
  "gemini-2.5-flash": "gemini-2.5-flash",
};

function apiModel(registryId?: string): string {
  return env.GEMINI_LLM_MODEL || MODEL_MAP[registryId ?? ""] || "gemini-2.5-flash";
}

// Approximate USD per 1K tokens {input, output}. Refine against live pricing.
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.0003, out: 0.0025 },
};

function cost(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? PRICING["gemini-2.5-flash"];
  return (inTok / 1000) * p.in + (outTok / 1000) * p.out;
}

async function urlToInlinePart(url: string): Promise<Part | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { inlineData: { mimeType, data } };
}

const SYSTEM = "You are an expert direct-response ad analyst. Output strictly valid minified JSON.";

/** Gemini as analysis/writing LLM — same interface as anthropicLLM. */
export const geminiLLM: LLMProvider = {
  id: "gemini",

  async analyzeAd(input: LLMAnalyzeInput): Promise<Metered<AdAnalysis>> {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const model = apiModel(input.model);

    const images = input.mediaUrls.filter((u) => IMG_RE.test(u)).slice(0, 6);
    const imageParts = (await Promise.all(images.map(urlToInlinePart))).filter(
      (p): p is Part => p !== null,
    );

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [...imageParts, { text: analyzeInstruction(input) }] }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        maxOutputTokens: 1200,
      },
    });

    const inTok = response.usageMetadata?.promptTokenCount ?? 0;
    const outTok = response.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      data: parseAnalysis(response.text ?? ""),
      usage: {
        provider: "gemini",
        model,
        units: inTok + outTok,
        unitType: "tokens",
        costUsd: cost(model, inTok, outTok),
      },
    };
  },

  async write(input: LLMWriteInput): Promise<Metered<{ text: string }>> {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const model = apiModel(input.model);

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      config: {
        ...(input.system ? { systemInstruction: input.system } : {}),
        ...(input.json ? { responseMimeType: "application/json" } : {}),
        maxOutputTokens: input.maxTokens ?? 800,
      },
    });

    const inTok = response.usageMetadata?.promptTokenCount ?? 0;
    const outTok = response.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      data: { text: response.text ?? "" },
      usage: {
        provider: "gemini",
        model,
        units: inTok + outTok,
        unitType: "tokens",
        costUsd: cost(model, inTok, outTok),
      },
    };
  },

  async moderate() {
    // Provider-side moderation is applied by the image/video vendors; treat text
    // as allowed here. Tightened in Phase 6.
    return true;
  },
};
