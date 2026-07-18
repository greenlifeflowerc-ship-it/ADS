import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO, DEMO_WINNING_ADS } from "@/lib/demo";
import type { WinningAdMediaRow, WinningAdRow } from "@/lib/types/db";

export type WinningAdWithMedia = WinningAdRow & { media: WinningAdMediaRow[] };

function withSortedMedia(
  rows: Array<WinningAdRow & { winning_ad_media: WinningAdMediaRow[] }>,
): WinningAdWithMedia[] {
  return rows.map((a) => ({
    ...a,
    media: [...(a.winning_ad_media ?? [])].sort((x, y) => x.order_index - y.order_index),
  }));
}

export async function getWinningAds(profileId: string): Promise<WinningAdWithMedia[]> {
  if (DEMO) return DEMO_WINNING_ADS;
  if (!features.supabase || !profileId) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("winning_ads")
    .select("*, winning_ad_media(*)")
    .eq("profile_id", profileId)
    .order("fetched_at", { ascending: false });
  return withSortedMedia(
    (data ?? []) as Array<WinningAdRow & { winning_ad_media: WinningAdMediaRow[] }>,
  );
}

export async function getWinningAdById(id: string): Promise<WinningAdWithMedia | null> {
  if (!features.supabase || !id) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("winning_ads")
    .select("*, winning_ad_media(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return withSortedMedia([data as WinningAdRow & { winning_ad_media: WinningAdMediaRow[] }])[0];
}
