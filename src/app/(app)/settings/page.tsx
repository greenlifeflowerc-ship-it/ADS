import { env, features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/server/queries/usage";
import { getMyHiggsfieldStatus } from "@/server/queries/higgsfield";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView, type ProviderStatus } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const [usage, higgsfield] = await Promise.all([getUsageSummary(), getMyHiggsfieldStatus()]);

  let counts = { profiles: 0, generations: 0 };
  if (features.supabase) {
    const supabase = await createSupabaseServerClient();
    const [{ count: p }, { count: g }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("generations").select("id", { count: "exact", head: true }),
    ]);
    counts = { profiles: p ?? 0, generations: g ?? 0 };
  }

  // Image + video generation run through the Higgsfield MCP (its own card below).
  const providers: ProviderStatus[] = [
    { key: "anthropic", label: "Claude — analysis & prompts", configured: features.anthropic, env: "ANTHROPIC_API_KEY" },
    { key: "gemini", label: "Gemini — analysis fallback", configured: features.gemini, env: "GEMINI_API_KEY" },
    { key: "elevenlabs", label: "ElevenLabs — voice", configured: features.elevenlabs, env: "ELEVENLABS_API_KEY" },
    { key: "apify", label: "Apify — ad discovery", configured: features.apify, env: "APIFY_TOKEN + APIFY_ADS_ACTOR" },
    { key: "cloudinary", label: "Cloudinary — media storage", configured: features.cloudinary, env: "CLOUDINARY_*" },
  ];

  return (
    <>
      <PageHeader title="Settings" description="API keys, usage & cost, and backend health." />
      <div className="p-6">
        <SettingsView
          usage={usage}
          providers={providers}
          budget={env.BUDGET_MONTHLY_USD ?? null}
          storageDriver={env.STORAGE_DRIVER}
          supabase={features.supabase}
          counts={counts}
          higgsfield={higgsfield}
        />
      </div>
    </>
  );
}
