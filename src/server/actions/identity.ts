"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { assertImageFile, uploadFile } from "@/lib/storage/persist";
import { storage } from "@/lib/storage";
import type { ColorSwatch, FontRef } from "@/lib/types/domain";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

const ColorSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(40),
      hex: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/),
    }),
  )
  .max(24);

const FontSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(60),
      url: z.string().url().optional(),
      family: z.string().optional(),
    }),
  )
  .max(12);

export async function updateIdentityColorsAction(input: { profileId: string; colors: ColorSwatch[] }) {
  await requireUser();
  const colors = ColorSchema.parse(input.colors).map((c) => ({
    ...c,
    hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}`,
  }));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profile_identity")
    .upsert({ profile_id: input.profileId, colors }, { onConflict: "profile_id" });
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function updateIdentityFontsAction(input: { profileId: string; fonts: FontRef[] }) {
  await requireUser();
  const fonts = FontSchema.parse(input.fonts);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profile_identity")
    .upsert({ profile_id: input.profileId, fonts }, { onConflict: "profile_id" });
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function setLogoAction(formData: FormData) {
  await requireUser();
  const profileId = String(formData.get("profileId"));
  const file = formData.get("file") as File | null;
  assertImageFile(file);
  const stored = await uploadFile(file, `identity/${profileId}`, "logo");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profile_identity")
    .upsert(
      { profile_id: profileId, logo_url: stored.url, logo_public_id: stored.publicId },
      { onConflict: "profile_id" },
    );
  if (error) throw error;
  revalidatePath(`/profiles/${profileId}`);
}

export async function removeLogoAction(input: { profileId: string; publicId: string | null }) {
  await requireUser();
  if (input.publicId) {
    try {
      await storage.delete(input.publicId, "image");
    } catch {
      /* best effort */
    }
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("profile_identity")
    .upsert(
      { profile_id: input.profileId, logo_url: null, logo_public_id: null },
      { onConflict: "profile_id" },
    );
  revalidatePath(`/profiles/${input.profileId}`);
}

export async function addIdentityImageAction(formData: FormData) {
  await requireUser();
  const profileId = String(formData.get("profileId"));
  const note = (formData.get("note") as string | null)?.trim() || null;
  const file = formData.get("file") as File | null;
  assertImageFile(file);
  const stored = await uploadFile(file, `identity/${profileId}/refs`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("identity_images")
    .insert({ profile_id: profileId, url: stored.url, public_id: stored.publicId, note });
  if (error) throw error;
  revalidatePath(`/profiles/${profileId}`);
}

export async function removeIdentityImageAction(input: {
  id: string;
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
  const { error } = await supabase.from("identity_images").delete().eq("id", input.id);
  if (error) throw error;
  revalidatePath(`/profiles/${input.profileId}`);
}
