"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "./keys";
import type { GenerationAssetRow, GenerationRow } from "@/lib/types/db";

export type GenerationDto = {
  generation: GenerationRow;
  assets: GenerationAssetRow[];
  job: {
    status: string;
    progress: number;
    progress_message: string | null;
    error: string | null;
  } | null;
};

export function useGeneration(id: string, initialData?: GenerationDto) {
  return useQuery({
    queryKey: qk.generation(id),
    initialData,
    queryFn: async (): Promise<GenerationDto> => {
      const res = await fetch(`/api/generations/${id}`);
      if (!res.ok) throw new Error("Could not load generation");
      return res.json();
    },
    refetchInterval: (q) => {
      const status = q.state.data?.generation?.status;
      return status === "succeeded" || status === "failed" ? false : 1500;
    },
  });
}
