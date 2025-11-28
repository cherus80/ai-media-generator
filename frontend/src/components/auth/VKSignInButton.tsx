/**
 * Компонент кнопки VK входа (PKCE)
 *
 * Запускает PKCE-флоу через redirect на id.vk.ru/authorize
 */

import { useState } from 'react';
import { startVKPKCEAuth } from '../../utils/pkce';

interface VKSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function VKSignInButton({ onSuccess, onError }: VKSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const appId = import.meta.env.VITE_VK_APP_ID;
  const redirectUri = `${window.location.origin}/vk/callback`;

  const handleClick = async () => {
    if (!appId) {
      onError?.('VK вход не настроен');
      return;
    }
    setIsLoading(true);
    try {
      await startVKPKCEAuth({
        appId,
        redirectUri,
        scope: 'email phone',
      });
      // Redirect happens immediately, no onSuccess here
    } catch (error: any) {
      console.error('Ошибка запуска VK PKCE:', error);
      const errorMessage = error?.message || 'VK вход недоступен';
      setIsLoading(false);
      onError?.(errorMessage);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || !appId}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="#0077FF"
        aria-hidden="true"
      >
        <path d="M3 5c.1 5.5 2.8 9.2 7.6 9.4h.3v-3c1.7.2 3-.7 3.5-2.6h2.4c-.3 1.8-1.7 3-3.4 3.3V17h-2v-2.8C7.9 14 6 11 6 7h-.9L3 5Z" />
      </svg>
      {isLoading ? 'Переходим в VK ID...' : 'Войти через VK ID'}
    </button>
  );
}
