import { User } from "lucide-react";
import { getActiveProfileId, getProfiles } from "@/server/queries/profiles";
import { getWinningAds } from "@/server/queries/winning-ads";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CreateProfileButton } from "@/components/profiles/create-profile-button";
import { WinningAdsView } from "@/components/winning-ads/winning-ads-view";

export default async function WinningAdsPage() {
  const [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  const resolvedId = activeId ?? profiles[0]?.id ?? null;

  if (!resolvedId) {
    return (
      <>
        <PageHeader title="Winning Ads" description="Proven ads for your niche." />
        <div className="p-6">
          <EmptyState
            icon={User}
            title="No active profile"
            description="Create or select a brand profile before discovering ads."
            action={<CreateProfileButton label="Create profile" />}
          />
        </div>
      </>
    );
  }

  const ads = await getWinningAds(resolvedId);
  return <WinningAdsView profileId={resolvedId} ads={ads} />;
}
