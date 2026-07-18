"use client";

import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useGeneration, type GenerationDto } from "@/lib/query/use-generation";
import type { PromptLogEntry } from "@/lib/types/render-spec";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, titleCase } from "@/lib/format";

export function GenerationView({ id, initial }: { id: string; initial: GenerationDto }) {
  const { data } = useGeneration(id, initial);
  const dto = data ?? initial;
  const { generation, assets, job } = dto;

  const finalAsset = assets.find((a) => a.kind === "final");
  const slides = assets.filter((a) => a.kind === "slide");
  const promptLog = (generation.prompt_log ?? []) as PromptLogEntry[];
  const caption = (finalAsset?.meta?.caption as string | undefined) ?? undefined;
  const progress = job?.progress ?? (generation.status === "succeeded" ? 100 : 0);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/generate" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              {titleCase(generation.type)} generation
              <StatusBadge status={generation.status} />
            </h1>
            <p className="text-xs text-muted-foreground">Cost {formatCurrency(generation.cost_usd)}</p>
          </div>
        </div>
        {finalAsset && (
          <Button variant="outline" render={<a href={finalAsset.url} target="_blank" rel="noopener noreferrer" download />}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        )}
      </div>

      <div className="space-y-6 p-6">
        {(generation.status === "queued" || generation.status === "running") && (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">{job?.progress_message ?? "Working…"}</p>
              <div className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {generation.status === "failed" && (
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{generation.error ?? "Unknown error"}</AlertDescription>
          </Alert>
        )}

        {generation.status === "succeeded" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {generation.type === "post" && finalAsset && (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalAsset.url} alt="Generated post" className="w-full rounded-lg border" />
                  {caption && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Caption</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm">{caption}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {generation.type === "carousel" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {slides.map((s) => (
                    <div key={s.id} className="overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt={`Slide ${s.order_index + 1}`} className="w-full" />
                    </div>
                  ))}
                </div>
              )}

              {generation.type === "video" && finalAsset && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={finalAsset.url} controls className="w-full rounded-lg border bg-black" />
              )}
            </div>

            {promptLog.length > 0 && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-sm">Prompts used</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {promptLog.map((p, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs">{p.prompt}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
