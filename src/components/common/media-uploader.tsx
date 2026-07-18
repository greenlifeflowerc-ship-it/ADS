"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Generic uploader: sends the selected file(s) plus `fields` to a server action
 * (FormData) which uploads to storage and persists the DB row. After all uploads
 * the router refreshes to reflect the revalidated data.
 */
export function MediaUploader({
  action,
  fields = {},
  accept = "image/*",
  label = "Upload",
  multiple = false,
  variant = "outline",
  size = "sm",
}: {
  action: (formData: FormData) => Promise<void>;
  fields?: Record<string, string>;
  accept?: string;
  label?: string;
  multiple?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    startTransition(async () => {
      try {
        for (const file of list) {
          const fd = new FormData();
          Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
          fd.append("file", file);
          await action(fd);
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {pending ? "Uploading…" : label}
      </Button>
    </>
  );
}
