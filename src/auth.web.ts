// Browser Google sign-in via Google Identity Services (token model).
// The access token is kept in memory only; reloading the page means signing in again.
import { GOOGLE_WEB_CLIENT_ID } from './config';
import { DRIVE_SCOPE } from './drive';

export type AuthUser = { email: string };

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string };
type TokenClient = {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string }) => void;
  requestAccessToken: (o?: { prompt?: string; login_hint?: string }) => void;
};
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
      }) => TokenClient;
      hasGrantedAllScopes: (r: TokenResponse, ...scopes: string[]) => boolean;
      revoke: (token: string, done: () => void) => void;
    };
  };
};

const SCOPES = `openid email ${DRIVE_SCOPE}`;
const HINT_KEY = 'pass-vault:last-email';

let gisPromise: Promise<Gis> | null = null;
let client: TokenClient | null = null;
let token: { value: string; expiresAt: number } | null = null;
let email = '';

function loadGis(): Promise<Gis> {
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve((window as unknown as { google: Gis }).google);
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Could not load Google sign-in. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

function lastEmail(): string {
  try {
    return localStorage.getItem(HINT_KEY) ?? '';
  } catch {
    return '';
  }
}

async function requestToken(prompt: string): Promise<TokenResponse | null> {
  const gis = await loadGis();
  client ??= gis.accounts.oauth2.initTokenClient({ client_id: GOOGLE_WEB_CLIENT_ID, scope: SCOPES, callback: () => {} });
  return new Promise((resolve, reject) => {
    client!.callback = (r) => {
      if (r.error) return reject(new Error(`Google sign-in failed: ${r.error}`));
      if (!gis.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) {
        return reject(new Error('Google Drive access was not granted. It is required to store the vault.'));
      }
      token = { value: r.access_token!, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
      resolve(r);
    };
    // Popup closed or blocked.
    client!.error_callback = () => resolve(null);
    client!.requestAccessToken({ prompt, login_hint: email || lastEmail() || undefined });
  });
}

export async function restoreSession(): Promise<AuthUser | null> {
  return null;
}

/** Returns null if the user cancelled. Must be called from a click handler so the popup isn't blocked. */
export async function signIn(): Promise<AuthUser | null> {
  const r = await requestToken('select_account');
  if (!r) return null;
  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token!.value}` },
  }).then((res) => res.json() as Promise<{ email?: string }>);
  email = info.email ?? '';
  try {
    localStorage.setItem(HINT_KEY, email);
  } catch {}
  return { email };
}

export async function getAccessToken(forceRefresh: boolean): Promise<string> {
  // Refresh a minute early so a request doesn't start with a token about to expire.
  if (!forceRefresh && token && token.expiresAt - Date.now() > 60_000) return token.value;
  const r = await requestToken('');
  if (!r) throw new Error('Google session expired. Allow the sign-in popup and try again.');
  return token!.value;
}

export async function signOut(): Promise<void> {
  const gis = await loadGis();
  if (token) await new Promise<void>((done) => gis.accounts.oauth2.revoke(token!.value, done));
  token = null;
  email = '';
}
