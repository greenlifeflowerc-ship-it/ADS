import "server-only";

import { ApifyClient } from "apify-client";
import { env } from "@/lib/env";
import type { AdFormat } from "@/lib/types/domain";
import type { DiscoverInput, Metered, RawWinningAd, ScraperProvider } from "@/providers/types";

/**
 * Apify-backed ad discovery, shaped for `apify/facebook-ads-scraper`
 * (the Meta Ad Library scraper, set via APIFY_ADS_ACTOR).
 *
 * That actor requires `startUrls` (a Meta Ad Library search URL) — NOT a
 * free-text query — so we build keyword-search URLs from the brand's brain.
 * To return a balanced MIX (post + carousel + video) instead of whatever the
 * top-impression results happen to be (usually all video), we run two searches
 * — one `media_type=video`, one `media_type=image` (images = posts + carousels)
 * — then round-robin across the three formats. Output is deeply nested under
 * `snapshot` (cards/images/videos), so `mapItem` digs into that shape.
 */

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/** Meta Ad Library keyword-search URL for a given media type (+ optional language). */
function adLibrarySearchUrl(
  query: string,
  mediaType: "all" | "image" | "video",
  language?: string,
): string {
  const q = encodeURIComponent(query.slice(0, 100));
  const lang = language ? `&content_languages[0]=${encodeURIComponent(language)}` : "";
  return (
    "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL" +
    `&q=${q}&search_type=keyword_unordered&media_type=${mediaType}${lang}`
  );
}

function pickImage(o: Record<string, unknown>): string | undefined {
  return str(o.originalImageUrl) ?? str(o.resizedImageUrl) ?? str(o.watermarkedResizedImageUrl);
}
function pickVideo(o: Record<string, unknown>): string | undefined {
  return (
    str(o.videoHdUrl) ?? str(o.videoSdUrl) ?? str(o.watermarkedVideoHdUrl) ?? str(o.watermarkedVideoSdUrl)
  );
}

/**
 * @param preferImages classify as post/carousel whenever images exist (used for
 *   the image-type search) so a stray video field can't force every ad to
 *   "video". The video search passes false → video wins when present.
 */
function mapItem(item: Record<string, unknown>, preferImages: boolean): RawWinningAd | null {
  const snapshot = (item.snapshot as Record<string, unknown> | undefined) ?? {};
  const cards = (snapshot.cards as Record<string, unknown>[] | undefined) ?? [];
  const imagesArr = (snapshot.images as Record<string, unknown>[] | undefined) ?? [];
  const videosArr = (snapshot.videos as Record<string, unknown>[] | undefined) ?? [];

  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  for (const c of cards) {
    const img = pickImage(c);
    if (img) imageUrls.push(img);
    const vid = pickVideo(c);
    if (vid) videoUrls.push(vid);
  }
  for (const im of imagesArr) {
    const img = pickImage(im);
    if (img) imageUrls.push(img);
  }
  for (const v of videosArr) {
    const vid = pickVideo(v);
    if (vid) videoUrls.push(vid);
  }

  const preview =
    imageUrls[0] ??
    str((videosArr[0] as Record<string, unknown> | undefined)?.videoPreviewImageUrl) ??
    str((cards[0] as Record<string, unknown> | undefined)?.videoPreviewImageUrl);

  // Format precedence depends on which search produced this ad.
  const useImages = preferImages ? imageUrls.length > 0 : videoUrls.length === 0 && imageUrls.length > 0;

  let format: AdFormat;
  let media: RawWinningAd["media"];
  if (useImages) {
    format = imageUrls.length > 1 ? "carousel" : "post";
    media = imageUrls.map((url, i) => ({ url, kind: "image", orderIndex: i }));
  } else if (videoUrls.length) {
    format = "video";
    media = videoUrls.slice(0, 1).map((url) => ({ url, kind: "video", orderIndex: 0 }));
  } else {
    format = "post";
    media = [];
  }

  const adId = str(item.adArchiveID) ?? str(item.adArchiveId);
  const sourceUrl = adId ? `https://www.facebook.com/ads/library/?id=${adId}` : undefined;

  if (!preview && media.length === 0 && !sourceUrl) return null;

  const platforms = (item.publisherPlatform as string[] | undefined) ?? [];
  const impressions = (item.impressionsWithIndex as Record<string, unknown> | undefined)
    ?.impressionsText;

  return {
    format,
    sourcePlatform: platforms.length ? platforms.join("+") : "Meta",
    sourceUrl,
    previewUrl: preview ?? media[0]?.url,
    metrics: {
      impressions: str(impressions),
      reach: str(item.reachEstimate),
      spend: str(item.spend),
      page: str(item.pageName),
    },
    media: media.length ? media : preview ? [{ url: preview, kind: "image", orderIndex: 0 }] : [],
  };
}

