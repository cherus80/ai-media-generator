export const isActivationOnboardingEnvEnabled = (): boolean => {
  let raw = '';
  try {
    raw = (import.meta.env?.VITE_ACTIVATION_ONBOARDING_V1 || '').toString().trim().toLowerCase();
  } catch {
    raw = '';
  }
  if (!raw) {
    return true;
  }
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};
