import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, features } from "@/lib/env";

/**
 * Service-role client — bypasses RLS. Used ONLY by the engine/worker to write
 * jobs, generations, assets, and the api_usage ledger. Never import into client
 * code or route handlers that echo data back unfiltered.
 */
export function createSupabaseAdminClient() {
  if (!features.supabase || !features.supabaseAdmin) {
    throw new Error(
      "Supabase admin client not configured (need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
