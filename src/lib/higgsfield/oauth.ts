import "server-only";

import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  AuthorizationServerMetadata,
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HiggsfieldConfig } from "./client";

/**
 * Higgsfield MCP OAuth (authorization-code + PKCE + Dynamic Client Registration),
 * the same flow Claude uses. Three entry points:
 *   beginOAuth        → returns the sign-in URL to redirect the browser to
 *   completeOAuth     → callback: exchanges the code for tokens and persists them
 *   getValidAccessToken → worker/engine: returns a fresh bearer, refreshing if stale
 */

/** Default hosted Higgsfield MCP endpoint. */
export const HIGGSFIELD_MCP_URL = "https://mcp.higgsfield.ai/mcp";
const SCOPE = "openid email offline_access";
/** Refresh a little before the token actually expires. */
const EXPIRY_SKEW_MS = 60_000;

type StoredConnection = {
  endpoint: string;
  authServerUrl: string;
  resource: string;
  client: OAuthClientInformationFull;
  tokens: { access_token: string; refresh_token?: string; expires_at?: number };
};

type PendingConnection = {
  endpoint: string;
  authServerUrl: string;
  resource: string;
  client: OAuthClientInformationFull;
  verifier: string;
  state: string;
};

function redirectUri(): string {
  return `${env.APP_URL.replace(/\/$/, "")}/api/higgsfield/callback`;
}

function db() {
  return createSupabaseAdminClient();
}

/** Discover the MCP's protected-resource + authorization-server metadata. */
async function discover(endpoint: string): Promise<{
  authServerUrl: string;
  resource: string;
  metadata: AuthorizationServerMetadata;
}> {
  const prm = await discoverOAuthProtectedResourceMetadata(endpoint);
  const authServerUrl = prm.authorization_servers?.[0];
  if (!authServerUrl) throw new Error("Higgsfield MCP advertises no authorization server");
  const metadata = await discoverAuthorizationServerMetadata(authServerUrl);
  if (!metadata) throw new Error("Could not load Higgsfield authorization-server metadata");
  return { authServerUrl, resource: prm.resource ?? endpoint, metadata };
}

/**
 * Step 1 — register a client (DCR) and build the authorization URL.
 * Stores the PKCE verifier + CSRF state in user_settings.higgsfield_oauth_pending.
 * Returns the URL the browser must be sent to for sign-in.
 */
export async function beginOAuth(userId: string, endpoint = HIGGSFIELD_MCP_URL): Promise<string> {
  const { authServerUrl, resource, metadata } = await discover(endpoint);

  const client = await registerClient(authServerUrl, {
    metadata,
    clientMetadata: {
      client_name: "Ads Maker",
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    },
  });

  const state = crypto.randomUUID();
  const { authorizationUrl, codeVerifier } = await startAuthorization(authServerUrl, {
    metadata,
    clientInformation: client,
    redirectUrl: redirectUri(),
    scope: SCOPE,
    state,
    resource: new URL(resource),
  });

  const pending: PendingConnection = { endpoint, authServerUrl, resource, client, verifier: codeVerifier, state };
  const { error } = await db()
    .from("user_settings")
    .upsert({ user_id: userId, higgsfield_oauth_pending: pending }, { onConflict: "user_id" });
  if (error) throw error;

  return authorizationUrl.toString();
}

/**
 * Step 2 — the OAuth callback. Verifies state, exchanges the code for tokens,
 * persists the connection, and clears the pending state.
 */
export async function completeOAuth(userId: string, code: string, state: string): Promise<void> {
  const supabase = db();
  const { data } = await supabase
    .from("user_settings")
    .select("higgsfield_oauth_pending")
    .eq("user_id", userId)
    .maybeSingle();

  const pending = (data as { higgsfield_oauth_pending?: PendingConnection | null } | null)
    ?.higgsfield_oauth_pending;
  if (!pending) throw new Error("No pending Higgsfield authorization for this user");
  if (pending.state !== state) throw new Error("OAuth state mismatch — aborting");

  const { metadata } = await discover(pending.endpoint);
  const tokens = await exchangeAuthorization(pending.authServerUrl, {
    metadata,
    clientInformation: pending.client,
    authorizationCode: code,
    codeVerifier: pending.verifier,
    redirectUri: redirectUri(),
    resource: new URL(pending.resource),
  });

  const connection: StoredConnection = {
    endpoint: pending.endpoint,
    authServerUrl: pending.authServerUrl,
    resource: pending.resource,
    client: pending.client,
    tokens: tokensToStored(tokens),
  };

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, higgsfield_oauth: connection, higgsfield_oauth_pending: null },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/**
 * Worker/engine — return a valid bearer for the user's Higgsfield MCP, refreshing
 * the access token when it is expired/near-expiry. Returns null if not connected.
 */
export async function getValidAccessToken(userId: string): Promise<HiggsfieldConfig | null> {
  const supabase = db();
  const { data } = await supabase
    .from("user_settings")
    .select("higgsfield_oauth")
    .eq("user_id", userId)
    .maybeSingle();

  const conn = (data as { higgsfield_oauth?: StoredConnection | null } | null)?.higgsfield_oauth;
  if (!conn?.tokens?.access_token) return null;

  const expiresAt = conn.tokens.expires_at ?? 0;
  const stale = expiresAt > 0 && Date.now() >= expiresAt - EXPIRY_SKEW_MS;

  if (stale && conn.tokens.refresh_token) {
    try {
      const { metadata } = await discover(conn.endpoint);
      const refreshed = await refreshAuthorization(conn.authServerUrl, {
        metadata,
        clientInformation: conn.client,
        refreshToken: conn.tokens.refresh_token,
        resource: new URL(conn.resource),
      });
      conn.tokens = tokensToStored(refreshed, conn.tokens.refresh_token);
      await supabase
        .from("user_settings")
        .upsert({ user_id: userId, higgsfield_oauth: conn }, { onConflict: "user_id" });
    } catch {
      // Refresh failed (revoked / expired refresh token) → surface as disconnected.
      return null;
    }
  }

  return { url: conn.endpoint, token: conn.tokens.access_token };
}

/** True if the user has an OAuth connection persisted. */
export async function hasOAuthConnection(userId: string): Promise<boolean> {
  const { data } = await db()
    .from("user_settings")
    .select("higgsfield_oauth")
    .eq("user_id", userId)
    .maybeSingle();
  const conn = (data as { higgsfield_oauth?: StoredConnection | null } | null)?.higgsfield_oauth;
  return !!conn?.tokens?.access_token;
}

/** Clear the OAuth connection (disconnect). */
export async function clearOAuthConnection(userId: string): Promise<void> {
  await db()
    .from("user_settings")
    .upsert(
      { user_id: userId, higgsfield_oauth: null, higgsfield_oauth_pending: null },
      { onConflict: "user_id" },
    );
}

function tokensToStored(
  tokens: OAuthTokens,
  fallbackRefresh?: string,
): StoredConnection["tokens"] {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? fallbackRefresh,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
  };
}
