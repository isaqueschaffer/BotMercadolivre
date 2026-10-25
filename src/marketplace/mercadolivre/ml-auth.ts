import axios from 'axios';
import crypto from 'crypto';
import { getDb, saveDatabase } from '../../db/database';
import { config } from '../../config';

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// PKCE helpers
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function getAuthorizationUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.ml.appId,
    redirect_uri: config.ml.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://auth.mercadolivre.com.br/authorization?${params}`;
}

export function getStoredTokens(): StoredTokens | null {
  const db = getDb();
  const result = db.exec('SELECT access_token, refresh_token, expires_at FROM ml_tokens WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) return null;
  const [accessToken, refreshToken, expiresAt] = result[0].values[0] as string[];
  return { accessToken, refreshToken, expiresAt };
}

function storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  const db = getDb();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  db.run(
    `INSERT INTO ml_tokens (id, access_token, refresh_token, expires_at, updated_at)
     VALUES (1, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       updated_at = datetime('now')`,
    [accessToken, refreshToken, expiresAt]
  );
  saveDatabase();
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<void> {
  const { data } = await axios.post<TokenResponse>(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: config.ml.appId,
    client_secret: config.ml.secret,
    code,
    redirect_uri: config.ml.redirectUri,
    code_verifier: codeVerifier,
  });
  storeTokens(data.access_token, data.refresh_token, data.expires_in);
  console.log('[ML Auth] Tokens salvos com sucesso.');
}

export async function refreshAccessToken(): Promise<string> {
  const stored = getStoredTokens();
  if (!stored) throw new Error('No stored tokens. Run auth flow first: npm run auth:ml');

  const { data } = await axios.post<TokenResponse>(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: config.ml.appId,
    client_secret: config.ml.secret,
    refresh_token: stored.refreshToken,
  });

  storeTokens(data.access_token, data.refresh_token, data.expires_in);
  console.log('[ML Auth] Token renovado com sucesso.');
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const stored = getStoredTokens();
  if (!stored) throw new Error('No stored tokens. Run auth flow first: npm run auth:ml');

  const expiresAt = new Date(stored.expiresAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() > expiresAt - fiveMinutes) {
    return refreshAccessToken();
  }

  return stored.accessToken;
}

export function isAuthenticated(): boolean {
  const stored = getStoredTokens();
  return stored !== null;
}
