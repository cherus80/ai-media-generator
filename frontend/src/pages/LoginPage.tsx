import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth, useAuthStore } from '../store/authStore';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { VKSignInButton } from '../components/auth/VKSignInButton';
import { YandexSignInButton } from '../components/auth/YandexSignInButton';
import { TelegramSignInButton } from '../components/auth/TelegramSignInButton';
import { validateLoginForm } from '../utils/passwordValidation';
import { PD_CONSENT_VERSION } from '../constants/pdConsent';
import { MAX_SUPPORT_URL } from '../constants/supportLinks';
import { rememberAuthNextPath, resolveSafeNextPath } from '../utils/safeRedirect';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithEmail, isLoading, error, clearError } = useAuth();
  const nextPath = resolveSafeNextPath(searchParams.get('next'), '/app');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [pdConsent, setPdConsent] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string; pdConsent?: string }>({});
  const oauthButtonClass =
    'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200';
  const { pdConsentVersionAccepted, setPdConsentAccepted } = useAuth();
  const isBlockedError =
    typeof error === 'string' &&
    /(заблок|blocked|banned|мультиаккаунт)/i.test(error);

  useEffect(() => {
    if (pdConsentVersionAccepted === PD_CONSENT_VERSION) {
      setPdConsent(true);
    }
  }, [pdConsentVersionAccepted]);

  useEffect(() => {
    rememberAuthNextPath(nextPath, '/app');
  }, [nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate
    const validation = validateLoginForm(formData.email, formData.password);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    if (!pdConsent) {
      setFormErrors({ ...validation.errors, pdConsent: 'Нужно согласиться на обработку ПДн' });
      return;
    }

    try {
      await loginWithEmail({ ...formData, consent_version: PD_CONSENT_VERSION });
      const nextUser = useAuthStore.getState().user;
      if (
        nextUser?.email &&
        !nextUser.email_verified &&
        nextUser.auth_provider === 'email'
      ) {
        navigate('/verify-required', { replace: true });
      } else {
        navigate(nextPath, { replace: true });
      }
    } catch (err) {
      // Error is set in store
    }
  };

  const handleAuthSuccess = () => {
    const nextUser = useAuthStore.getState().user;
    if (
      nextUser?.email &&
      !nextUser.email_verified &&
      nextUser.auth_provider === 'email'
    ) {
      navigate('/verify-required', { replace: true });
    } else {
      navigate(nextPath, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-10">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-white/70 shadow-2xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-dark-900">Войдите в свой аккаунт</h2>
          <p className="text-sm text-dark-600">
            Или{' '}
            <Link
              to={`/register?next=${encodeURIComponent(nextPath)}`}
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              создайте новый аккаунт
            </Link>
          </p>
        </div>

        <div className="space-y-6">
          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 max-[420px]:grid-cols-1 gap-3">
            <GoogleSignInButton
              onSuccess={handleAuthSuccess}
              onError={(err) => console.error(err)}
              text="signin_with"
              size="large"
              className={oauthButtonClass}
              disabled={!pdConsent}
              consentVersion={PD_CONSENT_VERSION}
            />
            <VKSignInButton
              onError={(err) => console.error(err)}
              className={oauthButtonClass}
              disabled={!pdConsent}
              nextPath={nextPath}
            />
            <YandexSignInButton
              className={oauthButtonClass}
              disabled={!pdConsent}
              nextPath={nextPath}
            />
            <TelegramSignInButton
              onSuccess={handleAuthSuccess}
              onError={(err) => console.error(err)}
              className={oauthButtonClass}
              disabled={!pdConsent}
            />
          </div>

          {/* Consent Checkbox positioned near OAuth buttons */}
          <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center h-5">
                <input
                  id="pd-consent-login"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                  checked={pdConsent}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setPdConsent(next);
                    setPdConsentAccepted(next ? PD_CONSENT_VERSION : null);
                  }}
                  required
                />
              </div>
              <label htmlFor="pd-consent-login" className="text-xs text-slate-600 leading-snug cursor-pointer select-none">
                <span className="font-semibold text-slate-700">Обязательно:</span> Я согласен на обработку персональных данных и принимаю{' '}
                <a href="/oferta" target="_blank" className="text-primary-600 hover:text-primary-700 underline">оферту</a> и{' '}
                <a href="/privacy" target="_blank" className="text-primary-600 hover:text-primary-700 underline">политику ПДн</a>.
                Без этого вход невозможен.
              </label>
            </div>
            {formErrors.pdConsent && <p className="mt-2 text-xs text-red-600 font-medium">{formErrors.pdConsent}</p>}
          </div>

          {!pdConsent && (
            <p className="text-xs text-center text-slate-500 animate-pulse">
              👆 Отметьте галочку выше, чтобы разблокировать вход
            </p>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Или продолжите с эл. почтой</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
              {isBlockedError ? (
                <p className="text-sm text-red-800">
                  Ваш аккаунт заблокирован по причине подозрения на мультиаккаунтинг. Для обжалования блокировки
                  напишите нам в{' '}
                  <a
                    href={MAX_SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    MAX
                  </a>
                  .
                </p>
              ) : (
                <p className="text-sm text-red-800">{error}</p>
              )}
            </div>
          )}

          {/* Email/Password Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                Эл. почта
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full h-12 px-4 border border-slate-200 rounded-xl bg-slate-50 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 text-slate-800"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {formErrors.email && <p className="text-sm text-red-600">{formErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full h-12 px-4 border border-slate-200 rounded-xl bg-slate-50 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 text-slate-800"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {formErrors.password && (
                <p className="text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary-700 hover:text-primary-800 underline">
                Забыли пароль?
              </Link>
            </div>



            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 inline-flex items-center justify-center rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-400/30 hover:shadow-blue-400/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Входя, вы подтверждаете согласие с{' '}
              <a href="/oferta" className="text-primary-700 hover:text-primary-800 underline">
                офертой
              </a>{' '}
              и{' '}
              <a href="/privacy" className="text-primary-700 hover:text-primary-800 underline">
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
