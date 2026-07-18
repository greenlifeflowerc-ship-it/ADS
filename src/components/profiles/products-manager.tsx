"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProductWithImages } from "@/server/queries/profiles";
import {
  addProductImageAction,
  createProductAction,
  deleteProductAction,
  removeProductImageAction,
  setPrimaryImageAction,
  updateProductAction,
} from "@/server/actions/products";
import { MediaUploader } from "@/components/common/media-uploader";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export function ProductsManager({
  profileId,
  products,
}: {
  profileId: string;
  products: ProductWithImages[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithImages | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: ProductWithImages) {
    setEditing(p);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Products</h3>
          <p className="text-xs text-muted-foreground">
            Each product needs at least one image to be usable in generation.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add a product with images and a short description."
          action={<Button onClick={openCreate}>Add product</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <ProductCard key={p.id} profileId={profileId} product={p} onEdit={() => openEdit(p)} />
          ))}
        </div>
      )}

      <ProductDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profileId={profileId}
        product={editing}
      />
    </div>
  );
}

function ProductCard({
  profileId,
  product,
  onEdit,
}: {
  profileId: string;
  product: ProductWithImages;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{product.name}</CardTitle>
          {product.price != null && (
            <span className="text-sm text-muted-foreground">{formatCurrency(product.price)}</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => {
              if (confirm(`Delete "${product.name}"?`))
                runAction(() => deleteProductAction({ id: product.id, profileId }));
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}

        <div className="grid grid-cols-4 gap-2">
          {product.images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={product.name} className="h-full w-full object-cover" />
              {img.is_primary && (
                <Badge className="absolute left-1 top-1 h-4 px-1 text-[10px]" variant="secondary">
                  Primary
                </Badge>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                {!img.is_primary && (
                  <button
                    type="button"
                    className="rounded-full bg-black/60 p-1 text-white"
                    aria-label="Set primary"
                    onClick={() =>
                      runAction(() =>
                        setPrimaryImageAction({ imageId: img.id, productId: product.id, profileId }),
                      )
                    }
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto rounded-full bg-black/60 p-1 text-white"
                  aria-label="Remove image"
                  onClick={() =>
                    runAction(() =>
                      removeProductImageAction({
                        id: img.id,
                        productId: product.id,
                        profileId,
                        publicId: img.public_id,
                      }),
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex aspect-square items-center justify-center rounded-md border border-dashed">
            <MediaUploader
              action={addProductImageAction}
              fields={{ productId: product.id, profileId }}
              label="Add"
              multiple
              variant="ghost"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  profileId,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string;
  product: ProductWithImages | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const priceNum = price.trim() === "" ? null : Number(price);
      if (product) {
        await updateProductAction({
          id: product.id,
          profileId,
          name: name.trim(),
          description: description.trim(),
          price: priceNum,
        });
      } else {
        await createProductAction({
          profileId,
          name: name.trim(),
          description: description.trim(),
          price: priceNum,
        });
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description used to ground prompts."
              className={cn("min-h-[90px]")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Price (optional)</Label>
            <Input
              id="p-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : product ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
