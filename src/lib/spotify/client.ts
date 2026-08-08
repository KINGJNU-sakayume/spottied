const TOKEN_KEY = 'spottied.spotify_tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class SpotifyAuthError extends Error {}

let authFailureHandler: (() => void) | null = null;
let rateLimitHandler: (() => void) | null = null;

export function setAuthFailureHandler(fn: () => void): void {
  authFailureHandler = fn;
}

export function setRateLimitHandler(fn: () => void): void {
  rateLimitHandler = fn;
}

export function getClientId(): string {
  return (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim();
}

/**
 * Vite inlines an empty string when the build had no VITE_SPOTIFY_CLIENT_ID,
 * which otherwise fails much later as an opaque 400 from Spotify.
 */
export function isClientIdConfigured(): boolean {
  return getClientId() !== '';
}

export const MISSING_CLIENT_ID_MESSAGE =
  'Spotify Client ID가 빌드에 포함되지 않았어요. GitHub Actions 시크릿 VITE_SPOTIFY_CLIENT_ID를 등록한 뒤 다시 배포해 주세요.';

/** Spotify puts the useful detail in the response body, not the status. */
async function readSpotifyError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string | { message?: string };
      error_description?: string;
    };
    const detail =
      body.error_description ??
      (typeof body.error === 'string' ? body.error : body.error?.message);
    return detail ? `${fallback} — ${detail}` : fallback;
  } catch {
    return fallback;
  }
}

/** The app's own root URL — must be registered in the Spotify dashboard. */
export function getRedirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(res: TokenResponse, fallbackRefresh?: string): StoredTokens {
  const tokens: StoredTokens = {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? fallbackRefresh ?? '',
    expiresAt: Date.now() + res.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  return tokens;
}

export function hasTokens(): boolean {
  return loadTokens() != null;
}

export function disconnectSpotify(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new SpotifyAuthError(
      await readSpotifyError(res, `토큰 요청 실패 (${res.status})`),
    );
  }
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCode(code: string, verifier: string): Promise<void> {
  const res = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: getClientId(),
    code_verifier: verifier,
  });
  saveTokens(res);
}

let refreshPromise: Promise<StoredTokens> | null = null;

function refreshTokens(): Promise<StoredTokens> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const tokens = loadTokens();
      if (!tokens?.refreshToken) throw new SpotifyAuthError('연결되지 않음');
      const res = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: getClientId(),
      });
      return saveTokens(res, tokens.refreshToken);
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function getValidAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new SpotifyAuthError('연결되지 않음');
  if (Date.now() < tokens.expiresAt - 60_000) return tokens.accessToken;
  try {
    return (await refreshTokens()).accessToken;
  } catch (e) {
    authFailureHandler?.();
    throw e instanceof SpotifyAuthError ? e : new SpotifyAuthError('토큰 갱신 실패');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function spotifyFetch<T>(path: string): Promise<T> {
  let retried401 = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = await getValidAccessToken();
    const res = await fetch(`https://api.spotify.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) {
      rateLimitHandler?.();
      const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000 + 200);
      continue;
    }
    if (res.status === 401) {
      if (retried401) {
        authFailureHandler?.();
        throw new SpotifyAuthError('인증 만료');
      }
      retried401 = true;
      try {
        await refreshTokens();
      } catch {
        authFailureHandler?.();
        throw new SpotifyAuthError('토큰 갱신 실패');
      }
      continue;
    }
    if (!res.ok) {
      throw new Error(
        await readSpotifyError(res, `Spotify API 오류 (${res.status})`),
      );
    }
    return res.json() as Promise<T>;
  }
  throw new Error('Spotify API 요청이 반복해서 실패했습니다');
}

// Sequential task queue — album track fetches must never run in parallel bursts.
let queueTail: Promise<unknown> = Promise.resolve();

export function enqueueSpotifyTask<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(fn, fn);
  queueTail = run.catch(() => undefined);
  return run;
}