/** Run one Ad Library search for a media type and return its mapped ads. */
async function runSearch(
  client: ApifyClient,
  actorId: string,
  query: string,
  mediaType: "image" | "video",
  limit: number,
  language?: string,
): Promise<{ ads: RawWinningAd[]; runId: string }> {
  const run = await client.actor(actorId).call({
    startUrls: [{ url: adLibrarySearchUrl(query, mediaType, language) }],
    resultsLimit: limit,
    activeStatus: "active",
    // Surface the highest-impression (best-performing) ads first when available.
    sorting: "total_impressions",
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit });
  const preferImages = mediaType === "image";
  const ads = items
    .map((it) => mapItem(it as Record<string, unknown>, preferImages))
    .filter((a): a is RawWinningAd => a !== null);
  return { ads, runId: run.id };
}

/** In-place Fisher–Yates shuffle so re-runs don't return the same picks. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Round-robin across the REQUESTED formats so the result set is the mix the user
 * asked for. Skips `exclude`d source URLs (already-saved ads), drops any format
 * not requested, and shuffles each bucket so consecutive discoveries differ.
 */
function balanceByFormat(
  ads: RawWinningAd[],
  target: number,
  exclude: Set<string>,
  formats: AdFormat[],
): RawWinningAd[] {
  const want = new Set(formats);
  const buckets: Record<AdFormat, RawWinningAd[]> = { video: [], carousel: [], post: [] };
  const seen = new Set<string>();
  for (const ad of ads) {
    if (!want.has(ad.format)) continue;
    if (ad.sourceUrl && exclude.has(ad.sourceUrl)) continue;
    const key = ad.sourceUrl ?? ad.previewUrl ?? JSON.stringify(ad.media);
    if (seen.has(key)) continue;
    seen.add(key);
    buckets[ad.format].push(ad);
  }
  // Preserve the caller's format order (video → carousel → post by default).
  const order = (["video", "carousel", "post"] as AdFormat[]).filter((f) => want.has(f));
  for (const f of order) shuffle(buckets[f]);

  const out: RawWinningAd[] = [];
  let progressed = true;
  while (out.length < target && progressed) {
    progressed = false;
    for (const f of order) {
      if (out.length >= target) break;
      const next = buckets[f].shift();
      if (next) {
        out.push(next);
        progressed = true;
      }
    }
  }
  return out;
}

export const apifyScraper: ScraperProvider = {
  id: "apify",

  async discover(input: DiscoverInput): Promise<Metered<RawWinningAd[]>> {
    const actorId = env.APIFY_ADS_ACTOR;
    if (!env.APIFY_TOKEN || !actorId) {
      throw new Error("Apify not configured. Set APIFY_TOKEN and APIFY_ADS_ACTOR.");
    }

    const target = input.limit ?? 20;
    const formats = input.formats?.length ? input.formats : (["video", "carousel", "post"] as AdFormat[]);
    // posts + carousels come from the IMAGE search; videos from the VIDEO search.
    const wantImages = formats.includes("post") || formats.includes("carousel");
    const wantVideo = formats.includes("video");

    // Rotate across up to 2 distinct competitor angles this run (varies the topic
    // without spawning too many parallel actor runs → stays inside the job lease).
    const angles = shuffle([...(input.queries?.length ? input.queries : [input.query])]).slice(0, 2);
    const exclude = new Set(input.excludeUrls ?? []);

    // Size each search so the requested formats can fill the target.
    const perAngle = Math.ceil(target / angles.length);
    const both = wantImages && wantVideo;
    const imgLimit = Math.max(6, both ? Math.ceil(perAngle * 0.6) + 2 : perAngle + 2);
    const vidLimit = Math.max(5, both ? Math.ceil(perAngle * 0.5) + 2 : perAngle + 2);

    const client = new ApifyClient({ token: env.APIFY_TOKEN });
    const searches = angles.flatMap((q) => [
      ...(wantImages ? [runSearch(client, actorId, q, "image", imgLimit, input.language)] : []),
      ...(wantVideo ? [runSearch(client, actorId, q, "video", vidLimit, input.language)] : []),
    ]);
    const settled = await Promise.all(searches);

    const pool = settled.flatMap((r) => r.ads);
    const ads = balanceByFormat(pool, target, exclude, formats);

    return {
      data: ads,
      usage: {
        provider: "apify",
        model: actorId,
        units: ads.length || 1,
        unitType: "run",
        // Pay-per-event (~$0.0058/ad on the free tier); refine if you need exact cost.
        costUsd: 0,
        requestKey: `apify:${settled.map((r) => r.runId).join(":")}`,
      },
    };
  },
};
