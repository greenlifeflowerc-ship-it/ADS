import Link from "next/link";
import { Check, LayoutDashboard, Sparkles, Trophy, User, Wand2, X } from "lucide-react";
import { getActiveProfileId, getProfileById, getProfileReadiness, getProfiles } from "@/server/queries/profiles";
import { getRecentGenerations } from "@/server/queries/generations";
import { getRunningJobs } from "@/server/queries/jobs";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { CreateProfileButton } from "@/components/profiles/create-profile-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelative, titleCase } from "@/lib/format";

export default async function DashboardPage() {
  const [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  const resolvedId = activeId ?? profiles[0]?.id ?? null;

  if (!resolvedId) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your active brand hub." />
        <div className="p-6">
          <EmptyState
            icon={User}
            title="Create your first brand profile"
            description="A profile is your company's brain, visual identity, and products. Everything downstream is grounded in it."
            action={<CreateProfileButton label="Create profile" />}
          />
        </div>
      </>
    );
  }

  const [profile, readiness, recent, jobs] = await Promise.all([
    getProfileById(resolvedId),
    getProfileReadiness(resolvedId),
    getRecentGenerations(resolvedId),
    getRunningJobs(resolvedId),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={profile?.name ? `Active brand: ${profile.name}` : "Your active brand hub."}
        actions={
          <>
            <Button variant="outline" render={<Link href="/winning-ads" />}>
              <Trophy className="mr-2 h-4 w-4" /> Find winning ads
            </Button>
            <Button render={<Link href="/generate" />}>
              <Wand2 className="mr-2 h-4 w-4" /> Generate
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active profile summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                {profile?.name ?? "Brand"}
              </CardTitle>
              <Button variant="ghost" size="sm" render={<Link href={`/profiles/${resolvedId}`} />}>
                Edit profile
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {profile?.niche ? (
                  <Badge variant="secondary">{profile.niche}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">No niche set yet</span>
                )}
                <Badge variant="outline">
                  {readiness.productCount} product{readiness.productCount === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <ReadinessRow ok={readiness.hasBrain} label="Company brain written" />
                <ReadinessRow ok={readiness.hasColor} label="At least one brand color" />
                <ReadinessRow ok={readiness.hasProductWithImage} label="A product with an image" />
              </div>

              {!readiness.ready && (
                <p className="text-sm text-muted-foreground">
                  Complete the checklist to unlock generation.{" "}
                  <Link href={`/profiles/${resolvedId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    Finish setup
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Running jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Running jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing running right now.</p>
              ) : (
                <ul className="space-y-3">
                  {jobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {job.type === "discover_winning_ads" ? "Finding winning ads" : "Generating content"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.progress_message ?? `${job.progress}%`}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent generations */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent generations</h2>
            <Button variant="ghost" size="sm" render={<Link href="/generate" />}>
              New generation
            </Button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No generations yet"
              description="Pick a winning ad and generate your first on-brand asset."
              action={
                <Button render={<Link href="/winning-ads" />}>Find winning ads</Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recent.map((g) => (
                <Link
                  key={g.id}
                  href={`/generate/${g.id}`}
                  className="group overflow-hidden rounded-lg border transition-colors hover:border-primary/50"
                >
                  <div className="aspect-square bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g.thumb_url ? (
                      <img
                        src={g.thumb_url}
                        alt={`${g.type} generation`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Sparkles className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs font-medium">{titleCase(g.type)}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2 text-xs text-muted-foreground">
                    <span>{formatRelative(g.created_at)}</span>
                    <span>{formatCurrency(g.cost_usd)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReadinessRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}
