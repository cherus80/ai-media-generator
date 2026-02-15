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
