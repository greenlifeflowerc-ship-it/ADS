import "server-only";

import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "@/lib/env";
import type { StorageProvider, StoredMedia, UploadInput } from "./types";

/**
 * Dev fallback storage (no Cloudinary creds needed). Provider outputs (remote
 * URLs) are passed through as-is; raw bytes are written under public/.localstore
 * and served by Next in dev. Vercel's FS is ephemeral — use Cloudinary in prod.
 */
const ROOT = join(process.cwd(), "public", ".localstore");
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const PASSTHROUGH = "passthrough:";

export const localStorageProvider: StorageProvider = {
  id: "local",

  async upload(input: UploadInput): Promise<StoredMedia> {
    if ("remoteUrl" in input.source) {
      return {
        url: input.source.remoteUrl,
        publicId: `${PASSTHROUGH}${hash(input.source.remoteUrl)}`,
        resourceType: input.resourceType ?? "raw",
      };
    }

    const rel = `${input.folder}/${input.publicId ?? hash(`${Date.now()}`)}`.replace(
      /[^a-zA-Z0-9/_-]/g,
      "_",
    );
    const abs = join(ROOT, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, input.source.bytes);
    return {
      url: `${env.APP_URL}/.localstore/${rel}`,
      publicId: rel,
      resourceType: input.resourceType ?? "raw",
      bytes: input.source.bytes.length,
    };
  },

  async delete(publicId) {
    if (publicId.startsWith(PASSTHROUGH)) return;
    await rm(join(ROOT, publicId), { force: true });
  },

  signedUrl(publicId) {
    if (publicId.startsWith(PASSTHROUGH)) return publicId;
    return `${env.APP_URL}/.localstore/${publicId}`;
  },
};
