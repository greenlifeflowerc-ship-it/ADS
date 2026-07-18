import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env, features } from "@/lib/env";

/**
 * Server Supabase client bound to the request cookies (RLS runs as the signed-in
 * user). Throws a clear error if Supabase isn't configured yet — callers should
 * gate on `features.supabase`.
 */
export async function createSupabaseServerClient() {
  if (!features.supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookie writes are handled by middleware.
          }
        },
      },
    },
  );
}

/** Convenience: the current authenticated user, or null. */
export async function getCurrentUser() {
  if (!features.supabase) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
