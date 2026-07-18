"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ProfileDetail, ProfileReadiness } from "@/server/queries/profiles";
import { deleteProfileAction, updateProfileBasicsAction } from "@/server/actions/profiles";
import { BrainEditor } from "./brain-editor";
import { IdentityEditor } from "./identity-editor";
import { ProductsManager } from "./products-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function ProfileEditor({
  detail,
  readiness,
}: {
  detail: ProfileDetail;
  readiness: ProfileReadiness;
}) {
  const router = useRouter();
  const { profile, identity, identityImages, products } = detail;

  const [name, setName] = useState(profile.name);
  const [niche, setNiche] = useState(profile.niche ?? "");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveBasics(next: { name?: string; niche?: string }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateProfileBasicsAction({ id: profile.id, ...next }).catch(() =>
        toast.error("Could not save"),
      );
    }, 600);
  }

  function deleteProfile() {
    if (!confirm(`Delete profile "${profile.name}"? This removes its products and generations.`))
      return;
    startTransition(async () => {
      try {
        await deleteProfileAction(profile.id);
        router.push("/profiles");
        router.refresh();
      } catch {
        toast.error("Could not delete profile");
      }
    });
  }

  return (
    <div>
      <div className="border-b bg-background px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" render={<Link href="/profiles" />}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Profiles
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={deleteProfile}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Brand name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                saveBasics({ name: e.target.value });
              }}
              className="h-9 text-lg font-semibold"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Niche / subject (drives ad discovery)</label>
            <Input
              value={niche}
              onChange={(e) => {
                setNiche(e.target.value);
                saveBasics({ niche: e.target.value });
              }}
              placeholder="e.g. specialty coffee for home baristas"
              className="h-9"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <ReadyChip ok={readiness.hasBrain} label="Brain" />
          <ReadyChip ok={readiness.hasColor} label="Color" />
          <ReadyChip ok={readiness.hasProductWithImage} label="Product image" />
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="brain">
          <TabsList>
            <TabsTrigger value="brain">Brain</TabsTrigger>
            <TabsTrigger value="identity">Visual identity</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>
          <TabsContent value="brain" className="mt-4">
            <BrainEditor profileId={profile.id} initialBrain={profile.brain_md} />
          </TabsContent>
          <TabsContent value="identity" className="mt-4">
            <IdentityEditor profileId={profile.id} identity={identity} images={identityImages} />
          </TabsContent>
          <TabsContent value="products" className="mt-4">
            <ProductsManager profileId={profile.id} products={products} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReadyChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        ok
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}
