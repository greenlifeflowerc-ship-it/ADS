-- ===========================================================================
-- Higgsfield MCP — OAuth 2.1 (authorization-code + PKCE) connection, per-user.
-- Mirrors how Claude connects to the Higgsfield MCP: dynamic client registration,
-- browser sign-in, and a refresh_token (offline_access) so the worker stays
-- connected without a manually-pasted static token.
--
--   higgsfield_oauth         → persisted connection:
--                               { endpoint, authServerUrl, resource, client, tokens:{access_token, refresh_token, expires_at} }
--   higgsfield_oauth_pending → transient in-flight state during the redirect:
--                               { endpoint, authServerUrl, resource, client, verifier, state }
--
-- The legacy higgsfield_mcp_url / higgsfield_mcp_token columns (0002) remain for
-- the manual static-token fallback.
-- NOTE: tokens stored as-is here; move to Supabase Vault / encryption for prod.
-- ===========================================================================
alter table public.user_settings
  add column if not exists higgsfield_oauth jsonb,
  add column if not exists higgsfield_oauth_pending jsonb;
