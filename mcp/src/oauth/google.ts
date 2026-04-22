// Google Ads OAuth 2.0 flow
// Phase 1: CLI-driven one-shot. No web server.
//
// Usage:
//   npm run oauth:google -- --client-slug=stjordal-autosalg
// 1. Prints authorization URL
// 2. User visits URL, grants access, Google returns a code
// 3. User pastes code back to CLI
// 4. CLI exchanges code for tokens, stores encrypted in platform_connections

import { env } from '../shared/env.js';
import { supabase } from '../shared/supabase.js';
import { encryptToken } from '../shared/crypto.js';
import { audit } from '../shared/audit.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

export function buildAuthUrl(state: string): string {
  if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_REDIRECT_URI) {
    throw new Error('GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_REDIRECT_URI must be set');
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri: env.GOOGLE_ADS_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_CLIENT_SECRET || !env.GOOGLE_ADS_REDIRECT_URI) {
    throw new Error('Google OAuth env vars missing');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_ADS_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_CLIENT_SECRET) {
    throw new Error('Google OAuth env vars missing');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function persistConnection(params: {
  clientId: string;
  customerId: string;           // Google Ads customer ID (the dealer's account, not MCC)
  accountName: string;
  mccId?: string;
  tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string };
}): Promise<string> {
  const { clientId, customerId, accountName, mccId, tokens } = params;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Deactivate any existing active connection for this client+platform+account, then insert
  await supabase
    .from('platform_connections')
    .update({ active: false })
    .eq('client_id', clientId)
    .eq('platform', 'google_ads')
    .eq('account_external_id', customerId)
    .eq('active', true);

  const { data, error } = await supabase
    .from('platform_connections')
    .insert({
      client_id: clientId,
      platform: 'google_ads',
      account_external_id: customerId,
      account_name: accountName,
      mcc_id: mccId ?? env.GOOGLE_ADS_MCC_ID ?? null,
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      token_expires_at: expiresAt,
      scopes: tokens.scope.split(' '),
      active: true,
    })
    .select('id')
    .single();

  if (error) throw new Error(`persist connection failed: ${error.message}`);

  await audit({
    clientId,
    actor: 'casper',
    action: 'connect',
    details: { platform: 'google_ads', customer_id: customerId, mcc_id: mccId },
  });

  return data.id;
}
