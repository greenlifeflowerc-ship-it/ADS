"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { IdentityImageRow, ProfileIdentityRow } from "@/lib/types/db";
import type { ColorSwatch, FontRef } from "@/lib/types/domain";
import {
  addIdentityImageAction,
  removeIdentityImageAction,
  removeLogoAction,
  setLogoAction,
  updateIdentityColorsAction,
  updateIdentityFontsAction,
} from "@/server/actions/identity";
import { MediaUploader } from "@/components/common/media-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function IdentityEditor({
  profileId,
  identity,
  images,
}: {
  profileId: string;
  identity: ProfileIdentityRow | null;
  images: IdentityImageRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [colors, setColors] = useState<ColorSwatch[]>(identity?.colors ?? []);
  const [fonts, setFonts] = useState<FontRef[]>(identity?.fonts ?? []);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fontTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveColors(next: ColorSwatch[]) {
    setColors(next);
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      updateIdentityColorsAction({ profileId, colors: next }).catch(() =>
        toast.error("Could not save colors"),
      );
    }, 500);
  }

  function saveFonts(next: FontRef[]) {
    setFonts(next);
    if (fontTimer.current) clearTimeout(fontTimer.current);
    fontTimer.current = setTimeout(() => {
      updateIdentityFontsAction({ profileId, fonts: next }).catch(() =>
        toast.error("Could not save fonts"),
      );
    }, 500);
  }

  function runAction(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>Your primary mark, used to keep generations on-brand.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
            {identity?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identity.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
          <div className="flex gap-2">
            <MediaUploader
              action={setLogoAction}
              fields={{ profileId }}
              label={identity?.logo_url ? "Replace" : "Upload logo"}
            />
            {identity?.logo_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  runAction(() => removeLogoAction({ profileId, publicId: identity.logo_public_id }))
                }
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Color palette</CardTitle>
            <CardDescription>At least one color is required to generate.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveColors([...colors, { name: `Color ${colors.length + 1}`, hex: "#4f46e5" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {colors.length === 0 && <p className="text-sm text-muted-foreground">No colors yet.</p>}
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c.hex}
                onChange={(e) =>
                  saveColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))
                }
                className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-transparent"
                aria-label="Color value"
              />
              <Input
                value={c.name}
                onChange={(e) =>
                  saveColors(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Name"
                className="h-8"
              />
              <Input
                value={c.hex}
                onChange={(e) =>
                  saveColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))
                }
                className="h-8 w-28 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => saveColors(colors.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Fonts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Fonts</CardTitle>
            <CardDescription>Typeface names used in your brand.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveFonts([...fonts, { name: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {fonts.length === 0 && <p className="text-sm text-muted-foreground">No fonts yet.</p>}
          {fonts.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={f.name}
                onChange={(e) =>
                  saveFonts(fonts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="e.g. Inter"
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => saveFonts(fonts.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reference images */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Reference images</CardTitle>
            <CardDescription>Style / mood imagery for the look and feel.</CardDescription>
          </div>
          <MediaUploader
            action={addIdentityImageAction}
            fields={{ profileId }}
            label="Add images"
            multiple
          />
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reference images yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.note ?? "Reference"} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() =>
                      runAction(() =>
                        removeIdentityImageAction({ id: img.id, profileId, publicId: img.public_id }),
                      )
                    }
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
