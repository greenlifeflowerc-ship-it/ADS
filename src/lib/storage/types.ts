export type MediaKind = "image" | "video" | "raw";

/** Exactly what gets persisted to the DB (`*_url` + `*_public_id` + meta jsonb). */
export type StoredMedia = {
  url: string;
  publicId: string;
  resourceType: MediaKind;
  bytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  format?: string;
};

export type UploadSource = { bytes: Buffer } | { remoteUrl: string };

export type UploadInput = {
  source: UploadSource;
  /** e.g. `users/${userId}/generations/${generationId}` */
  folder: string;
  /** Deterministic id → idempotent retries (e.g. `clip-3`). */
  publicId?: string;
  resourceType?: MediaKind;
  overwrite?: boolean;
  tags?: string[];
  access?: "private" | "public";
};

export interface StorageProvider {
  readonly id: string;
  upload(input: UploadInput): Promise<StoredMedia>;
  delete(publicId: string, resourceType?: MediaKind): Promise<void>;
  signedUrl(
    publicId: string,
    opts?: { resourceType?: MediaKind; expiresInSec?: number; transformation?: string },
  ): string;
}
