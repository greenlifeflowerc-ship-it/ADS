import type { PostParams } from "@/lib/types/domain";
import type { PostRenderSpec } from "@/lib/types/render-spec";
import { REALISM_DIRECTIVE, brandGrounding } from "./grounding";
import { MARKETING_DIRECTIVE, getAdStyle, peopleDirective, resolvePeople } from "./styles";
import { targetFrom, type Skill } from "./types";

export const postSkill: Skill<PostParams> = (ctx): PostRenderSpec => {
  const a = ctx.winningAd.analysis;
  const style = getAdStyle(ctx.params.adStyle);
  const people = resolvePeople(ctx.params.people, style);
  const sceneHint = ctx.params.sceneHint?.trim();
  const hook = a.hook?.trim();

  const prompt = [
    `Create ONE scroll-stopping ${ctx.params.aspectRatio} social ad image for "${ctx.product.name}".`,
    hook
      ? `Depict a real, believable SCENE that conveys this hook — NOT a plain product-on-blank-background shot: "${hook}".`
      : `Depict a real, believable SCENE that makes "${ctx.product.name}" desirable and stops the scroll — NOT a plain product-on-blank-background shot.`,
    `CREATIVE STYLE — ${style.label}: ${style.directive}`,
    peopleDirective(people),
    sceneHint ? `EXTRA DIRECTION: ${sceneHint}` : "",
    `Place the product naturally inside the scene (held, on a surface, or in use) — recognizable and on-brand, integrated into the moment, never floating on an empty backdrop.`,
    `Visual style: ${a.visualStyle || "clean, high-contrast, punchy"}.`,
    `The attached reference image shows ONLY the product's real look (label, jar, colors) — match the product's appearance, but build a NEW scene around it; do not copy the reference's framing or background.`,
    "",
    brandGrounding(ctx),
    "",
    MARKETING_DIRECTIVE,
    "",
    REALISM_DIRECTIVE,
  ]
    .filter(Boolean)
    .join("\n");

  const caption = [
    hook || ctx.product.name,
    "",
    `${ctx.product.name}${ctx.product.description ? `: ${ctx.product.description}` : ""}`,
  ].join("\n");

  return {
    type: "post",
    target: targetFrom(ctx),
    image: {
      prompt,
      aspectRatio: ctx.params.aspectRatio,
      overlayText: hook || undefined,
      // Use ALL the product images the user selected (the provider caps the count),
      // so multiple angles/variants of the product inform one generation.
      referenceImages: ctx.product.images,
    },
    caption,
    promptLog: [
      { label: `Style · ${style.label} · people: ${people}`, prompt: style.directive },
      { label: "Image prompt", prompt },
      { label: "Caption", prompt: caption },
    ],
  };
};
