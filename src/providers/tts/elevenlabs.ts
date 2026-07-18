import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/lib/env";
import { defaultTTS, findModel } from "@/providers/registry";
import type { Metered, MediaOut, TTSInput, TTSProvider, TTSVoice } from "@/providers/types";

const MODEL_MAP: Record<string, string> = {
  "elevenlabs-multilingual-v2": "eleven_multilingual_v2",
  "elevenlabs-turbo-v2-5": "eleven_turbo_v2_5",
};

// A widely-available default voice; override with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

function client() {
  return new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
}

async function toBuffer(audio: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof Uint8Array) return Buffer.from(audio);
  const maybe = audio as {
    getReader?: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> };
    arrayBuffer?: () => Promise<ArrayBuffer>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
  };
  if (maybe?.arrayBuffer) return Buffer.from(await maybe.arrayBuffer());
  const chunks: Buffer[] = [];
  if (maybe?.getReader) {
    const reader = maybe.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  if (maybe?.[Symbol.asyncIterator]) {
    for await (const chunk of maybe as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new Error("Unrecognized ElevenLabs audio response");
}

export const elevenLabsTTS: TTSProvider = {
  id: "elevenlabs",

  async synthesize(input: TTSInput): Promise<Metered<MediaOut & { seconds?: number }>> {
    const registryId = input.model ?? defaultTTS().id;
    const modelId = MODEL_MAP[registryId] ?? "eleven_multilingual_v2";
    const voiceId = input.voiceId || env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;

    const audio = await client().textToSpeech.convert(voiceId, {
      text: input.text,
      modelId,
    });
    const bytes = await toBuffer(audio);

    const model = findModel(registryId);
    const costUsd = model ? (input.text.length / 1000) * model.cost.usdPerUnit : 0;

    return {
      data: {
        bytes,
        mimeType: "audio/mpeg",
        seconds: input.targetSeconds ?? Math.max(2, Math.round(input.text.length / 15)),
      },
      usage: {
        provider: "elevenlabs",
        model: modelId,
        units: input.text.length,
        unitType: "characters",
        costUsd,
      },
    };
  },

  async listVoices(): Promise<TTSVoice[]> {
    try {
      const res = (await client().voices.getAll()) as {
        voices?: Array<{ voiceId?: string; voice_id?: string; name?: string; labels?: Record<string, string> }>;
      };
      return (res.voices ?? []).map((v) => ({
        voiceId: v.voiceId ?? v.voice_id ?? "",
        name: v.name ?? "Voice",
        language: v.labels?.language,
      }));
    } catch {
      return [];
    }
  },
};
