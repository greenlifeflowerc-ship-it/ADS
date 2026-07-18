import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import type { MediaKind, StoredMedia, UploadSource } from "@/lib/storage/types";

/**
 * Upload a provider output (URL or bytes) to storage and upsert its
 * generation_assets row. Deterministic publicId + unique
 * (generation_id, kind, order_index) make retries overwrite, not duplicate.
 */
export async function upsertAsset(opts: {
  userId: string;
  generationId: string;
  kind: string; // 'image' | 'slide' | 'clip' | 'audio' | 'final'
  orderIndex: number;
  source: UploadSource;
  publicIdBase: string;
  resourceType?: MediaKind;
  meta?: Record<string, unknown>;
}): Promise<StoredMedia> {
  const stored = await storage.upload({
    source: opts.source,
    folder: `users/${opts.userId}/generations/${opts.generationId}`,
    publicId: opts.publicIdBase,
    resourceType: opts.resourceType ?? "image",
    overwrite: true,
    // Generated assets are shown in the app (<img>/<video>) and downloaded by the
    // user, so they must be publicly readable. Private Cloudinary URLs 401 without
    // a signature → the asset "generates" but never renders.
    access: "public",
  });

  const supabase = createSupabaseAdminClient();
  await supabase.from("generation_assets").upsert(
    {
      generation_id: opts.generationId,
      user_id: opts.userId,
      url: stored.url,
      public_id: stored.publicId,
      kind: opts.kind,
      order_index: opts.orderIndex,
      meta: opts.meta ?? {},
    },
    { onConflict: "generation_id,kind,order_index" },
  );

  return stored;
}
