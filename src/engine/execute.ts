import "server-only";

import { resolveImage, resolveTTS, resolveVideo } from "@/providers/resolve";
import type { ImageProvider, MediaOut, TTSProvider, VideoProvider } from "@/providers/types";
import type { UploadSource } from "@/lib/storage/types";
import { meter, recordUsage } from "./meter";
import { upsertAsset } from "./persist";
import { mergeClips } from "./merge";
import type { RenderSpec } from "@/lib/types/render-spec";
import type { Job, JobsQueue } from "@/lib/jobs/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toSource(out: MediaOut): UploadSource {
  if (out.url) return { remoteUrl: out.url };
  if (out.bytes) return { bytes: out.bytes };
  throw new Error("Provider returned no media (no url or bytes)");
}

/** Optional provider override (e.g. Higgsfield MCP) — falls back to resolve(). */
export type ProviderOverride = {
  image?: ImageProvider;
  video?: VideoProvider;
  tts?: TTSProvider;
};

type ExecCtx = { userId: string; generationId: string; job: Job; queue: JobsQueue };

/** Execute a RenderSpec: the ONLY place providers + storage + usage meet (spec §7). */
export async function executeRenderSpec(
  spec: RenderSpec,
  ctx: ExecCtx,
  override?: ProviderOverride,
): Promise<void> {
  const { userId, generationId, job, queue } = ctx;

  if (spec.type === "post") {
    await queue.heartbeat(job.id, 55, "Generating image…");
    const image = override?.image ?? resolveImage(spec.target.providerId);
    const out = await meter(
      userId,
      generationId,
      image.generate({
        model: spec.target.modelId,
        prompt: spec.image.prompt,
        aspectRatio: spec.image.aspectRatio,
        quality: spec.target.quality,
        referenceImages: spec.image.referenceImages,
        overlayText: spec.image.overlayText,
      }),
      job.id,
    );
    await upsertAsset({
      userId,
      generationId,
      kind: "final",
      orderIndex: 0,
      source: toSource(out),
      publicIdBase: "post",
      resourceType: "image",
      meta: { caption: spec.caption },
    });
    return;
  }

  if (spec.type === "carousel") {
    const image = override?.image ?? resolveImage(spec.target.providerId);
    for (let i = 0; i < spec.slides.length; i++) {
      const s = spec.slides[i];
      await queue.heartbeat(
        job.id,
        Math.round((i / spec.slides.length) * 80) + 10,
        `Slide ${i + 1}/${spec.slides.length}…`,
      );
      const out = await meter(
        userId,
        generationId,
        image.generate({
          model: spec.target.modelId,
          prompt: s.prompt,
          aspectRatio: s.aspectRatio,
          quality: spec.target.quality,
          referenceImages: s.referenceImages,
          overlayText: s.overlayText,
        }),
        job.id,
      );
      await upsertAsset({
        userId,
        generationId,
        kind: "slide",
        orderIndex: i,
        source: toSource(out),
        publicIdBase: `slide-${i}`,
        resourceType: "image",
      });
    }
    return;
  }

  // video
  const video = override?.video ?? resolveVideo(spec.target.providerId);
  const clipUrls: { url: string; seconds: number }[] = [];

  for (let i = 0; i < spec.clips.length; i++) {
    const c = spec.clips[i];
    await queue.heartbeat(
      job.id,
      Math.round((i / spec.clips.length) * 60) + 10,
      `Clip ${i + 1}/${spec.clips.length}…`,
    );
    const { externalId } = await video.submit({
      model: spec.target.modelId,
      prompt: c.prompt,
      seconds: c.seconds,
      aspectRatio: c.aspectRatio,
      quality: spec.target.quality,
      initImage: c.initImage,
    });

    // In-invocation polling — fine for the local worker and the stub. Phase 6
    // converts this to checkpointed cross-tick polling for Vercel's time limit.
    let out: MediaOut | undefined;
    let seconds = c.seconds;
    for (let attempt = 0; attempt < 90; attempt++) {
      const p = await video.poll(externalId);
      if (p.done) {
        if (p.error) throw new Error(`Clip ${i + 1} failed: ${p.error}`);
        out = { url: p.url, bytes: p.bytes };
        seconds = p.seconds ?? c.seconds;
        if (p.usage) await recordUsage(userId, generationId, p.usage, job.id);
        break;
      }
      await sleep(2000);
    }
    if (!out) throw new Error(`Clip ${i + 1} did not complete in time`);

    // Persist the clip → its storage URL becomes the merge input.
    const stored = await upsertAsset({
      userId,
      generationId,
      kind: "clip",
      orderIndex: i,
      source: toSource(out),
      publicIdBase: `clip-${i}`,
      resourceType: "video",
    });
    clipUrls.push({ url: stored.url, seconds });
  }

  let voiceoverUrl: string | undefined;
  if (spec.audio?.voiceover?.voiceoverScript) {
    await queue.heartbeat(job.id, 75, "Synthesizing voiceover…");
    const tts = override?.tts ?? resolveTTS();
    const vo = await meter(
      userId,
      generationId,
      tts.synthesize({
        text: spec.audio.voiceover.voiceoverScript,
        voiceId: spec.audio.voiceover.voiceId,
        language: spec.audio.voiceover.language,
        model: spec.audio.voiceover.ttsModelId,
        targetSeconds: spec.merge.totalSeconds,
      }),
      job.id,
    );
    const voStored = await upsertAsset({
      userId,
      generationId,
      kind: "audio",
      orderIndex: 0,
      source: toSource(vo),
      publicIdBase: "voiceover",
      resourceType: "video",
    });
    voiceoverUrl = voStored.url;
  }

  await queue.heartbeat(job.id, 92, "Merging final video…");
  const merged = await mergeClips({
    clips: clipUrls,
    voiceoverUrl,
    aspectRatio: spec.clips[0]?.aspectRatio ?? "9:16",
  });
  await upsertAsset({
    userId,
    generationId,
    kind: "final",
    orderIndex: 0,
    source: toSource(merged),
    publicIdBase: "final",
    resourceType: "video",
  });
}
