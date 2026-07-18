"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { connectHiggsfield } from "@/lib/higgsfield/client";
import { beginOAuth, clearOAuthConnection } from "@/lib/higgsfield/oauth";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Start the Higgsfield OAuth flow (same as Claude: DCR + PKCE sign-in).
 * Returns the authorization URL; the client redirects the browser to it.
 */
export async function startHiggsfieldOAuthAction(): Promise<{ url: string }> {
  const user = await requireUser();
  const url = await beginOAuth(user.id);
  return { url };
}

const ConfigSchema = z.object({ url: z.string().url(), token: z.string().min(1) });

export async function saveHiggsfieldConfigAction(input: { url: string; token: string }) {
  const user = await requireUser();
  const { url, token } = ConfigSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, higgsfield_mcp_url: url, higgsfield_mcp_token: token },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  revalidatePath("/settings");
}

export async function disconnectHiggsfieldAction() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, higgsfield_mcp_url: null, higgsfield_mcp_token: null },
      { onConflict: "user_id" },
    );
  await clearOAuthConnection(user.id);
  revalidatePath("/settings");
}

export async function testHiggsfieldConnectionAction(input: {
  url: string;
  token: string;
}): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
  await requireUser();
  const parsed = ConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid URL and token" };
  try {
    const client = await connectHiggsfield(parsed.data);
    const tools = await client.listTools();
    await client.close().catch(() => {});
    return { ok: true, toolCount: tools.tools?.length ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}
