"use client";

import { Check, X } from "lucide-react";
import type { UsageSummary } from "@/server/queries/usage";
import type { HiggsfieldStatus } from "@/server/queries/higgsfield";
import { HiggsfieldConnect } from "./higgsfield-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatUsd4 } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProviderStatus = { key: string; label: string; configured: boolean; env: string };

export function SettingsView({
  usage,
  providers,
  budget,
  storageDriver,
  supabase,
  counts,
  higgsfield,
}: {
  usage: UsageSummary;
  providers: ProviderStatus[];
  budget: number | null;
  storageDriver: string;
  supabase: boolean;
  counts: { profiles: number; generations: number };
  higgsfield: HiggsfieldStatus;
}) {
  const budgetPct = budget && budget > 0 ? Math.min(100, (usage.mtdCost / budget) * 100) : 0;

  return (
    <Tabs defaultValue="usage">
      <TabsList>
        <TabsTrigger value="usage">Usage &amp; billing</TabsTrigger>
        <TabsTrigger value="providers">API keys</TabsTrigger>
        <TabsTrigger value="database">Database</TabsTrigger>
      </TabsList>

      {/* Usage */}
      <TabsContent value="usage" className="mt-4 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">This month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(usage.mtdCost)}</p>
              {budget && budget > 0 ? (
                <>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", budgetPct >= 100 ? "bg-red-500" : "bg-primary")}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">of {formatCurrency(budget)} cap</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No budget cap set</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">All-time spend</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(usage.totalCost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">across all providers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Generations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{usage.generationCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(usage.generationsCost)} rolled up
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by provider</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.byProvider.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.byProvider.map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell className="font-medium">{p.provider}</TableCell>
                      <TableCell className="text-right">{p.calls}</TableCell>
                      <TableCell className="text-right">{Math.round(p.units).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatUsd4(p.costUsd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Ledger total {formatCurrency(usage.totalCost)} · generations roll-up{" "}
              {formatCurrency(usage.generationsCost)}
              {Math.abs(usage.totalCost - usage.generationsCost) < 0.01
                ? " · reconciled"
                : " · includes discovery/other non-generation usage"}
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Providers */}
      <TabsContent value="providers" className="mt-4 space-y-4">
        <HiggsfieldConnect status={higgsfield} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keys are read from server environment variables (never sent to the browser). Set them
              in <code className="text-foreground">.env.local</code> or your deployment env.
            </p>
            <div className="divide-y rounded-lg border">
              {providers.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <code className="text-xs text-muted-foreground">{p.env}</code>
                  </div>
                  {p.configured ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Configured
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-muted-foreground">
                      <X className="h-3 w-3" /> Not set
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Unconfigured providers fall back to a stub so the app still runs end-to-end.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Database */}
      <TabsContent value="database" className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Supabase" value={supabase ? "Connected" : "Not configured"} ok={supabase} />
            <Row label="Storage driver" value={storageDriver} />
            <Row label="Profiles" value={String(counts.profiles)} />
            <Row label="Generations" value={String(counts.generations)} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          ok === true && "text-emerald-600 dark:text-emerald-400",
          ok === false && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
