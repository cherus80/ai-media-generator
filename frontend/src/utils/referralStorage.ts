const REFERRAL_STORAGE_KEY = 'pending-referral-code';

export const storeReferralCode = (code: string) => {
  if (!code || typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase());
  } catch (error) {
    console.error('Failed to store referral code:', error);
  }
};

export const getStoredReferralCode = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    return stored ? stored.toUpperCase() : null;
  } catch (error) {
    console.error('Failed to read referral code:', error);
    return null;
  }
};

export const clearStoredReferralCode = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear referral code:', error);
  }
};
