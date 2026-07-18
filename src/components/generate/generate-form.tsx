"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Loader2, Sparkles, Video, Image as ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { AdFormat, AspectRatio, PeopleMode, QualityTier } from "@/lib/types/domain";
import { ASPECT_RATIOS, QUALITY_TIERS } from "@/lib/types/domain";
import { AD_STYLES, DEFAULT_AD_STYLE } from "@/skills/styles";
import {
  defaultModel,
  estimateCost,
  findModel,
  modelsFor,
} from "@/providers/registry";
import { enqueueGenerationAction } from "@/server/actions/generate";
import type { GenerateInput } from "@/lib/validate";
import { ChipGroup } from "@/components/common/chip-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatUsd4 } from "@/lib/format";

export type ProductLite = { id: string; name: string; images: { id: string; url: string }[] };
export type AdLite = { id: string; format: AdFormat; preview: string | null };

const TYPE_OPTIONS: { value: AdFormat; label: React.ReactNode }[] = [
  { value: "post", label: <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Post</span> },
  { value: "carousel", label: <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" /> Carousel</span> },
  { value: "video", label: <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Video</span> },
];

export function GenerateForm({
  profileId,
  products,
  ads,
  preselectedAdId,
}: {
  profileId: string;
  products: ProductLite[];
  ads: AdLite[];
  preselectedAdId: string | null;
}) {
  const router = useRouter();

  const [winningAdId, setWinningAdId] = useState<string | null>(
    preselectedAdId ?? ads[0]?.id ?? null,
  );
  const firstImage = products.find((p) => p.images.length)?.images[0]?.id;
  const [productImageIds, setProductImageIds] = useState<string[]>(firstImage ? [firstImage] : []);
  const [type, setType] = useState<AdFormat>("post");
  const [modelId, setModelId] = useState(defaultModel("post").id);
  const [quality, setQuality] = useState<QualityTier>("1K");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");

  const [slideCount, setSlideCount] = useState(5);
  const [clips, setClips] = useState(4);
  const [clipSeconds, setClipSeconds] = useState(5);
  const [voiceover, setVoiceover] = useState(true);
  const [voiceLang, setVoiceLang] = useState("");
  const [music, setMusic] = useState(false);

  // Creative controls (shared across all types).
  const [adStyle, setAdStyle] = useState<string>(DEFAULT_AD_STYLE);
  const [people, setPeople] = useState<PeopleMode>("auto");
  const [sceneHint, setSceneHint] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const models = modelsFor(type);
  const model = findModel(modelId) ?? defaultModel(type);
  const aspectOptions = model.capabilities.aspectRatios.length
    ? model.capabilities.aspectRatios
    : ASPECT_RATIOS;

  const units = type === "post" ? 1 : type === "carousel" ? slideCount : clips * clipSeconds;
  const estCost = useMemo(() => estimateCost(model, quality, units), [model, quality, units]);

  function changeType(t: AdFormat) {
    setType(t);
    const m = defaultModel(t);
    setModelId(m.id);
    if (!m.capabilities.aspectRatios.includes(aspectRatio) && m.capabilities.aspectRatios.length) {
      setAspectRatio(m.capabilities.aspectRatios[0]);
    }
  }
  function changeModel(id: string) {
    setModelId(id);
    const m = findModel(id);
    if (m && !m.capabilities.aspectRatios.includes(aspectRatio) && m.capabilities.aspectRatios.length) {
      setAspectRatio(m.capabilities.aspectRatios[0]);
    }
  }

  function toggleImage(id: string) {
    setProductImageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev,
    );
  }

  // A winning-ad reference is OPTIONAL — you can generate a fresh ad without one.
  const canSubmit = productImageIds.length > 0 && !submitting;

  async function submit() {
    setSubmitting(true);
    const creative = { adStyle, people, sceneHint: sceneHint.trim() || undefined };
    const typeParams =
      type === "post"
        ? { ...creative }
        : type === "carousel"
          ? { slideCount, ...creative }
          : {
              clips,
              clipSeconds,
              voiceover: { enabled: voiceover, language: voiceLang || undefined },
              music: { enabled: music },
              ...creative,
            };
    const input: GenerateInput = {
      profileId,
      winningAdId,
      type,
      productImageIds,
      modelId,
      quality,
      aspectRatio,
      typeParams,
    };
    try {
      const { generationId } = await enqueueGenerationAction(input);
      router.push(`/generate/${generationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start generation");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Winning ad (optional reference) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Winning ad reference (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Adapt a proven ad, or pick <span className="font-medium text-foreground">No reference</span> to
              generate a fresh ad from your brand + product only.
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* No-reference option — always available. */}
              <button
                type="button"
                onClick={() => setWinningAdId(null)}
                className={cn(
                  "flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 bg-muted text-center",
                  winningAdId === null ? "border-primary" : "border-transparent",
                )}
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <span className="px-1 text-[11px] font-medium leading-tight">No reference</span>
              </button>

              {ads.map((ad) => (
                <button
                  key={ad.id}
                  type="button"
                  onClick={() => setWinningAdId(ad.id)}
                  className={cn(
                    "relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-muted",
                    winningAdId === ad.id ? "border-primary" : "border-transparent",
                  )}
                >
                  {ad.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.preview} alt="Ad" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {ad.format}
                    </span>
                  )}
                  <Badge className="absolute left-1 top-1 h-4 px-1 text-[10px]" variant="secondary">
                    {ad.format}
                  </Badge>
                </button>
              ))}
            </div>
            {ads.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No winning ads yet —{" "}
                <a href="/winning-ads" className="font-medium text-foreground underline-offset-4 hover:underline">
                  find some
                </a>{" "}
                to adapt, or just generate without one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Product images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Product image(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No product images.{" "}
                <a href={`/profiles/${profileId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                  Add a product
                </a>
                .
              </p>
            ) : (
              products.map((p) => (
                <div key={p.id}>
                  <p className="mb-2 text-sm font-medium">{p.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.images.map((img) => {
                      const selected = productImageIds.includes(img.id);
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => toggleImage(img.id)}
                          className={cn(
                            "relative h-20 w-20 overflow-hidden rounded-lg border-2",
                            selected ? "border-primary" : "border-transparent",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                          {selected && (
                            <span className="absolute inset-0 ring-2 ring-inset ring-primary" />
                          )}
                        </button>
                      );
                    })}
                    {p.images.length === 0 && (
                      <span className="text-xs text-muted-foreground">No images</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Creative direction: ad style + people + scene */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Creative direction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Ad style">
              <div className="flex flex-wrap gap-2">
                {AD_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.description}
                    onClick={() => setAdStyle(s.id)}
                    className={cn(
                      "max-w-[190px] rounded-lg border px-3 py-2 text-left transition-colors",
                      adStyle === s.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30",
                    )}
                  >
                    <span className="block text-xs font-medium">{s.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                      {s.description}
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex flex-wrap gap-6">
              <Field label="People in the ad">
                <ChipGroup
                  value={people}
                  onChange={(v) => setPeople(v as PeopleMode)}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "with", label: "With person" },
                    { value: "without", label: "Without" },
                  ]}
                />
              </Field>
            </div>

            <Field label="Scene / direction (optional)">
              <Input
                value={sceneHint}
                onChange={(e) => setSceneHint(e.target.value)}
                placeholder="e.g. sunrise kitchen, athlete after a workout, marble table…"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Type + model + params */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Type">
              <ChipGroup value={type} onChange={changeType} options={TYPE_OPTIONS} />
            </Field>

            <Field label="Model">
              <ChipGroup
                value={modelId}
                onChange={changeModel}
                options={models.map((m) => ({
                  value: m.id,
                  label: (
                    <span className="inline-flex items-center gap-1">
                      {m.label}
                      {m.badges?.[0] && <span className="text-[10px] opacity-70">· {m.badges[0]}</span>}
                    </span>
                  ),
                }))}
              />
            </Field>

            <div className="flex flex-wrap gap-6">
              <Field label="Quality">
                <ChipGroup
                  value={quality}
                  onChange={(v) => setQuality(v as QualityTier)}
                  options={QUALITY_TIERS.map((q) => ({ value: q, label: q }))}
                />
              </Field>
              <Field label="Aspect ratio">
                <ChipGroup
                  value={aspectRatio}
                  onChange={(v) => setAspectRatio(v as AspectRatio)}
                  options={ASPECT_RATIOS.map((r) => ({
                    value: r,
                    label: r,
                    disabled: !aspectOptions.includes(r),
                  }))}
                />
              </Field>
            </div>

            {type === "carousel" && (
              <Field label={`Slides: ${slideCount}`}>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full max-w-xs"
                />
              </Field>
            )}

            {type === "video" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <Field label={`Clips: ${clips}`}>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={clips}
                      onChange={(e) => setClips(Number(e.target.value))}
                      className="w-40"
                    />
                  </Field>
                  <Field label="Seconds / clip">
                    <ChipGroup
                      value={String(clipSeconds)}
                      onChange={(v) => setClipSeconds(Number(v))}
                      options={[4, 5, 6, 8].map((s) => ({ value: String(s), label: `${s}s` }))}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={voiceover} onCheckedChange={setVoiceover} id="vo" />
                  <Label htmlFor="vo">Spoken voiceover (ElevenLabs)</Label>
                  {voiceover && (
                    <Input
                      value={voiceLang}
                      onChange={(e) => setVoiceLang(e.target.value)}
                      placeholder="Language (optional)"
                      className="h-8 w-44"
                    />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={music} onCheckedChange={setMusic} id="music" />
                  <Label htmlFor="music">Background music</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total length ≈ {clips * clipSeconds}s
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary / submit */}
      <div>
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Type" value={type} />
            <Row label="Style" value={AD_STYLES.find((s) => s.id === adStyle)?.label ?? adStyle} />
            <Row label="People" value={people} />
            <Row label="Model" value={model.label} />
            <Row label="Quality" value={quality} />
            <Row label="Aspect" value={aspectRatio} />
            <Row label="Images" value={`${productImageIds.length} selected`} />
            {type === "carousel" && <Row label="Slides" value={String(slideCount)} />}
            {type === "video" && <Row label="Length" value={`${clips * clipSeconds}s`} />}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">Est. cost</span>
              <span className="font-medium">{formatUsd4(estCost)}</span>
            </div>
            <Button className="w-full" onClick={submit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate
                </>
              )}
            </Button>
            {productImageIds.length === 0 && (
              <p className="text-xs text-muted-foreground">Select at least one product image.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
