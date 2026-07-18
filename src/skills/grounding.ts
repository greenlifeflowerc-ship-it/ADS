import type { GenerationContext } from "@/lib/types/domain";

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Fixed photorealism rules appended to EVERY image/video prompt so generations
 * look like real photography, not a plastic 3D/AI render. Emphasizes the things
 * that break realism most: skin, hands, gaze, environment, and lighting.
 */
export const REALISM_DIRECTIVE = [
  "REALISM RULES (mandatory):",
  "- Render as a REAL photograph shot on a professional full-frame camera — never an illustration, cartoon, 3D/CGI, or obvious AI render.",
  "- Natural, physically-accurate lighting and soft real shadows; true-to-life color; realistic materials, textures, and reflections.",
  "- Any person must look like a real human: natural skin texture with pores (no waxy/plastic skin), correct anatomy, exactly five fingers per hand, a genuine facial expression, and a natural, believable gaze looking where it makes sense.",
  "- A coherent, real-world environment with correct perspective, scale, and depth; believable props and background.",
  "- Sharp, in-focus subject with natural depth of field; crisp editorial quality, high detail, 8k.",
  "- Avoid: distortion, warped/garbled text or logos, extra limbs/fingers, oversaturation, uncanny faces, floating objects.",
].join("\n");

/**
 * Shared grounding block woven into every prompt so no generation is generic —
 * it always reflects the brand brain, identity, product, and the winning ad's
 * analyzed hook/message/style (spec §6.5 acceptance).
 */
export function brandGrounding(ctx: GenerationContext): string {
  const colors = ctx.identity.colors.map((c) => `${c.name} (${c.hex})`).join(", ");
  const fonts = ctx.identity.fonts.map((f) => f.name).filter(Boolean).join(", ");
  const a = ctx.winningAd.analysis;

  return [
    ctx.brainMd.trim() && `BRAND BRAIN:\n${truncate(ctx.brainMd.trim(), 1200)}`,
    colors && `BRAND COLORS: ${colors}`,
    fonts && `FONTS: ${fonts}`,
    `PRODUCT: ${ctx.product.name}${ctx.product.description ? ` — ${ctx.product.description}` : ""}`,
    `WINNING AD HOOK: ${a.hook}`,
    a.message && `WINNING AD MESSAGE: ${a.message}`,
    a.visualStyle && `WINNING AD VISUAL STYLE: ${a.visualStyle}`,
    a.copyAngles?.length ? `ANGLES: ${a.copyAngles.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
