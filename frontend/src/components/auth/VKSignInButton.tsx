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
  className?: string;
  disabled?: boolean;
  consentVersion?: string;
}

export function VKSignInButton({ onSuccess, onError, className, disabled = false }: VKSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const appId = import.meta.env.VITE_VK_APP_ID;
  const redirectUri = import.meta.env.VITE_VK_REDIRECT_URI || `${window.location.origin}/vk/callback`;

  const handleClick = async () => {
    if (disabled) return;
    if (!appId) {
      onError?.('VK вход не настроен');
      return;
    }
    setIsLoading(true);
    try {
      // Уведомляем об успешном запуске флоу (до редиректа)
      onSuccess?.();
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
      disabled={isLoading || !appId || disabled}
      className={`w-full h-12 min-h-[48px] max-h-[48px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-sm font-semibold text-slate-900 leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 disabled:opacity-60 disabled:cursor-not-allowed transition ${className || ''}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect width="24" height="24" rx="6" fill="#0077FF" />
        <path d="M12.78 16.5c-4.8.17-7.83-3.18-7.92-8.56h2.57c.09 3.94 1.81 5.61 3.19 5.95v-5.95h2.41v3.38c1.47.15 2.52-1.57 2.96-3.38h2.4c-.12 3.44-2.95 6.12-5.38 6.33.49 1.69.61 2.07 2.07 2.07h.56v2.12c-.1 0-2.3.14-3.86-2.07z" fill="white" />
      </svg>
      {isLoading ? 'Переходим в VK ID...' : 'Войти через VK ID'}
    </button>
  );
}
