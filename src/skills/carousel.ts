import type { CarouselParams } from "@/lib/types/domain";
import type { CarouselRenderSpec, CarouselSlideSpec } from "@/lib/types/render-spec";
import { REALISM_DIRECTIVE, brandGrounding } from "./grounding";
import { MARKETING_DIRECTIVE, getAdStyle, peopleDirective, resolvePeople } from "./styles";
import { targetFrom, type Skill } from "./types";

const DEFAULT_SEQUENCE = ["Hook", "Problem", "Solution", "Proof", "Call to action"];

export const carouselSkill: Skill<CarouselParams> = (ctx): CarouselRenderSpec => {
  const a = ctx.winningAd.analysis;
  const n = Math.max(3, Math.min(10, ctx.params.slideCount));
  const seq = a.sequence?.length ? a.sequence : DEFAULT_SEQUENCE;
  const grounding = brandGrounding(ctx);
  const style = getAdStyle(ctx.params.adStyle);
  const people = resolvePeople(ctx.params.people, style);
  const sceneHint = ctx.params.sceneHint?.trim();
  const palette = ctx.identity.colors.map((c) => c.hex).join(", ");

  // A single "visual DNA" shared by every slide so the set reads as ONE cohesive
  // story with one identity — same style, cast, setting, palette, and lighting.
  const visualDNA = [
    `SHARED VISUAL DNA (identical across ALL ${n} slides — this is ONE connected carousel, not separate images):`,
    `- Creative style: ${style.label} — ${style.directive}`,
    `- ${peopleDirective(people)}${people === "with" ? " Use the SAME single person (same face, wardrobe, age) on every slide." : ""}`,
    `- Same location/set, same camera and lens, same lighting direction and mood on every slide.`,
    palette ? `- Same exact color palette every slide: ${palette}.` : "",
    `- Same typography treatment and product presentation; consistent framing so slides feel swipeable and continuous.`,
    sceneHint ? `- Extra direction: ${sceneHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const slides: CarouselSlideSpec[] = Array.from({ length: n }).map((_, i) => {
    const beat = seq[Math.min(i, seq.length - 1)];
    const prompt = [
      `Slide ${i + 1} of ${n} — beat: "${beat}" — one panel of a cohesive carousel ad for "${ctx.product.name}".`,
      i > 0
        ? `Continue DIRECTLY from the previous slides: same person, set, palette, and lighting — only the moment/message advances.`
        : `Establish the look that every following slide must match exactly.`,
      "",
      visualDNA,
      "",
      `Visual style: ${a.visualStyle || "clean, consistent, branded"}.`,
      "",
      grounding,
      "",
      MARKETING_DIRECTIVE,
      "",
      REALISM_DIRECTIVE,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      index: i,
      prompt,
      aspectRatio: ctx.params.aspectRatio,
      overlayText: beat,
      referenceImages: ctx.product.images,
    };
  });

  return {
    type: "carousel",
    target: targetFrom(ctx),
    slides,
    caption: a.hook?.trim() || ctx.product.name,
    continuity: {
      palette: ctx.identity.colors.map((c) => c.hex),
      styleTokens: [style.label, a.visualStyle].filter(Boolean),
      productRef: ctx.product.images[0],
    },
    promptLog: [
      { label: `Style · ${style.label} · people: ${people}`, prompt: visualDNA },
      ...slides.map((s) => ({ label: `Slide ${s.index + 1}`, prompt: s.prompt })),
    ],
  };
};
