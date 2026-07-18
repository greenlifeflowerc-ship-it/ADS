"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Images, Loader2, Sparkles, Trash2, Trophy, Video, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { AdFormat } from "@/lib/types/domain";
import type { WinningAdWithMedia } from "@/server/queries/winning-ads";
import {
  deleteWinningAdAction,
  enqueueDiscoveryAction,
  suggestDiscoveryTopicAction,
} from "@/server/actions/winning-ads";
import { useJob } from "@/lib/query/use-job";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FORMAT_META: Record<AdFormat, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  video: { label: "Video", icon: Video },
  post: { label: "Post", icon: ImageIcon },
  carousel: { label: "Carousel", icon: Images },
};

export function WinningAdsView({
  profileId,
  ads,
}: {
  profileId: string;
  ads: WinningAdWithMedia[];
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [formatFilter, setFormatFilter] = useState<AdFormat | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [preview, setPreview] = useState<WinningAdWithMedia | null>(null);

  // Which formats to SEARCH for (distinct from the display filter below).
  const [searchFormats, setSearchFormats] = useState<Set<AdFormat>>(
    () => new Set<AdFormat>(["video", "carousel", "post"]),
  );
  const [searchLanguage, setSearchLanguage] = useState<string>("all");
  const [topic, setTopic] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);

  const job = useJob(jobId, !!jobId);

  async function suggestTopic() {
    setSuggesting(true);
    try {
      const t = await suggestDiscoveryTopicAction(profileId);
      setTopic(t);
      if (!t) toast.message("No suggestion — add a brain or niche to the profile first.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not suggest a topic");
    } finally {
      setSuggesting(false);
    }
  }

  function toggleSearchFormat(f: AdFormat) {
    setSearchFormats((prev) => {
      const next = new Set(prev);
      if (next.has(f)) {
        if (next.size > 1) next.delete(f); // keep at least one selected
      } else {
        next.add(f);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!job.data) return;
    if (job.data.status === "succeeded") {
      setJobId(null);
      router.refresh();
      toast.success("Discovery complete");
    } else if (job.data.status === "failed") {
      setJobId(null);
      toast.error(job.data.error ?? "Discovery failed");
    }
  }, [job.data, router]);

  const platforms = useMemo(
    () => Array.from(new Set(ads.map((a) => a.source_platform).filter(Boolean))) as string[],
    [ads],
  );

  const filtered = ads.filter(
    (a) =>
      (formatFilter === "all" || a.format === formatFilter) &&
      (platformFilter === "all" || a.source_platform === platformFilter),
  );

  const discovering = !!jobId;

  function discover() {
    const formats = (["video", "carousel", "post"] as AdFormat[]).filter((f) => searchFormats.has(f));
    startTransition(async () => {
      try {
        const id = await enqueueDiscoveryAction(profileId, {
          formats,
          language: searchLanguage === "all" ? undefined : searchLanguage,
          topic: topic.trim() || undefined,
        });
        setJobId(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start discovery");
      }
    });
  }

  function removeAd(ad: WinningAdWithMedia) {
    if (!confirm("Remove this ad from your list?")) return;
    startTransition(async () => {
      try {
        await deleteWinningAdAction({ id: ad.id, profileId });
        if (preview?.id === ad.id) setPreview(null);
        router.refresh();
        toast.success("Ad removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove ad");
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Winning Ads"
        description="Proven ads for your niche. Preview and pick one to build from."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1">
              <span className="text-xs text-muted-foreground">Search:</span>
              {(["post", "carousel", "video"] as AdFormat[]).map((f) => {
                const M = FORMAT_META[f];
                const on = searchFormats.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={discovering}
                    onClick={() => toggleSearchFormat(f)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <M.icon className="h-3 w-3" />
                    {M.label}
                  </button>
                );
              })}
            </div>
            <Button onClick={discover} disabled={discovering}>
              {discovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {job.data?.progress_message ?? "Finding…"}
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-4 w-4" /> Find winning ads
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {/* Search controls: editable brain topic + language filter. */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="wa-topic" className="text-xs text-muted-foreground">
                Search topic — auto-built from your brand brain, edit freely
              </label>
              <Input
                id="wa-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. عسل سدر ملكي, عسل مانوكا, honey gift box"
                disabled={discovering}
              />
            </div>
            <Button variant="outline" size="sm" onClick={suggestTopic} disabled={suggesting || discovering}>
              {suggesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading brain…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Suggest from brain
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Language:</span>
            <FilterPills
              value={searchLanguage}
              onChange={setSearchLanguage}
              options={[
                { value: "all", label: "All" },
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the topic empty to auto-generate competitor angles from your brain.
          </p>
        </div>

        {ads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              value={formatFilter}
              onChange={(v) => setFormatFilter(v as AdFormat | "all")}
              options={[
                { value: "all", label: "All" },
                { value: "video", label: "Video" },
                { value: "post", label: "Post" },
                { value: "carousel", label: "Carousel" },
              ]}
            />
            {platforms.length > 1 && (
              <FilterPills
                value={platformFilter}
                onChange={setPlatformFilter}
                options={[{ value: "all", label: "All platforms" }, ...platforms.map((p) => ({ value: p, label: p }))]}
              />
            )}
          </div>
        )}

        {ads.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={discovering ? "Discovering winning ads…" : "No winning ads yet"}
            description={
              discovering
                ? "This runs in the background — results will appear here."
                : "Run discovery to pull proven ads for this brand's niche."
            }
            action={
              !discovering && (
                <Button onClick={discover}>
                  <Trophy className="mr-2 h-4 w-4" /> Find winning ads
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onPreview={() => setPreview(ad)}
                onUse={() => router.push(`/generate?ad=${ad.id}`)}
                onDelete={() => removeAd(ad)}
              />
            ))}
          </div>
        )}
      </div>

      <PreviewDialog ad={preview} onOpenChange={(o) => !o && setPreview(null)} onUse={(id) => router.push(`/generate?ad=${id}`)} />
    </>
  );
}

function FilterPills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AdCard({
  ad,
  onPreview,
  onUse,
  onDelete,
}: {
  ad: WinningAdWithMedia;
  onPreview: () => void;
  onUse: () => void;
  onDelete: () => void;
}) {
  const meta = FORMAT_META[ad.format];
  const Icon = meta.icon;
  const thumb = ad.preview_url ?? ad.media[0]?.url ?? null;

  return (
    <Card className="group overflow-hidden p-0">
      <button type="button" className="relative block aspect-square w-full bg-muted" onClick={onPreview}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="Ad preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <Badge className="absolute left-2 top-2 gap-1" variant="secondary">
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove ad"
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      </button>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{ad.source_platform ?? "Unknown"}</span>
          {typeof ad.metrics?.relevance === "number" && (
            <span>{Math.round((ad.metrics.relevance as number) * 100)}% match</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
            Preview
          </Button>
          <Button size="sm" className="flex-1" onClick={onUse}>
            <Wand2 className="mr-1 h-3.5 w-3.5" /> Use
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PreviewDialog({
  ad,
  onOpenChange,
  onUse,
}: {
  ad: WinningAdWithMedia | null;
  onOpenChange: (open: boolean) => void;
  onUse: (id: string) => void;
}) {
  return (
    <Dialog open={!!ad} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {ad && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {FORMAT_META[ad.format].label} ad
                <Badge variant="secondary">{ad.source_platform ?? "Unknown"}</Badge>
              </DialogTitle>
            </DialogHeader>

            {ad.format === "video" && ad.media[0] ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={ad.media[0].url} controls className="max-h-[60vh] w-full rounded-lg bg-black" />
            ) : ad.format === "carousel" ? (
              <div className="flex snap-x gap-2 overflow-x-auto rounded-lg">
                {ad.media.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.url}
                    alt="Slide"
                    className="h-[50vh] w-auto snap-center rounded-lg object-contain"
                  />
                ))}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ad.preview_url ?? ad.media[0]?.url ?? ""}
                alt="Ad"
                className="max-h-[60vh] w-full rounded-lg object-contain"
              />
            )}

            <div className="flex items-center justify-between">
              {ad.source_url ? (
                <a
                  href={ad.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  View source
                </a>
              ) : (
                <span />
              )}
              <Button onClick={() => onUse(ad.id)}>
                <Wand2 className="mr-2 h-4 w-4" /> Use this ad
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
