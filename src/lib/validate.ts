import { z } from "zod";

/** Input limits (spec §9). */
export const LIMITS = {
  brainMaxChars: 20000,
  productImagesPerGeneration: 6,
  carousel: { minSlides: 3, maxSlides: 10 },
  video: { minClips: 1, maxClips: 8, clipSecondsOptions: [4, 5, 6, 8] as number[], maxTotalSeconds: 64 },
} as const;

export const aspectSchema = z.enum(["1:1", "4:5", "9:16", "16:9"]);
export const qualitySchema = z.enum(["1K", "2K", "4K"]);

/** Shared creative controls, optional on every generation type. */
const creativeShape = {
  adStyle: z.string().max(40).optional(),
  people: z.enum(["auto", "with", "without"]).optional(),
  sceneHint: z.string().max(400).optional(),
};

export const PostParamsSchema = z.object({ aspectRatio: aspectSchema, ...creativeShape });

export const CarouselParamsSchema = z.object({
  slideCount: z.number().int().min(LIMITS.carousel.minSlides).max(LIMITS.carousel.maxSlides),
  aspectRatio: aspectSchema,
  ...creativeShape,
});

export const VideoParamsSchema = z.object({
  clips: z.number().int().min(LIMITS.video.minClips).max(LIMITS.video.maxClips),
  clipSeconds: z.number().int().min(2).max(15),
  aspectRatio: aspectSchema,
  voiceover: z.object({
    enabled: z.boolean(),
    voiceId: z.string().optional(),
    language: z.string().optional(),
    ttsModelId: z.string().optional(),
  }),
  music: z.object({ enabled: z.boolean(), ref: z.string().optional() }).optional(),
  ...creativeShape,
});

export const GenerateInputSchema = z.object({
  profileId: z.string().uuid(),
  winningAdId: z.string().uuid().nullable(),
  type: z.enum(["video", "post", "carousel"]),
  productImageIds: z.array(z.string().uuid()).min(1).max(LIMITS.productImagesPerGeneration),
  modelId: z.string().min(1),
  quality: qualitySchema,
  aspectRatio: aspectSchema,
  typeParams: z.record(z.string(), z.unknown()),
});

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
