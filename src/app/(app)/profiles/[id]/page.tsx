import { notFound } from "next/navigation";
import { getProfileDetail, getProfileReadiness } from "@/server/queries/profiles";
import { ProfileEditor } from "@/components/profiles/profile-editor";

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, readiness] = await Promise.all([
    getProfileDetail(id),
    getProfileReadiness(id),
  ]);
  if (!detail) notFound();

  return <ProfileEditor detail={detail} readiness={readiness} />;
}
