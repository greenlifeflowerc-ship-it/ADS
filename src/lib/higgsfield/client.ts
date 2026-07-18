import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type HiggsfieldConfig = { url: string; token: string };

export type ToolResult = {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
};

/** Open an MCP client connection to the user's Higgsfield MCP endpoint. */
export async function connectHiggsfield(cfg: HiggsfieldConfig): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
    requestInit: { headers: { Authorization: `Bearer ${cfg.token}` } },
  });
  const client = new Client({ name: "ads-maker", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

// ---- Result parsing (defensive: the MCP is widget-oriented) ----

export function resultText(res: ToolResult): string {
  const parts: string[] = [];
  const content = res.content as Array<{ type?: string; text?: string }> | undefined;
  if (Array.isArray(content)) {
    for (const c of content) if (c?.type === "text" && typeof c.text === "string") parts.push(c.text);
  }
  if (res.structuredContent) {
    try {
      parts.push(JSON.stringify(res.structuredContent));
    } catch {
      /* ignore */
    }
  }
  return parts.join("\n");
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

// Fields that hold INPUT/reference media (never the generated output) — skipped
// during structured extraction so we don't return the caller's own reference image.
const INPUT_FIELDS = new Set(["input_images", "reference_elements", "medias", "params", "input"]);

/** Find the generation/job id of the OUTPUT record (skips input media ids). */
function findGenerationId(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const el of node) {
      const id = findGenerationId(el);
      if (id) return id;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  // A generation/job record carries status/results/params alongside its id.
  if (typeof obj.id === "string" && (("status" in obj) || ("results" in obj) || ("params" in obj))) {
    return obj.id;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (INPUT_FIELDS.has(k)) continue;
    const id = findGenerationId(v);
    if (id) return id;
  }
  return null;
}

/**
 * Find the GENERATED media URL in a structured response. Higgsfield returns the
 * output under `results.rawUrl` / `results.minUrl` while inputs live under
 * `params.input_images` — so we prefer a `results` url and never descend into
 * input fields. Handles single objects and `{ items: [...] }` shapes.
 */
function findGeneratedUrl(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const el of node) {
      const u = findGeneratedUrl(el);
      if (u) return u;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;

  const results = obj.results as Record<string, unknown> | undefined;
  if (results && typeof results === "object") {
    const u = results.rawUrl ?? results.minUrl ?? results.url;
    if (typeof u === "string" && u.length) return u;
  }
  if (typeof obj.rawUrl === "string" && obj.rawUrl.length) return obj.rawUrl;
  if (typeof obj.minUrl === "string" && obj.minUrl.length) return obj.minUrl;

  for (const [k, v] of Object.entries(obj)) {
    if (INPUT_FIELDS.has(k)) continue;
    const u = findGeneratedUrl(v);
    if (u) return u;
  }
  return null;
}

export function extractUuid(res: ToolResult): string | null {
  // Prefer the output record's id; fall back to the first UUID only if needed.
  const structured = findGenerationId(res.structuredContent) ?? findGenerationId(res.content);
  if (structured) return structured;
  const m = resultText(res).match(UUID_RE);
  return m ? m[0] : null;
}

/**
 * The GENERATED output URL only. Returns null while the job is still pending (no
 * `results` yet) — callers then poll `job_display`. We deliberately do NOT fall
 * back to a plain first-URL regex, because a pending response echoes the INPUT
 * reference image and that regex would return it (the reference), not the output.
 */
export function extractMediaUrl(res: ToolResult): string | null {
  return findGeneratedUrl(res.structuredContent) ?? findGeneratedUrl(res.content);
}

export function checkFailed(res: ToolResult): { failed: boolean; reason?: string } {
  if (res.isError) return { failed: true, reason: resultText(res).slice(0, 300) || "tool error" };
  const t = resultText(res).toLowerCase();
  if (/"?status"?\s*[:=]\s*"?(failed|error|canceled|cancelled|rejected)/.test(t)) {
    return { failed: true, reason: "job failed" };
  }
  return { failed: false };
}

/** Import a remote media URL into Higgsfield, returning its media_id. */
export async function importMedia(client: Client, url: string): Promise<string | null> {
  try {
    const res = await callTool(client, "media_import_url", { url });
    return extractUuid(res);
  } catch {
    return null;
  }
}

/**
 * Submit a generation and poll `job_display` until a media URL is available.
 * Returns the media URL + the job id (for metering / re-display).
 */
export async function generateAndWait(
  client: Client,
  tool: string,
  args: Record<string, unknown>,
  opts?: { pollMs?: number; timeoutMs?: number },
): Promise<{ url: string; jobId: string | null }> {
  const first = await callTool(client, tool, args);
  const f = checkFailed(first);
  if (f.failed) throw new Error(`Higgsfield ${tool} failed: ${f.reason}`);

  const immediate = extractMediaUrl(first);
  const jobId = extractUuid(first);
  if (immediate) return { url: immediate, jobId };
  if (!jobId) throw new Error(`Higgsfield ${tool}: no job id or media url returned`);

  const pollMs = opts?.pollMs ?? 3000;
  const deadline = Date.now() + (opts?.timeoutMs ?? 300_000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const jr = await callTool(client, "job_display", { id: jobId });
    const jf = checkFailed(jr);
    if (jf.failed) throw new Error(`Higgsfield job failed: ${jf.reason}`);
    const url = extractMediaUrl(jr);
    if (url) return { url, jobId };
  }
  throw new Error(`Higgsfield ${tool}: timed out waiting for result`);
}
