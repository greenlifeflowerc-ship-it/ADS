import "server-only";

import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HiggsfieldStatus = {
  connected: boolean;
  /** How the connection was made — drives the Settings UI. */
  method: "oauth" | "manual" | null;
  /** Only meaningful for the manual/static-token connection. */
  url: string | null;
};

export async function getMyHiggsfieldStatus(): Promise<HiggsfieldStatus> {
  if (!features.supabase) return { connected: false, method: null, url: null };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("higgsfield_mcp_url,higgsfield_mcp_token,higgsfield_oauth")
    .maybeSingle();

  const row = data as {
    higgsfield_mcp_url?: string | null;
    higgsfield_mcp_token?: string | null;
    higgsfield_oauth?: { tokens?: { access_token?: string } } | null;
  } | null;

  if (row?.higgsfield_oauth?.tokens?.access_token) {
    return { connected: true, method: "oauth", url: null };
  }

  const url = row?.higgsfield_mcp_url ?? null;
  const token = row?.higgsfield_mcp_token ?? null;
  if (url && token) return { connected: true, method: "manual", url };

  return { connected: false, method: null, url: null };
}
