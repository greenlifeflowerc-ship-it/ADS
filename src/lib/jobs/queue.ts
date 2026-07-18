import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EnqueueInput, Job, JobsQueue } from "./types";

const LEASE_MS = 120_000;

function db() {
  return createSupabaseAdminClient();
}

/** Postgres-backed job queue. Writes go through the service-role client. */
export const queue: JobsQueue = {
  async enqueue(input: EnqueueInput) {
    const supabase = db();
    const row = {
      user_id: input.userId,
      type: input.type,
      payload: input.payload,
      dedupe_key: input.dedupeKey ?? null,
      profile_id: input.profileId ?? null,
      generation_id: input.generationId ?? null,
      max_attempts: input.maxAttempts ?? 3,
    };

    const { data, error } = await supabase.from("jobs").insert(row).select("id").single();

    if (error) {
      // Unique violation on dedupe_key → return the existing job (idempotent enqueue).
      if (input.dedupeKey && error.code === "23505") {
        const { data: existing } = await supabase
          .from("jobs")
          .select("id")
          .eq("dedupe_key", input.dedupeKey)
          .single();
        if (existing) return { jobId: existing.id as string, deduped: true };
      }
      throw error;
    }

    return { jobId: data!.id as string, deduped: false };
  },

  async claimNext(workerId, leaseSec = 120) {
    const supabase = db();
    const { data, error } = await supabase.rpc("claim_next_job", {
      p_worker: workerId,
      p_lease_sec: leaseSec,
    });
    if (error) throw error;
    return (data as Job | null) ?? null;
  },

  async heartbeat(jobId, progress, message) {
    const supabase = db();
    await supabase
      .from("jobs")
      .update({
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        progress_message: message ?? null,
        lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
      })
      .eq("id", jobId);
  },

  async checkpoint(jobId, result) {
    const supabase = db();
    await supabase.from("jobs").update({ result }).eq("id", jobId);
  },

  async complete(jobId, result) {
    const supabase = db();
    await supabase
      .from("jobs")
      .update({
        status: "succeeded",
        progress: 100,
        finished_at: new Date().toISOString(),
        ...(result ? { result } : {}),
      })
      .eq("id", jobId);
  },

  async fail(jobId, error, opts) {
    const supabase = db();
    if (opts?.retry) {
      await supabase
        .from("jobs")
        .update({
          status: "queued",
          error,
          run_after: new Date(Date.now() + (opts.backoffSec ?? 15) * 1000).toISOString(),
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
        })
        .eq("id", jobId);
    } else {
      await supabase
        .from("jobs")
        .update({ status: "failed", error, finished_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  },

  async requeueExpired() {
    const supabase = db();
    const { data } = await supabase.rpc("requeue_expired_jobs");
    return (data as number | null) ?? 0;
  },
};
