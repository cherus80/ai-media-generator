import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { PD_CONSENT_VERSION } from '../constants/pdConsent';

export function YandexCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithYandex, clearError, pdConsentVersionAccepted } = useAuth();
  const [message, setMessage] = useState('Обрабатываем вход через Яндекс ID...');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const oauthError = params.get('error');
      const oauthErrorDescription = params.get('error_description');

      if (oauthError) {
        const errorText = oauthErrorDescription || oauthError;
        setMessage(`Яндекс вернул ошибку: ${errorText}`);
        return;
      }

      if (!code) {
        setMessage('Не удалось получить код авторизации Яндекс ID');
        return;
      }

      try {
        clearError();
        await loginWithYandex(
          code,
          pdConsentVersionAccepted || PD_CONSENT_VERSION
        );
        navigate('/app', { replace: true });
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.detail || err?.message || 'Не удалось завершить вход через Яндекс ID';
        setMessage(errMsg);
      }
    };

    run();
  }, [
    location.search,
    navigate,
    loginWithYandex,
    clearError,
    pdConsentVersionAccepted,
  ]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Яндекс ID</h1>
        <p className="text-sm text-gray-700">{message}</p>
      </div>
    </div>
  );
}
