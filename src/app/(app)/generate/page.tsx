import Link from "next/link";
import { User, Wand2 } from "lucide-react";
import {
  getActiveProfileId,
  getProductsWithImages,
  getProfileReadiness,
  getProfiles,
} from "@/server/queries/profiles";
import { getWinningAds } from "@/server/queries/winning-ads";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CreateProfileButton } from "@/components/profiles/create-profile-button";
import { GenerateForm } from "@/components/generate/generate-form";
import { Button } from "@/components/ui/button";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ ad?: string }>;
}) {
  const [{ ad }, profiles, activeId] = await Promise.all([
    searchParams,
    getProfiles(),
    getActiveProfileId(),
  ]);
  const resolvedId = activeId ?? profiles[0]?.id ?? null;

  if (!resolvedId) {
    return (
      <>
        <PageHeader title="Generate" description="Create an on-brand ad." />
        <div className="p-6">
          <EmptyState
            icon={User}
            title="No active profile"
            description="Create or select a brand profile first."
            action={<CreateProfileButton label="Create profile" />}
          />
        </div>
      </>
    );
  }

  const [readiness, products, ads] = await Promise.all([
    getProfileReadiness(resolvedId),
    getProductsWithImages(resolvedId),
    getWinningAds(resolvedId),
  ]);

  if (!readiness.ready) {
    return (
      <>
        <PageHeader title="Generate" description="Create an on-brand ad." />
        <div className="p-6">
          <EmptyState
            icon={Wand2}
            title="Finish your brand profile first"
            description="Generation needs a company brain, at least one brand color, and a product with an image."
            action={
              <Button render={<Link href={`/profiles/${resolvedId}`} />}>Complete profile</Button>
            }
          />
        </div>
      </>
    );
  }

  const productLite = products.map((p) => ({
    id: p.id,
    name: p.name,
    images: p.images.map((i) => ({ id: i.id, url: i.url })),
  }));
  const adLite = ads.map((a) => ({
    id: a.id,
    format: a.format,
    preview: a.preview_url ?? a.media[0]?.url ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Generate"
        description="Adapt a winning ad to your product — on-brand, ready to use."
      />
      <div className="p-6">
        <GenerateForm
          profileId={resolvedId}
          products={productLite}
          ads={adLite}
          preselectedAdId={ad ?? null}
        />
      </div>
    </>
  );
}
