/**
 * PKCE helper utilities for VK ID OAuth 2.1
 */

const base64UrlEncode = (buffer: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const generateRandomString = (length = 64) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i += 1) {
    result += charset[values[i] % charset.length];
  }
  return result;
};

export const generateCodeVerifier = () => generateRandomString(64);

export const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
};

export const getOrCreateDeviceId = () => {
  const key = 'vk_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const deviceId = crypto.randomUUID?.() || generateRandomString(32);
  localStorage.setItem(key, deviceId);
  return deviceId;
};

type StartVKPKCEAuthOptions = {
  appId: string;
  redirectUri: string;
  scope?: string;
  storageKey?: string;
};

/**
 * Starts VK ID PKCE authorization by redirecting to id.vk.ru/authorize.
 * Stores verifier/state/nonce in localStorage for later exchange.
 */
export const startVKPKCEAuth = async ({
  appId,
  redirectUri,
  scope = 'email phone',
  storageKey = 'vk_pkce',
}: StartVKPKCEAuthOptions) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
  const nonce = generateRandomString(16);
  const deviceId = getOrCreateDeviceId();

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      code_verifier: codeVerifier,
      state,
      nonce,
      device_id: deviceId,
      ts: Date.now(),
    })
  );

  const authUrl = new URL('https://id.vk.ru/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('device_id', deviceId);

  window.location.href = authUrl.toString();
};
