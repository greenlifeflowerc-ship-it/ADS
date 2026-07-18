import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import type { AspectRatio } from "@/lib/types/domain";
import type { MediaOut } from "@/providers/types";

export type ClipInput = { url: string; seconds: number };
export type MergeInput = {
  clips: ClipInput[];
  voiceoverUrl?: string;
  musicUrl?: string;
  aspectRatio: AspectRatio;
};

const DIMS: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

async function download(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

function runFfmpeg(args: string[], bin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`)),
    );
  });
}

/**
 * Merge clips + voiceover into one MP4 with ffmpeg (local/worker). On Vercel or
 * if ffmpeg is unavailable, falls back to the first clip so the pipeline always
 * completes (prod video stitching via Cloudinary is a future enhancement).
 */
export async function mergeClips(input: MergeInput): Promise<MediaOut> {
  const clips = input.clips.filter((c) => c.url);
  if (clips.length === 0) throw new Error("No clips to merge");

  const bin = ffmpegStatic as unknown as string | null;
  const canFfmpeg = !!bin && !process.env.VERCEL && clips.length >= 1;
  if (!canFfmpeg) {
    return { url: clips[0].url };
  }

  const [w, h] = DIMS[input.aspectRatio] ?? DIMS["9:16"];
  const dir = await mkdtemp(join(tmpdir(), "admaker-merge-"));
  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const p = join(dir, `clip-${i}.mp4`);
      await download(clips[i].url, p);
      clipPaths.push(p);
    }
    let voPath: string | undefined;
    if (input.voiceoverUrl) {
      voPath = join(dir, "vo.mp3");
      try {
        await download(input.voiceoverUrl, voPath);
      } catch {
        voPath = undefined;
      }
    }

    const n = clipPaths.length;
    const scaleParts = clipPaths.map(
      (_, i) =>
        `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`,
    );
    const concatIns = Array.from({ length: n }, (_, i) => `[v${i}]`).join("");
    const filter = `${scaleParts.join(";")};${concatIns}concat=n=${n}:v=1:a=0[vout]`;

    const inputs = clipPaths.flatMap((p) => ["-i", p]);
    if (voPath) inputs.push("-i", voPath);

    const out = join(dir, "final.mp4");
    const args = [
      "-y",
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "[vout]",
      ...(voPath ? ["-map", `${n}:a`, "-shortest"] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      out,
    ];

    await runFfmpeg(args, bin as string);
    const bytes = await readFile(out);
    return { bytes, mimeType: "video/mp4" };
  } catch (e) {
    console.warn("[merge] ffmpeg failed, falling back to first clip:", e);
    return { url: clips[0].url };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
