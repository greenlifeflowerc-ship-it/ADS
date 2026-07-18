import "server-only";

import { features } from "@/lib/env";
import { cloudinaryStorage } from "./cloudinary";
import { localStorageProvider } from "./local";
import type { StorageProvider } from "./types";

/**
 * The single storage handle used everywhere. Cloudinary when configured,
 * otherwise the local/passthrough fallback. Callers write `{ url, publicId }`
 * to the DB identically in both modes.
 */
export const storage: StorageProvider = features.cloudinary ? cloudinaryStorage : localStorageProvider;

export type { StorageProvider, StoredMedia, UploadInput, MediaKind } from "./types";
