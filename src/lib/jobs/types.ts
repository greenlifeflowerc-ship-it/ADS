import type { JobRow } from "@/lib/types/db";
import type { JobType } from "@/lib/types/domain";

export type Json = Record<string, unknown>;
export type Job = JobRow;

export interface EnqueueInput {
  type: JobType;
  userId: string;
  payload: Json;
  dedupeKey?: string;
  profileId?: string;
  generationId?: string;
  maxAttempts?: number;
}

export interface JobsQueue {
  enqueue(input: EnqueueInput): Promise<{ jobId: string; deduped: boolean }>;
  claimNext(workerId: string, leaseSec?: number): Promise<Job | null>;
  heartbeat(jobId: string, progress: number, message?: string): Promise<void>;
  checkpoint(jobId: string, result: Json): Promise<void>;
  complete(jobId: string, result?: Json): Promise<void>;
  fail(jobId: string, error: string, opts?: { retry?: boolean; backoffSec?: number }): Promise<void>;
  requeueExpired(): Promise<number>;
}

export type JobProcessor = (job: Job, queue: JobsQueue) => Promise<Json | void>;
