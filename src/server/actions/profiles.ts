"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function setActiveProfileAction(profileId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, active_profile_id: profileId }, { onConflict: "user_id" });
  if (error) throw error;
  revalidatePath("/", "layout");
}

const CreateProfileSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function createProfileAction(input: { name: string }): Promise<string> {
  const user = await requireUser();
  const { name } = CreateProfileSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.from("profiles").insert({ name }).select("id").single();
  if (error) throw error;

  // Seed the identity row and make the new profile active.
  await supabase.from("profile_identity").upsert({ profile_id: data!.id }, { onConflict: "profile_id" });
  await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, active_profile_id: data!.id }, { onConflict: "user_id" });

  revalidatePath("/", "layout");
  return data!.id as string;
}

export async function deleteProfileAction(profileId: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) throw error;
  revalidatePath("/", "layout");
}

const BasicsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  niche: z.string().trim().max(160).nullish(),
});

export async function updateProfileBasicsAction(input: {
  id: string;
  name?: string;
  niche?: string | null;
}) {
  await requireUser();
  const parsed = BasicsSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.niche !== undefined) patch.niche = parsed.niche || null;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", parsed.id);
  if (error) throw error;
  revalidatePath(`/profiles/${parsed.id}`);
  revalidatePath("/", "layout");
}

export async function updateBrainAction(input: { id: string; brainMd: string }) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ brain_md: input.brainMd })
    .eq("id", input.id);
  if (error) throw error;
}
