import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth, useAuthStore } from '../store/authStore';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { VKSignInButton } from '../components/auth/VKSignInButton';
import { validateRegisterForm, checkPasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '../utils/passwordValidation';
import { getStoredReferralCode, storeReferralCode } from '../utils/referralStorage';
import { registerPendingReferral } from '../utils/referralRegistration';
import { PD_CONSENT_VERSION } from '../constants/pdConsent';

export function RegisterPage() {
  const navigate = useNavigate();
  const { registerWithEmail, isLoading, error, clearError, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [pdConsent, setPdConsent] = useState(false);
  const oauthButtonClass =
    'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200';
  const { pdConsentVersionAccepted, setPdConsentAccepted } = useAuth();

  const passwordStrength = checkPasswordStrength(formData.password);

  // Извлечь реферальный код из URL при монтировании компонента
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      storeReferralCode(refCode);
      setReferralCode(refCode);
      console.log('Referral code detected:', refCode);
      return;
    }

    const storedCode = getStoredReferralCode();
    if (storedCode) {
      setReferralCode(storedCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !referralCode) {
      return;
    }

    registerPendingReferral();
  }, [isAuthenticated, referralCode]);

  useEffect(() => {
    if (pdConsentVersionAccepted === PD_CONSENT_VERSION) {
      setPdConsent(true);
    }
  }, [pdConsentVersionAccepted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const validation = validateRegisterForm(formData.email, formData.password, formData.confirmPassword);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    if (!pdConsent) {
      setFormErrors({ ...validation.errors, pdConsent: 'Нужно согласиться на обработку ПДн' });
      return;
    }

    try {
      await registerWithEmail({
        email: formData.email,
        password: formData.password,
        consent_version: PD_CONSENT_VERSION,
      });

      const nextUser = useAuthStore.getState().user;
      if (
        nextUser?.email &&
        !nextUser.email_verified &&
        nextUser.auth_provider === 'email'
      ) {
        navigate('/verify-required', { replace: true });
      } else {
        navigate('/app');
      }
    } catch (err) {
      // Error handled in store
    }
  };

  const handleGoogleSuccess = async () => {
    const nextUser = useAuthStore.getState().user;
    if (
      nextUser?.email &&
      !nextUser.email_verified &&
      nextUser.auth_provider === 'email'
    ) {
      navigate('/verify-required', { replace: true });
    } else {
      navigate('/app');
    }
  };

  const handleVKSuccess = async () => {
    const nextUser = useAuthStore.getState().user;
    if (
      nextUser?.email &&
      !nextUser.email_verified &&
      nextUser.auth_provider === 'email'
    ) {
      navigate('/verify-required', { replace: true });
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Создайте свой аккаунт</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Войти
            </Link>
          </p>
        </div>

        {referralCode && (
          <div className="rounded-md bg-green-50 p-4 border border-green-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-green-800">
                Вас пригласили! Зарегистрируйтесь, чтобы получить бонусные ⭐️звезды.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* OAuth Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(err) => console.error(err)}
              text="signup_with"
              size="large"
              className={oauthButtonClass}
              disabled={!pdConsent}
              consentVersion={PD_CONSENT_VERSION}
            />
            <VKSignInButton
              onSuccess={handleVKSuccess}
              onError={(err) => console.error(err)}
              className={oauthButtonClass}
              disabled={!pdConsent}
            />
          </div>
          {!pdConsent && (
            <p className="text-sm font-semibold text-red-600">
              Отметьте согласие на обработку ПДн, чтобы активировать регистрацию через Google или VK.
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Или зарегистрируйтесь с эл. почтой</span>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Эл. почта
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Надежность пароля:</span>
                    <span className={`text-xs font-medium ${passwordStrength.score >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                      {getPasswordStrengthLabel(passwordStrength.score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getPasswordStrengthColor(passwordStrength.score)} transition-all duration-300`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Подтвердите пароль
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              {formErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="show-password"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <label htmlFor="show-password" className="ml-2 block text-sm text-gray-700">
                Показать пароли
              </label>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="pd-consent-register"
                type="checkbox"
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={pdConsent}
              onChange={(e) => {
                const next = e.target.checked;
                setPdConsent(next);
                setPdConsentAccepted(next ? PD_CONSENT_VERSION : null);
              }}
              required
            />
              <label htmlFor="pd-consent-register" className="text-xs text-gray-600 leading-snug">
                Я согласен на обработку персональных данных и принимаю{' '}
                <a href="/oferta" className="text-blue-600 hover:text-blue-500 underline">оферту</a> и{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-500 underline">политику ПДн</a>.
              </label>
            </div>
            {formErrors.pdConsent && (
              <p className="text-sm text-red-600">{formErrors.pdConsent}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Создание аккаунта...' : 'Создать аккаунт'}
            </button>
            <p className="mt-3 text-xs text-gray-600 text-center">
              Регистрируясь, вы подтверждаете согласие с{' '}
              <a href="/oferta" className="text-blue-600 hover:text-blue-500 underline">
                офертой
              </a>{' '}
              и{' '}
              <a href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
                политикой конфиденциальности
              </a>
              .
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
