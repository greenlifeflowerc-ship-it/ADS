import type { GenerationContext } from "@/lib/types/domain";
import type { RenderSpec, RenderTarget } from "@/lib/types/render-spec";

/** A skill is a pure function: context in, RenderSpec out. No I/O, no vendors. */
export type Skill<P> = (ctx: GenerationContext<P>) => RenderSpec;

export function targetFrom(ctx: GenerationContext): RenderTarget {
  return {
    modelId: ctx.selection.modelId,
    providerId: ctx.selection.providerId,
    quality: ctx.selection.quality,
  };
}
