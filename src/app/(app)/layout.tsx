import { redirect } from "next/navigation";
import { features } from "@/lib/env";
import { DEMO, DEMO_USER } from "@/lib/demo";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveProfileId, getProfiles } from "@/server/queries/profiles";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!features.supabase && !DEMO) redirect("/login");

  const user = DEMO ? DEMO_USER : await getCurrentUser();
  if (!user) redirect("/login");

  const [profiles, activeProfileId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  const resolvedActive = activeProfileId ?? profiles[0]?.id ?? null;

  return (
    <AppShell
      user={{ email: user.email ?? "" }}
      profiles={profiles.map((p) => ({ id: p.id, name: p.name, niche: p.niche }))}
      activeProfileId={resolvedActive}
    >
      {children}
    </AppShell>
  );
}
