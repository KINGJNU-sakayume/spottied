import { exchangeCode, getClientId, getRedirectUri } from './client';

const VERIFIER_KEY = 'spottied.pkce_verifier';
const SCOPE = 'user-read-recently-played';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function beginLogin(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  localStorage.setItem(VERIFIER_KEY, verifier);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  const challenge = base64url(new Uint8Array(digest));
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPE,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Handles the `?code=` redirect from Spotify. Must run before HashRouter
 * takes over (called from main.tsx before the app renders).
 */
export async function handleAuthRedirect(): Promise<void> {
  const search = new URLSearchParams(window.location.search);
  const code = search.get('code');
  const error = search.get('error');
  if (!code && !error) return;

  // Strip the query string but keep the hash route.
  window.history.replaceState(
    {},
    '',
    window.location.pathname + window.location.hash,
  );

  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (error || !code || !verifier) return;

  try {
    await exchangeCode(code, verifier);
  } catch {
    // Login failed silently — the user can retry from settings.
  }
}
