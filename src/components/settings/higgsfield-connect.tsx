"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Plug, X } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectHiggsfieldAction,
  saveHiggsfieldConfigAction,
  startHiggsfieldOAuthAction,
  testHiggsfieldConnectionAction,
} from "@/server/actions/higgsfield";
import type { HiggsfieldStatus } from "@/server/queries/higgsfield";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HiggsfieldConnect({ status }: { status: HiggsfieldStatus }) {
  const router = useRouter();
  const params = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [, startTransition] = useTransition();

  // Surface the OAuth callback result (redirect back to /settings?higgsfield=…).
  useEffect(() => {
    const flag = params.get("higgsfield");
    if (!flag) return;
    if (flag === "connected") toast.success("Higgsfield connected");
    else if (flag === "error") toast.error(params.get("reason") || "Higgsfield authorization failed");
    router.replace("/settings");
  }, [params, router]);

  async function connect() {
    setConnecting(true);
    try {
      const { url } = await startHiggsfieldOAuthAction();
      window.location.href = url; // hand off to Higgsfield sign-in
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start authorization");
      setConnecting(false);
    }
  }

  function disconnect() {
    startTransition(async () => {
      try {
        await disconnectHiggsfieldAction();
        toast.success("Disconnected");
        router.refresh();
      } catch {
        toast.error("Could not disconnect");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4" /> Higgsfield — generation
            </CardTitle>
            <CardDescription>
              Route image, video &amp; voice generation through your Higgsfield account — no
              per-vendor keys.
            </CardDescription>
          </div>
          {status.connected ? (
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Connected{status.method === "manual" ? " (token)" : ""}
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.connected ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {status.method === "oauth"
                ? "Signed in with your Higgsfield account. Tokens refresh automatically."
                : "Connected with a static token."}
            </p>
            <Button variant="ghost" className="text-destructive" onClick={disconnect}>
              <X className="mr-1 h-4 w-4" /> Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={connect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting…
                </>
              ) : (
                <>
                  <Plug className="mr-2 h-4 w-4" /> Connect with Higgsfield
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Opens Higgsfield sign-in in this window, then returns here — the same way Claude
              connects. Nothing to copy or paste.
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? "Hide advanced" : "Advanced: connect with a static token"}
            </button>
            {showManual && <ManualConnect onSaved={() => router.refresh()} />}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Credentials are stored server-side and used only by the background worker. When connected,
          Higgsfield takes over generation (Claude still writes the prompts).
        </p>
      </CardContent>
    </Card>
  );
}

/** Legacy manual URL + static bearer token path (kept as a fallback). */
function ManualConnect({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("https://mcp.higgsfield.ai/mcp");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; toolCount?: number; error?: string } | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await testHiggsfieldConnectionAction({ url, token }));
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveHiggsfieldConfigAction({ url, token });
      toast.success("Higgsfield connected");
      setToken("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="hf-url">MCP endpoint URL</Label>
        <Input id="hf-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.higgsfield.ai/mcp" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hf-token">Access token</Label>
        <Input
          id="hf-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="bearer token"
        />
      </div>
      {result && (
        <p className={result.ok ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}>
          {result.ok ? `Connected — ${result.toolCount} tools available.` : `Failed: ${result.error}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={test} disabled={testing || !url || !token}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing…
            </>
          ) : (
            "Test connection"
          )}
        </Button>
        <Button onClick={save} disabled={saving || !url || !token}>
          {saving ? "Saving…" : "Connect"}
        </Button>
      </div>
    </div>
  );
}
