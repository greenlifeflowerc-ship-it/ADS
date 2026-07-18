import { notFound } from "next/navigation";
import { getGenerationDetail } from "@/server/queries/generations";
import { GenerationView } from "@/components/generate/generation-view";

export default async function GenerationDetailPage({
  params,
}: {
  params: Promise<{ generationId: string }>;
}) {
  const { generationId } = await params;
  const detail = await getGenerationDetail(generationId);
  if (!detail) notFound();

  const { assets, ...generation } = detail;
  return (
    <GenerationView id={generationId} initial={{ generation, assets, job: null }} />
  );
}
