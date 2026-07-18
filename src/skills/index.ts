import type {
  AdFormat,
  CarouselParams,
  GenerationContext,
  PostParams,
  VideoParams,
} from "@/lib/types/domain";
import type { RenderSpec } from "@/lib/types/render-spec";
import { postSkill } from "./post";
import { carouselSkill } from "./carousel";
import { videoSkill } from "./video";

/** Dispatch to the correct skill for a generation type. */
export function skillFor(type: AdFormat): (ctx: GenerationContext) => RenderSpec {
  switch (type) {
    case "post":
      return (ctx) => postSkill(ctx as GenerationContext<PostParams>);
    case "carousel":
      return (ctx) => carouselSkill(ctx as GenerationContext<CarouselParams>);
    case "video":
      return (ctx) => videoSkill(ctx as GenerationContext<VideoParams>);
  }
}

export { postSkill, carouselSkill, videoSkill };
