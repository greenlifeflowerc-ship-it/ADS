import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { completeOAuth } from "@/lib/higgsfield/oauth";

/**
 * Higgsfield OAuth redirect target. The user lands here after signing in; we
 * exchange the authorization code for tokens, persist them, and bounce back to
 * Settings with a status flag. Runs on the signed-in user's cookies.
 */
export async function GET(req: NextRequest) {
  const settings = new URL("/settings", env.APP_URL);
  const params = req.nextUrl.searchParams;

  const err = params.get("error");
  if (err) {
    settings.searchParams.set("higgsfield", "error");
    settings.searchParams.set("reason", params.get("error_description") || err);
    return NextResponse.redirect(settings);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    settings.searchParams.set("higgsfield", "error");
    settings.searchParams.set("reason", "Missing code or state");
    return NextResponse.redirect(settings);
  }

  const user = await getCurrentUser();
  if (!user) {
    // Session lost mid-flow → send to login, then back to settings.
    return NextResponse.redirect(new URL("/login?redirect=/settings", env.APP_URL));
  }

  try {
    await completeOAuth(user.id, code, state);
    settings.searchParams.set("higgsfield", "connected");
  } catch (e) {
    settings.searchParams.set("higgsfield", "error");
    settings.searchParams.set("reason", e instanceof Error ? e.message : "Authorization failed");
  }
  return NextResponse.redirect(settings);
}
