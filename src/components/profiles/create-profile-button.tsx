"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProfileAction } from "@/server/actions/profiles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateProfileButton({
  variant = "default",
  size = "default",
  label = "New profile",
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createProfileAction({ name: name.trim() });
      setOpen(false);
      setName("");
      router.push(`/profiles/${id}`);
      router.refresh();
    } catch {
      toast.error("Could not create profile");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create brand profile</DialogTitle>
            <DialogDescription>
              Give the brand a name. You&apos;ll fill in the brain, identity, and products next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-profile-name">Name</Label>
            <Input
              id="new-profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Coffee Co."
              onKeyDown={(e) => e.key === "Enter" && create()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
