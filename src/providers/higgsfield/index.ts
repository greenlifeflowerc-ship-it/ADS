import "server-only";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  callTool,
  checkFailed,
  extractMediaUrl,
  extractUuid,
  generateAndWait,
  importMedia,
} from "@/lib/higgsfield/client";
import { HIGGSFIELD_DEFAULT, higgsfieldModel } from "./models";
import type { ImageProvider, TTSProvider, UsageRecord, VideoProvider } from "@/providers/types";

function usage(model: string, units = 1): UsageRecord {
  return { provider: "higgsfield", model, units, unitType: "credits", costUsd: 0 };
}

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function dec(s: string): { jobId?: string | null; url?: string | null; seconds?: number; model?: string } {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString());
  } catch {
    return {};
  }
}

/**
 * Build image/video/tts providers backed by a connected Higgsfield MCP client.
 * Provider outputs are URLs → the engine re-uploads them to storage as usual.
 */
export function createHiggsfieldProviders(client: Client): {
  image: ImageProvider;
  video: VideoProvider;
  tts: TTSProvider;
} {
  const image: ImageProvider = {
    id: "higgsfield-image",
    async generate(input) {
      const model = higgsfieldModel("image", input.model);
      const medias: { value: string; role: string }[] = [];
      for (const ref of (input.referenceImages ?? []).slice(0, 6)) {
        const mid = await importMedia(client, ref);
        if (mid) medias.push({ value: mid, role: "image" });
      }
      const prompt = input.overlayText
        ? `${input.prompt}\nOn-image text: "${input.overlayText}"`
        : input.prompt;
      const { url } = await generateAndWait(client, "generate_image", {
        params: { model, prompt, aspect_ratio: input.aspectRatio, count: 1, ...(medias.length ? { medias } : {}) },
      });
      return { data: { url }, usage: usage(model) };
    },
  };

  const video: VideoProvider = {
    id: "higgsfield-video",
    async submit(input) {
      const model = higgsfieldModel("video", input.model);
      const medias: { value: string; role: string }[] = [];
      if (input.initImage) {
        const mid = await importMedia(client, input.initImage);
        if (mid) medias.push({ value: mid, role: "start_image" });
      }
      const res = await callTool(client, "generate_video", {
        params: {
          model,
          prompt: input.prompt,
          aspect_ratio: input.aspectRatio,
          duration: input.seconds,
          count: 1,
          ...(medias.length ? { medias } : {}),
        },
      });
      const f = checkFailed(res);
      if (f.failed) throw new Error(`Higgsfield generate_video failed: ${f.reason}`);
      return {
        externalId: enc({ jobId: extractUuid(res), url: extractMediaUrl(res), seconds: input.seconds, model }),
      };
    },
    async poll(externalId) {
      const { jobId, url, seconds, model } = dec(externalId);
      if (url) return { done: true, url, seconds, usage: usage(model ?? "video") };
      if (!jobId) return { done: true, error: "Higgsfield: no job id" };
      const jr = await callTool(client, "job_display", { id: jobId });
      const jf = checkFailed(jr);
      if (jf.failed) return { done: true, error: jf.reason };
      const u = extractMediaUrl(jr);
      if (u) return { done: true, url: u, seconds, usage: usage(model ?? "video") };
      return { done: false };
    },
  };

  const tts: TTSProvider = {
    id: "higgsfield-tts",
    async synthesize(input) {
      const model = HIGGSFIELD_DEFAULT.audio;
      const { url } = await generateAndWait(client, "generate_audio", {
        params: {
          model,
          prompt: input.text,
          ...(input.voiceId ? { voice_id: input.voiceId, voice_type: "preset" } : {}),
        },
      });
      return { data: { url, seconds: input.targetSeconds }, usage: usage(model, input.text.length) };
    },
    async listVoices() {
      return [];
    },
  };

  return { image, video, tts };
}
