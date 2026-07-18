import Link from "next/link";
import { Package, User } from "lucide-react";
import { getProfiles } from "@/server/queries/profiles";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CreateProfileButton } from "@/components/profiles/create-profile-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";

export default async function ProfilesPage() {
  const profiles = await getProfiles();

  return (
    <>
      <PageHeader
        title="Profiles"
        description="Your brand profiles — each a company brain, identity, and products."
        actions={<CreateProfileButton />}
      />
      <div className="p-6">
        {profiles.length === 0 ? (
          <EmptyState
            icon={User}
            title="No profiles yet"
            description="Create your first brand profile to get started."
            action={<CreateProfileButton label="Create profile" />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <Link key={p.id} href={`/profiles/${p.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {p.niche ? (
                      <Badge variant="secondary" className="max-w-full truncate">
                        {p.niche}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">No niche set</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Updated {formatRelative(p.updated_at)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
