import "server-only";

import { features } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "./oauth";
import type { HiggsfieldConfig } from "./client";

/**
 * Read the job owner's Higgsfield MCP connection (worker/engine, admin client).
 * Prefers the OAuth connection (auto-refreshed); falls back to a manually-pasted
 * static url/token if the user configured one that way.
 */
export async function getHiggsfieldConfig(userId: string): Promise<HiggsfieldConfig | null> {
  if (!features.supabaseAdmin) return null;

  // OAuth (same flow as Claude) — refreshes the access token when stale.
  const oauth = await getValidAccessToken(userId);
  if (oauth) return oauth;

  // Legacy manual static token fallback.
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("user_settings")
    .select("higgsfield_mcp_url,higgsfield_mcp_token")
    .eq("user_id", userId)
    .maybeSingle();
  const url = (data as { higgsfield_mcp_url?: string | null } | null)?.higgsfield_mcp_url;
  const token = (data as { higgsfield_mcp_token?: string | null } | null)?.higgsfield_mcp_token;
  if (!url || !token) return null;
  return { url, token };
}
