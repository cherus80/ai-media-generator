type ApiErrorDetail =
  | string
  | {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
    };

const GENERATION_GENERIC_ERROR =
  'Произошла ошибка, повторите запрос еще раз или зайдите позже.';

const extractErrorCode = (error: any): string | null => {
  const detail = error?.response?.data?.detail as ApiErrorDetail | undefined;

  if (typeof detail === 'string') {
    return detail;
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.error === 'string') {
      return detail.error;
    }
    if (typeof detail.detail === 'string') {
      return detail.detail;
    }
    if (typeof detail.message === 'string') {
      return detail.message;
    }
  }

  return null;
};

export const isInsufficientBalanceError = (error: any): boolean => {
  const status = error?.response?.status;
  const code = extractErrorCode(error);

  if (status === 402) {
    return true;
  }

  return (
    code === 'NOT_ENOUGH_BALANCE' ||
    code === 'NOT_ENOUGH_CREDITS' ||
    code === 'NOT_ENOUGH_CREDITS_FOR_ASSISTANT'
  );
};

export const getGenerationErrorMessage = (
  error: any,
  fallback: string = GENERATION_GENERIC_ERROR
): string => {
  const code = extractErrorCode(error);

  if (code === 'NOT_ENOUGH_CREDITS_FOR_ASSISTANT') {
    return 'Недостаточно ⭐️звезд для AI-ассистента. Пополните баланс или оформите подписку.';
  }

  if (code === 'NOT_ENOUGH_BALANCE' || code === 'NOT_ENOUGH_CREDITS') {
    return 'Недостаточно ⭐️звезд для генерации. Пополните баланс или оформите подписку.';
  }

  if (error?.response?.status === 402) {
    return 'Недостаточно ⭐️звезд для генерации. Пополните баланс или оформите подписку.';
  }

  return fallback;
};
