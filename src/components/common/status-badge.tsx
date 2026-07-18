import { cn } from "@/lib/utils";
import type { GenerationStatus, JobStatus } from "@/lib/types/domain";

const STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  succeeded: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  canceled: "bg-muted text-muted-foreground",
};

const LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

export function StatusBadge({ status }: { status: GenerationStatus | JobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status === "running" && (
        <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {LABELS[status] ?? status}
    </span>
  );
}
