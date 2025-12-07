import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, useAuthStore } from '../store/authStore';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { VKSignInButton } from '../components/auth/VKSignInButton';
import { validateLoginForm } from '../utils/passwordValidation';

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithEmail, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate
    const validation = validateLoginForm(formData.email, formData.password);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    try {
      await loginWithEmail(formData);
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
      // Error is set in store
    }
  };

  const handleGoogleSuccess = () => {
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

  const handleVKSuccess = () => {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-10">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-white/70 shadow-2xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-dark-900">Войдите в свой аккаунт</h2>
          <p className="text-sm text-dark-600">
            Или{' '}
            <Link to="/register" className="font-semibold text-primary-700 hover:text-primary-800">
              создайте новый аккаунт
            </Link>
          </p>
        </div>

        <div className="space-y-6">
          {/* OAuth Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(err) => console.error(err)}
              text="signin_with"
              size="large"
              className="w-full h-12 rounded-lg border border-slate-200 bg-white shadow-sm flex items-center justify-center px-2"
            />
            <VKSignInButton
              onSuccess={handleVKSuccess}
              onError={(err) => console.error(err)}
            />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Или продолжите с email</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Email/Password Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                Email адрес
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
