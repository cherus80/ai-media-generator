export const resolveSafeNextPath = (rawNext: string | null | undefined, fallback = '/app'): string => {
  if (!rawNext) {
    return fallback;
  }

  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/')) {
    return fallback;
  }
  if (trimmed.startsWith('//')) {
    return fallback;
  }

  return trimmed;
};

const AUTH_NEXT_STORAGE_KEY = 'auth_next_path';

export const rememberAuthNextPath = (rawNext: string | null | undefined, fallback = '/app'): string => {
  const safePath = resolveSafeNextPath(rawNext, fallback);
  try {
    window.sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, safePath);
  } catch {
    // ignore storage errors
  }
  return safePath;
};

export const consumeRememberedAuthNextPath = (fallback = '/app'): string => {
  try {
    const stored = window.sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
    return resolveSafeNextPath(stored, fallback);
  } catch {
    return fallback;
  }
};
