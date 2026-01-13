import { registerReferral } from '../api/referral';
import { clearStoredReferralCode, getStoredReferralCode } from './referralStorage';

const NON_RETRYABLE_MESSAGES = new Set([
  'Неверный реферальный код',
  'Вы уже зарегистрированы по реферальной ссылке',
  'Нельзя использовать свой собственный реферальный код',
]);

let referralRegistrationInFlight = false;

export const registerPendingReferral = async () => {
  if (referralRegistrationInFlight) {
    return;
  }

  const referralCode = getStoredReferralCode();
  if (!referralCode) {
    return;
  }

  referralRegistrationInFlight = true;

  try {
    const result = await registerReferral({ referral_code: referralCode });
    if (result.success || NON_RETRYABLE_MESSAGES.has(result.message)) {
      clearStoredReferralCode();
    }
  } catch (error) {
    console.error('Failed to register pending referral:', error);
  } finally {
    referralRegistrationInFlight = false;
  }
};
