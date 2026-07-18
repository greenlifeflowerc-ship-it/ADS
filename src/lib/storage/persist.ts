import "server-only";

import { storage } from "./index";
import type { MediaKind, StoredMedia } from "./types";

/**
 * Upload a browser File (from a server action FormData) to storage.
 *
 * Defaults to PUBLIC access: every caller here uploads a brand asset (product
 * photo, logo, identity reference) that must be readable both by the UI's plain
 * <img> tags and by the generation providers that fetch referenceImages. Private
 * (authenticated) Cloudinary URLs 401 without a signature, so those would not
 * render or be usable as references.
 */
export async function uploadFile(
  file: File,
  folder: string,
  publicId?: string,
  resourceType?: MediaKind,
  access: "public" | "private" = "public",
): Promise<StoredMedia> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind: MediaKind = resourceType ?? (file.type.startsWith("video") ? "video" : "image");
  return storage.upload({ source: { bytes }, folder, publicId, resourceType: kind, overwrite: true, access });
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function assertImageFile(file: File | null): asserts file is File {
  if (!file || typeof file === "string") throw new Error("No file provided");
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("File too large (max 15MB)");
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Only image or video files are allowed");
  }
}
