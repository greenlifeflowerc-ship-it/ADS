import type {
  GenerationAssetRow,
  GenerationRow,
  IdentityImageRow,
  ProductImageRow,
  ProductRow,
  ProfileIdentityRow,
  ProfileRow,
} from "@/lib/types/db";
import type { ProfileListItem, ProfileReadiness, ProductWithImages, ProfileDetail } from "@/server/queries/profiles";
import type { RecentGeneration } from "@/server/queries/generations";
import type { RunningJob } from "@/server/queries/jobs";
import type { WinningAdWithMedia } from "@/server/queries/winning-ads";
import type { GenerationDetail } from "@/server/queries/generations";

/**
 * Demo mode: renders the app with sample data so the UI can be previewed WITHOUT
 * Supabase or any provider keys. Read-only (mutations still need a real backend).
 * Enable with DEMO_MODE=1. Off by default.
 */
export const DEMO = process.env.DEMO_MODE === "1";

export const DEMO_USER = { id: "demo-user", email: "demo@adsmaker.app" };

const img = (seed: string, w = 600, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const SAMPLE_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const DEMO_PROFILES: ProfileListItem[] = [
  { id: "demo-acme", name: "Acme Coffee Co.", niche: "specialty coffee for home baristas", updated_at: "2026-07-17T10:00:00Z" },
  { id: "demo-verde", name: "Verde Skincare", niche: "clean, plant-based skincare", updated_at: "2026-07-14T10:00:00Z" },
];

export const DEMO_ACTIVE_ID = "demo-acme";

export function demoProfileRow(id: string): ProfileRow {
  const p = DEMO_PROFILES.find((x) => x.id === id) ?? DEMO_PROFILES[0];
  return {
    id: p.id,
    user_id: DEMO_USER.id,
    name: p.name,
    brain_md: `# ${p.name}\n\nWe make ${p.niche}. Warm, confident, a little playful.\n\n## Audience\nHome enthusiasts who care about quality and ritual.\n\n## Key messages\n- Café-grade at home\n- Effortless and consistent\n- Loved by thousands`,
    niche: p.niche,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: p.updated_at,
  };
}

export const DEMO_READINESS: ProfileReadiness = {
  hasBrain: true,
  hasColor: true,
  hasProductWithImage: true,
  ready: true,
  productCount: 3,
};

export const DEMO_RECENT: RecentGeneration[] = [
  { id: "demo-gen-1", type: "post", status: "succeeded", cost_usd: 0.04, created_at: "2026-07-18T08:10:00Z", thumb_url: img("adpost") },
  { id: "demo-gen-2", type: "carousel", status: "succeeded", cost_usd: 0.2, created_at: "2026-07-17T15:40:00Z", thumb_url: img("adcarousel") },
  { id: "demo-gen-3", type: "video", status: "running", cost_usd: 0.48, created_at: "2026-07-18T09:05:00Z", thumb_url: img("advideo") },
  { id: "demo-gen-4", type: "post", status: "failed", cost_usd: 0, created_at: "2026-07-16T12:00:00Z", thumb_url: null },
];

export const DEMO_JOBS: RunningJob[] = [
  { id: "demo-job-1", type: "generate_content", status: "running", progress: 65, progress_message: "Clip 3/4…", created_at: "2026-07-18T09:05:00Z", generation_id: "demo-gen-3" },
  { id: "demo-job-2", type: "discover_winning_ads", status: "queued", progress: 0, progress_message: "Queued", created_at: "2026-07-18T09:06:00Z", generation_id: null },
];

function productImages(product: string, n: number): ProductImageRow[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: `demo-pi-${product}-${i}`,
    product_id: `demo-prod-${product}`,
    user_id: DEMO_USER.id,
    url: img(`${product}${i}`, 400, 400),
    public_id: null,
    is_primary: i === 0,
    created_at: "2026-06-02T10:00:00Z",
  }));
}

export const DEMO_PRODUCTS: ProductWithImages[] = [
  {
    id: "demo-prod-espresso",
    profile_id: DEMO_ACTIVE_ID,
    user_id: DEMO_USER.id,
    name: "Single-Origin Espresso",
    description: "Rich, chocolatey, small-batch roast.",
    price: 18,
    created_at: "2026-06-02T10:00:00Z",
    images: productImages("espresso", 3),
  },
  {
    id: "demo-prod-grinder",
    profile_id: DEMO_ACTIVE_ID,
    user_id: DEMO_USER.id,
    name: "Precision Grinder",
    description: "Consistent grind, whisper-quiet.",
    price: 129,
    created_at: "2026-06-03T10:00:00Z",
    images: productImages("grinder", 2),
  },
  {
    id: "demo-prod-mug",
    profile_id: DEMO_ACTIVE_ID,
    user_id: DEMO_USER.id,
    name: "Ceramic Mug",
    description: "Hand-glazed, holds 12oz.",
    price: 24,
    created_at: "2026-06-04T10:00:00Z",
    images: productImages("mug", 1),
  },
];

const DEMO_IDENTITY: ProfileIdentityRow = {
  profile_id: DEMO_ACTIVE_ID,
  user_id: DEMO_USER.id,
  logo_url: null,
  logo_public_id: null,
  colors: [
    { name: "Espresso", hex: "#3b2417" },
    { name: "Cream", hex: "#f4ecdf" },
    { name: "Copper", hex: "#b06b3a" },
  ],
  fonts: [{ name: "Fraunces" }, { name: "Inter" }],
  updated_at: "2026-06-05T10:00:00Z",
};

