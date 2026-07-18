"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useActiveProfile } from "@/lib/context/active-profile";
import { createProfileAction, setActiveProfileAction } from "@/server/actions/profiles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const router = useRouter();
  const { activeProfileId, profiles } = useActiveProfile();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const active = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  function selectProfile(id: string) {
    if (id === activeProfileId) return;
    startTransition(async () => {
      try {
        await setActiveProfileAction(id);
        router.refresh();
      } catch {
        toast.error("Could not switch profile");
      }
    });
  }

  async function createProfile() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createProfileAction({ name: name.trim() });
      setDialogOpen(false);
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={pending}
              aria-label="Switch profile"
            />
          }
        >
          <span className="truncate">{active ? active.name : "No profile"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>Brand profiles</DropdownMenuLabel>
          {profiles.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No profiles yet</p>
          )}
          {profiles.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => selectProfile(p.id)}>
              <Check className={cn("mr-2 h-4 w-4", p.id === active?.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create brand profile</DialogTitle>
            <DialogDescription>Give the brand a name. You&apos;ll fill in the brain, identity, and products next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Coffee Co."
              onKeyDown={(e) => e.key === "Enter" && createProfile()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createProfile} disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
