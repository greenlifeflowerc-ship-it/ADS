import type {
  AdAnalysis,
  AdFormat,
  ColorSwatch,
  FontRef,
  GenerationStatus,
  GenerationType,
  JobStatus,
  JobType,
} from "./domain";

/**
 * Hand-written row types mirroring supabase/migrations/0001_init.sql.
 * Replace with `supabase gen types typescript` output once a project is linked.
 */

export type ProfileRow = {
  id: string;
  user_id: string;
  name: string;
  brain_md: string;
  niche: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileIdentityRow = {
  profile_id: string;
  user_id: string;
  logo_url: string | null;
  logo_public_id: string | null;
  colors: ColorSwatch[];
  fonts: FontRef[];
  updated_at: string;
};

export type IdentityImageRow = {
  id: string;
  profile_id: string;
  user_id: string;
  url: string;
  public_id: string | null;
  note: string | null;
  created_at: string;
};

export type ProductRow = {
  id: string;
  profile_id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number | null;
  created_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  user_id: string;
  url: string;
  public_id: string | null;
  is_primary: boolean;
  created_at: string;
};

export type WinningAdRow = {
  id: string;
  profile_id: string;
  user_id: string;
  format: AdFormat;
  source_platform: string | null;
  source_url: string | null;
  preview_url: string | null;
  preview_public_id: string | null;
  metrics: Record<string, unknown>;
  apify_run_id: string | null;
  analysis: AdAnalysis | null;
  fetched_at: string;
};

export type WinningAdMediaRow = {
  id: string;
  winning_ad_id: string;
  user_id: string;
  url: string;
  public_id: string | null;
  kind: string | null;
  order_index: number;
};

export type GenerationRow = {
  id: string;
  user_id: string;
  profile_id: string;
  winning_ad_id: string | null;
  type: GenerationType;
  status: GenerationStatus;
  params: Record<string, unknown>;
  product_image_ids: string[];
  prompt_log: unknown;
  error: string | null;
  cost_usd: number;
  created_at: string;
  updated_at: string;
};

export type GenerationAssetRow = {
  id: string;
  generation_id: string;
  user_id: string;
  url: string;
  public_id: string | null;
  kind: string; // 'image' | 'clip' | 'audio' | 'final'
  order_index: number;
  meta: Record<string, unknown>;
  created_at: string;
};

export type ApiUsageRow = {
  id: string;
  user_id: string;
  provider: string;
  generation_id: string | null;
  job_id: string | null;
  units: number;
  unit_type: string | null;
  cost_usd: number;
  request_key: string | null;
  created_at: string;
};

export type JobRow = {
  id: string;
  user_id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  progress_message: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  profile_id: string | null;
  generation_id: string | null;
  dedupe_key: string | null;
  run_after: string;
  locked_by: string | null;
  locked_at: string | null;
  lease_expires_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  user_id: string;
  active_profile_id: string | null;
  higgsfield_mcp_url: string | null;
  higgsfield_mcp_token: string | null;
  updated_at: string;
};