const DEMO_IDENTITY_IMAGES: IdentityImageRow[] = [
  { id: "demo-ii-1", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, url: img("mood1", 400, 400), public_id: null, note: "Mood", created_at: "2026-06-05T10:00:00Z" },
  { id: "demo-ii-2", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, url: img("mood2", 400, 400), public_id: null, note: "Texture", created_at: "2026-06-05T10:00:00Z" },
];

export function demoProfileDetail(id: string): ProfileDetail {
  return {
    profile: demoProfileRow(id),
    identity: DEMO_IDENTITY,
    identityImages: DEMO_IDENTITY_IMAGES,
    products: DEMO_PRODUCTS,
  };
}

export const DEMO_WINNING_ADS: WinningAdWithMedia[] = [
  {
    id: "demo-ad-1", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, format: "video",
    source_platform: "TikTok", source_url: "https://example.com/ad/1", preview_url: img("wa1", 720, 1280),
    preview_public_id: null, metrics: { relevance: 0.94, likes: 82000 }, apify_run_id: null, analysis: null,
    fetched_at: "2026-07-18T08:00:00Z",
    media: [{ id: "demo-adm-1", winning_ad_id: "demo-ad-1", user_id: DEMO_USER.id, url: SAMPLE_VIDEO, public_id: null, kind: "video", order_index: 0 }],
  },
  {
    id: "demo-ad-2", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, format: "post",
    source_platform: "Meta Ad Library", source_url: "https://example.com/ad/2", preview_url: img("wa2"),
    preview_public_id: null, metrics: { relevance: 0.89, likes: 41000 }, apify_run_id: null, analysis: null,
    fetched_at: "2026-07-18T08:00:00Z",
    media: [{ id: "demo-adm-2", winning_ad_id: "demo-ad-2", user_id: DEMO_USER.id, url: img("wa2"), public_id: null, kind: "image", order_index: 0 }],
  },
  {
    id: "demo-ad-3", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, format: "carousel",
    source_platform: "Instagram", source_url: "https://example.com/ad/3", preview_url: img("wa3"),
    preview_public_id: null, metrics: { relevance: 0.86 }, apify_run_id: null, analysis: null,
    fetched_at: "2026-07-18T08:00:00Z",
    media: [0, 1, 2, 3].map((i) => ({ id: `demo-adm-3-${i}`, winning_ad_id: "demo-ad-3", user_id: DEMO_USER.id, url: img(`wa3-${i}`), public_id: null, kind: "image", order_index: i })),
  },
  {
    id: "demo-ad-4", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, format: "post",
    source_platform: "Meta Ad Library", source_url: "https://example.com/ad/4", preview_url: img("wa4"),
    preview_public_id: null, metrics: { relevance: 0.81 }, apify_run_id: null, analysis: null,
    fetched_at: "2026-07-18T08:00:00Z",
    media: [{ id: "demo-adm-4", winning_ad_id: "demo-ad-4", user_id: DEMO_USER.id, url: img("wa4"), public_id: null, kind: "image", order_index: 0 }],
  },
  {
    id: "demo-ad-5", profile_id: DEMO_ACTIVE_ID, user_id: DEMO_USER.id, format: "video",
    source_platform: "TikTok", source_url: "https://example.com/ad/5", preview_url: img("wa5", 720, 1280),
    preview_public_id: null, metrics: { relevance: 0.78 }, apify_run_id: null, analysis: null,
    fetched_at: "2026-07-18T08:00:00Z",
    media: [{ id: "demo-adm-5", winning_ad_id: "demo-ad-5", user_id: DEMO_USER.id, url: SAMPLE_VIDEO, public_id: null, kind: "video", order_index: 0 }],
  },
];

export function demoGenerationDetail(id: string): GenerationDetail {
  const found = DEMO_RECENT.find((g) => g.id === id) ?? DEMO_RECENT[0];
  const base: GenerationRow = {
    id: found.id,
    user_id: DEMO_USER.id,
    profile_id: DEMO_ACTIVE_ID,
    winning_ad_id: "demo-ad-1",
    type: found.type,
    status: found.status,
    params: { modelId: "gemini-nano-banana-2", providerId: "gemini", quality: "2K", aspectRatio: "4:5" },
    product_image_ids: ["demo-pi-espresso-0"],
    prompt_log: [
      { label: "Image prompt", prompt: "Design ONE scroll-stopping 4:5 ad image for Single-Origin Espresso, adapting the winning ad's hook and energy…" },
      { label: "Caption", prompt: "Café-grade espresso, at home. ☕ Single-Origin Espresso — rich, chocolatey, small-batch." },
    ],
    error: found.status === "failed" ? "Image provider timed out" : null,
    cost_usd: found.cost_usd,
    created_at: found.created_at,
    updated_at: found.created_at,
  };
  const assets: GenerationAssetRow[] =
    found.status === "succeeded" && found.thumb_url
      ? found.type === "carousel"
        ? [0, 1, 2].map((i) => ({ id: `demo-a-${id}-${i}`, generation_id: id, user_id: DEMO_USER.id, url: img(`adcarousel${i}`), public_id: null, kind: "slide", order_index: i, meta: {}, created_at: found.created_at }))
        : [{ id: `demo-a-${id}`, generation_id: id, user_id: DEMO_USER.id, url: found.thumb_url, public_id: null, kind: "final", order_index: 0, meta: { caption: "Café-grade espresso, at home. ☕" }, created_at: found.created_at }]
      : [];
  return { ...base, assets };
}
