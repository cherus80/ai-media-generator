import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PD_CONSENT_VERSION } from '../constants/pdConsent';
import { consumeRememberedAuthNextPath } from '../utils/safeRedirect';

type PKCECache = {
  code_verifier: string;
  state?: string;
  nonce?: string;
  device_id?: string;
  ts?: number;
};
const PKCE_STORAGE_KEY = 'vk_pkce';

const loadPkceFromStorage = (stateParam?: string): PKCECache | null => {
  // Пытаемся найти запись по state, иначе — по последнему сохраненному
  const stateKey = stateParam || localStorage.getItem(`${PKCE_STORAGE_KEY}:latest`) || undefined;
  if (!stateKey) return null;

  const raw = localStorage.getItem(`${PKCE_STORAGE_KEY}:${stateKey}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PKCECache;
    return parsed?.code_verifier ? parsed : null;
  } catch (err) {
    console.error('PKCE storage parse error', err);
    return null;
  }
};

const clearPkceFromStorage = (stateParam?: string) => {
  const stateKey = stateParam || localStorage.getItem(`${PKCE_STORAGE_KEY}:latest`) || undefined;
  if (stateKey) {
    localStorage.removeItem(`${PKCE_STORAGE_KEY}:${stateKey}`);
  }
  if (!stateParam) {
    localStorage.removeItem(`${PKCE_STORAGE_KEY}:latest`);
  }
};

export function VKCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithVKPKCE, clearError } = useAuth();

  const [message, setMessage] = useState('Обрабатываем вход через VK ID...');

  useEffect(() => {
    const run = async () => {
      const redirectUri = import.meta.env.VITE_VK_REDIRECT_URI || `${window.location.origin}/vk/callback`;
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state') || undefined;
      const deviceId = params.get('device_id') || undefined;

      if (!code) {
        setMessage('Не удалось получить код авторизации VK ID');
        return;
      }

      const cached = loadPkceFromStorage(state);
      if (!cached) {
        setMessage('Данные входа устарели. Начните авторизацию заново.');
        clearPkceFromStorage(state);
        return;
      }

      if (cached.state && state && cached.state !== state) {
        setMessage('Неверный state параметр. Попробуйте снова.');
        clearPkceFromStorage(state);
        return;
      }

      try {
        clearError();
        await loginWithVKPKCE({
          code,
          code_verifier: cached.code_verifier,
          redirect_uri: redirectUri,
          state,
          nonce: cached.nonce,
          device_id: deviceId || cached.device_id,
          consent_version: PD_CONSENT_VERSION,
        });
        clearPkceFromStorage(state);
        navigate(consumeRememberedAuthNextPath('/app'), { replace: true });
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
