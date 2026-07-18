import "server-only";

import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { env } from "@/lib/env";
import type { MediaKind, StorageProvider, StoredMedia, UploadInput } from "./types";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

function toStored(r: UploadApiResponse): StoredMedia {
  return {
    url: r.secure_url,
    publicId: r.public_id,
    resourceType: (r.resource_type as MediaKind) ?? "image",
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    durationSec: (r as { duration?: number }).duration,
    format: r.format,
  };
}

/**
 * Cloudinary storage. Provider outputs are URLs → we pass `remoteUrl` and let
 * Cloudinary ingest server-to-server so large media never streams through a
 * serverless function. Assets are private (`type: authenticated`) + signed URLs.
 */
export const cloudinaryStorage: StorageProvider = {
  id: "cloudinary",

  async upload(input: UploadInput): Promise<StoredMedia> {
    ensureConfigured();
    const isPublic = input.access === "public";
    const opts: UploadApiOptions = {
      folder: input.folder,
      public_id: input.publicId,
      overwrite: input.overwrite ?? true,
      resource_type: (input.resourceType ?? "auto") as "image" | "video" | "raw" | "auto",
      type: isPublic ? "upload" : "authenticated",
      tags: input.tags,
    };

    if ("remoteUrl" in input.source) {
      const r = await cloudinary.uploader.upload(input.source.remoteUrl, opts);
      return toStored(r);
    }

    const bytes = input.source.bytes;
    const r = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(opts, (err, res) =>
        err || !res ? reject(err ?? new Error("Cloudinary upload failed")) : resolve(res),
      );
      Readable.from(bytes).pipe(stream);
    });
    return toStored(r);
  },

  async delete(publicId, resourceType = "image") {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
    });
  },

  signedUrl(publicId, opts = {}) {
    ensureConfigured();
    return cloudinary.url(publicId, {
      type: "authenticated",
      resource_type: opts.resourceType ?? "image",
      sign_url: true,
      secure: true,
      transformation: opts.transformation,
    });
  },
};
