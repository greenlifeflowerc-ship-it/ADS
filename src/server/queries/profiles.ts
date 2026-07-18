import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEMO,
  DEMO_ACTIVE_ID,
  DEMO_PROFILES,
  DEMO_PRODUCTS,
  DEMO_READINESS,
  demoProfileDetail,
  demoProfileRow,
} from "@/lib/demo";
import type {
  IdentityImageRow,
  ProductImageRow,
  ProductRow,
  ProfileIdentityRow,
  ProfileRow,
} from "@/lib/types/db";

export type ProfileListItem = Pick<ProfileRow, "id" | "name" | "niche" | "updated_at">;

export async function getProfiles(): Promise<ProfileListItem[]> {
  if (DEMO) return DEMO_PROFILES;
  if (!features.supabase) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,niche,updated_at")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as ProfileListItem[];
}

export async function getActiveProfileId(): Promise<string | null> {
  if (DEMO) return DEMO_ACTIVE_ID;
  if (!features.supabase) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("active_profile_id")
    .maybeSingle();
  return (data?.active_profile_id as string | null) ?? null;
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  if (DEMO) return demoProfileRow(id);
  if (!features.supabase) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export type ProductWithImages = ProductRow & { images: ProductImageRow[] };

export type ProfileDetail = {
  profile: ProfileRow;
  identity: ProfileIdentityRow | null;
  identityImages: IdentityImageRow[];
  products: ProductWithImages[];
};

export async function getProductsWithImages(profileId: string): Promise<ProductWithImages[]> {
  if (DEMO) return DEMO_PRODUCTS;
  if (!features.supabase || !profileId) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  return (
    (data ?? []) as Array<ProductRow & { product_images: ProductImageRow[] }>
  ).map((p) => ({
    ...p,
    images: [...(p.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
  }));
}

export async function getProfileDetail(id: string): Promise<ProfileDetail | null> {
  if (DEMO) return demoProfileDetail(id);
  if (!features.supabase) return null;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return null;

  const [{ data: identity }, { data: identityImages }, { data: products }] = await Promise.all([
    supabase.from("profile_identity").select("*").eq("profile_id", id).maybeSingle(),
    supabase
      .from("identity_images")
      .select("*")
      .eq("profile_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("profile_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const productsMapped: ProductWithImages[] = (
    (products ?? []) as Array<ProductRow & { product_images: ProductImageRow[] }>
  ).map((p) => ({
    ...p,
    images: [...(p.product_images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary),
    ),
  }));

  return {
    profile: profile as ProfileRow,
    identity: (identity as ProfileIdentityRow | null) ?? null,
    identityImages: (identityImages ?? []) as IdentityImageRow[],
    products: productsMapped,
  };
}

/**
 * Completeness gate for generation (spec §6.2): non-empty brain, >=1 color,
 * >=1 product with >=1 image.
 */
export type ProfileReadiness = {
  hasBrain: boolean;
  hasColor: boolean;
  hasProductWithImage: boolean;
  ready: boolean;
  productCount: number;
};

export async function getProfileReadiness(profileId: string): Promise<ProfileReadiness> {
  const empty: ProfileReadiness = {
    hasBrain: false,
    hasColor: false,
    hasProductWithImage: false,
    ready: false,
    productCount: 0,
  };
  if (DEMO) return DEMO_READINESS;
  if (!features.supabase) return empty;
  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: identity }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("brain_md").eq("id", profileId).maybeSingle(),
    supabase.from("profile_identity").select("colors").eq("profile_id", profileId).maybeSingle(),
    supabase.from("products").select("id, product_images(id)").eq("profile_id", profileId),
  ]);

  const hasBrain = !!profile?.brain_md && profile.brain_md.trim().length > 0;
  const colors = (identity?.colors as unknown[] | null) ?? [];
  const hasColor = Array.isArray(colors) && colors.length > 0;
  const productList = (products ?? []) as { id: string; product_images: { id: string }[] }[];
  const hasProductWithImage = productList.some((p) => (p.product_images?.length ?? 0) > 0);

  return {
    hasBrain,
    hasColor,
    hasProductWithImage,
    ready: hasBrain && hasColor && hasProductWithImage,
    productCount: productList.length,
  };
}
