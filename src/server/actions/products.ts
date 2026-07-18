"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { assertImageFile, uploadFile } from "@/lib/storage/persist";
import { storage } from "@/lib/storage";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

const ProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().nonnegative().nullish(),
});

export async function createProductAction(input: {
  profileId: string;
  name: string;
  description?: string;
  price?: number | null;
}): Promise<string> {
  await requireUser();
  const parsed = ProductSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      profile_id: input.profileId,
      name: parsed.name,
      description: parsed.description || null,
      price: parsed.price ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
  return data!.id as string;
}

export async function updateProductAction(input: {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  price?: number | null;
}) {
  await requireUser();
  const parsed = ProductSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      description: parsed.description || null,
      price: parsed.price ?? null,
    })
    .eq("id", input.id);
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function deleteProductAction(input: { id: string; profileId: string }) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").delete().eq("id", input.id);
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function addProductImageAction(formData: FormData) {
  await requireUser();
  const productId = String(formData.get("productId"));
  const profileId = String(formData.get("profileId"));
  const file = formData.get("file") as File | null;
  assertImageFile(file);
  const stored = await uploadFile(file, `products/${productId}`);
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const isPrimary = (count ?? 0) === 0;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    url: stored.url,
    public_id: stored.publicId,
    is_primary: isPrimary,
  });
  if (error) throw error;
  revalidatePath(`/profiles/${profileId}`);
}

export async function setPrimaryImageAction(input: {
  imageId: string;
  productId: string;
  profileId: string;
}) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", input.productId);
  const { error } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", input.imageId);
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function removeProductImageAction(input: {
  id: string;
  productId: string;
  profileId: string;
  publicId: string | null;
}) {
  await requireUser();
  if (input.publicId) {
    try {
      await storage.delete(input.publicId, "image");
    } catch {
      /* best effort */
    }
  }
  const supabase = await createSupabaseServerClient();
  await supabase.from("product_images").delete().eq("id", input.id);

  // Keep one primary image if any remain.
  const { data: remaining } = await supabase
    .from("product_images")
    .select("id,is_primary")
    .eq("product_id", input.productId)
    .order("created_at", { ascending: true });
  if (remaining?.length && !remaining.some((r) => (r as { is_primary: boolean }).is_primary)) {
    await supabase.from("product_images").update({ is_primary: true }).eq("id", remaining[0].id);
  }
  revalidatePath(`/profiles/${input.profileId}`);
}
