"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "./keys";
import type { JobStatus, JobType } from "@/lib/types/domain";

export type JobStatusDto = {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  progress_message: string | null;
  error: string | null;
  generation_id: string | null;
};

const TERMINAL: JobStatus[] = ["succeeded", "failed", "canceled"];

export function useJob(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.job(jobId ?? "none"),
    enabled: !!jobId && enabled,
    queryFn: async (): Promise<JobStatusDto> => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Could not fetch job status");
      return res.json();
    },
    refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status) ? false : 2000),
  });
}
