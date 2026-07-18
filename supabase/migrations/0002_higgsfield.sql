-- ===========================================================================
-- Higgsfield MCP connection (per-user). Generation (image/video/audio) is routed
-- through the user's connected Higgsfield MCP instead of per-vendor API keys.
-- NOTE: token is stored as-is here; move to Supabase Vault / encryption for prod.
-- ===========================================================================
alter table public.user_settings
  add column if not exists higgsfield_mcp_url text,
  add column if not exists higgsfield_mcp_token text;
