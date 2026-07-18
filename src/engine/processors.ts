import type { JobType } from "@/lib/types/domain";
import type { JobProcessor } from "@/lib/jobs/types";
import { runDiscovery } from "./discovery";
import { runGeneration } from "./generation";

/**
 * Registry of job processors, keyed by job type.
 * The tick endpoint fails any job whose type has no registered processor.
 */
export const processors: Partial<Record<JobType, JobProcessor>> = {
  discover_winning_ads: runDiscovery,
  generate_content: runGeneration,
};
