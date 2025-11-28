import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type PKCECache = {
  code_verifier: string;
  state?: string;
  nonce?: string;
  device_id?: string;
  ts?: number;
};

const PKCE_STORAGE_KEY = 'vk_pkce';

export function VKCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithVKPKCE, clearError } = useAuth();

  const [message, setMessage] = useState('Обрабатываем вход через VK ID...');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state') || undefined;
      const deviceId = params.get('device_id') || undefined;

      if (!code) {
        setMessage('Не удалось получить код авторизации VK ID');
        return;
      }

      const cachedRaw = localStorage.getItem(PKCE_STORAGE_KEY);
      if (!cachedRaw) {
        setMessage('PKCE данные не найдены. Попробуйте снова начать вход.');
        return;
      }

      let cached: PKCECache | null = null;
      try {
        cached = JSON.parse(cachedRaw) as PKCECache;
      } catch (err) {
        console.error('Не удалось распарсить PKCE кэш', err);
        setMessage('Ошибка обработки PKCE данных. Попробуйте снова.');
        return;
      }

      if (cached.state && state && cached.state !== state) {
        setMessage('Неверный state параметр. Попробуйте снова.');
        return;
      }

      try {
        clearError();
        const redirectUri = `${window.location.origin}/vk/callback`;
        await loginWithVKPKCE({
          code,
          code_verifier: cached.code_verifier,
          redirect_uri: redirectUri,
          state,
          nonce: cached.nonce,
          device_id: deviceId || cached.device_id,
        });
        localStorage.removeItem(PKCE_STORAGE_KEY);
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('VK PKCE callback error', err);
        const errMsg = err?.response?.data?.detail || err?.message || 'Не удалось завершить вход';
        setMessage(errMsg);
      }
    };

    run();
  }, [location.search, navigate, loginWithVKPKCE, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">VK ID</h1>
        <p className="text-sm text-gray-700">{message}</p>
      </div>
    </div>
  );
}
