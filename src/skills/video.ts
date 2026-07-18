import type { GenerationContext, VideoParams } from "@/lib/types/domain";
import type { PromptLogEntry, VideoClipSpec, VideoRenderSpec } from "@/lib/types/render-spec";
import { REALISM_DIRECTIVE, brandGrounding } from "./grounding";
import { MARKETING_DIRECTIVE, getAdStyle, peopleDirective, resolvePeople } from "./styles";
import { targetFrom, type Skill } from "./types";

const DEFAULT_BEATS = ["Hook", "Reveal", "Benefit", "Call to action"];

/**
 * Compose a spoken voiceover script sized to the total length (~2.3 wps). When a
 * person is on screen it reads as first-person testimony; otherwise as narration.
 */
function buildVoiceScript(
  ctx: GenerationContext<VideoParams>,
  totalSeconds: number,
  withPerson: boolean,
): string {
  const budget = Math.max(8, Math.round(totalSeconds * 2.3));
  const a = ctx.winningAd.analysis;
  const closer = withPerson ? "Honestly, try it — you'll feel the difference." : "Get yours today.";
  const opener = a.hook?.trim() || `Meet ${ctx.product.name}.`;
  const body = a.message?.trim() || ctx.product.description?.trim() || `Made to deliver real results.`;
  const parts = [opener, body, `${ctx.product.name}.`, closer].filter(Boolean);
  return parts.join(" ").split(/\s+/).slice(0, budget).join(" ");
}

export const videoSkill: Skill<VideoParams> = (ctx): VideoRenderSpec => {
  const a = ctx.winningAd.analysis;
  const clips = Math.max(1, ctx.params.clips);
  const clipSeconds = ctx.params.clipSeconds;
  const beats = a.scriptBeats?.length ? a.scriptBeats : a.structure.length ? a.structure : DEFAULT_BEATS;
  const grounding = brandGrounding(ctx);
  const style = getAdStyle(ctx.params.adStyle);
  const people = resolvePeople(ctx.params.people, style);
  const sceneHint = ctx.params.sceneHint?.trim();

  const continuity =
    people === "with"
      ? "Keep the SAME single person (same face, wardrobe), same setting and lighting across every shot."
      : "Keep the same setting, product, palette and lighting consistent across every shot.";

  const clipSpecs: VideoClipSpec[] = Array.from({ length: clips }).map((_, i) => {
    const beat = beats[Math.min(i, beats.length - 1)];
    const prompt = [
      `Shot ${i + 1} of ${clips} (${clipSeconds}s) — beat: "${beat}" — one shot of a cohesive ad video for "${ctx.product.name}".`,
      `CREATIVE STYLE — ${style.label}: ${style.directive}`,
      `VIDEO DIRECTION: ${style.videoDirective}`,
      peopleDirective(people),
      continuity,
      sceneHint ? `EXTRA DIRECTION: ${sceneHint}` : "",
      `Adapt the winning ad's structure and pacing. Visual style: ${a.visualStyle || "cinematic, dynamic, branded"}.`,
      "",
      grounding,
      "",
      MARKETING_DIRECTIVE,
      "",
      REALISM_DIRECTIVE,
      "- Natural, physically-plausible motion and camera movement; realistic human movement and micro-expressions; no morphing or flicker.",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      index: i,
      prompt,
      seconds: clipSeconds,
      aspectRatio: ctx.params.aspectRatio,
      initImage: ctx.product.images[0],
    };
  });

  const totalSeconds = clips * clipSeconds;

  const audio: NonNullable<VideoRenderSpec["audio"]> = {};
  if (ctx.params.voiceover?.enabled) {
    audio.voiceover = {
      voiceoverScript: buildVoiceScript(ctx, totalSeconds, people === "with"),
      voiceId: ctx.params.voiceover.voiceId,
      language: ctx.params.voiceover.language,
      ttsModelId: ctx.params.voiceover.ttsModelId,
    };
  }
  if (ctx.params.music?.enabled) {
    audio.music = { musicRef: ctx.params.music.ref, gainDb: -18 };
  }

  const promptLog: PromptLogEntry[] = [
    { label: `Style · ${style.label} · people: ${people}`, prompt: `${style.directive}\n${style.videoDirective}` },
    ...clipSpecs.map((c) => ({ label: `Clip ${c.index + 1}`, prompt: c.prompt })),
  ];
  if (audio.voiceover) {
    promptLog.push({ label: "Voiceover script", prompt: audio.voiceover.voiceoverScript });
  }

  return {
    type: "video",
    target: targetFrom(ctx),
    clips: clipSpecs,
    audio: Object.keys(audio).length ? audio : undefined,
    merge: {
      order: clipSpecs.map((c) => c.index),
      transitions: clipSpecs.slice(0, -1).map((c) => ({
        after: c.index,
        type: "crossfade" as const,
        durationMs: 300,
      })),
      totalSeconds,
    },
    promptLog,
  };
};
