/**
 * Компонент кнопки Google входа
 *
 * Отображает официальную кнопку Google и обрабатывает OAuth flow
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../store/authStore';
import type { GoogleSignInResponse, GoogleSignInButtonConfig } from '../../types/auth';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  width?: number;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'signin_with',
  theme = 'outline',
  size = 'large',
  width,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithGoogle } = useAuth();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    // Проверка, настроен ли client ID
    if (!clientId) {
      console.error('Google Client ID не настроен. Установите VITE_GOOGLE_CLIENT_ID в .env');
      onError?.('Google вход не настроен');
      return;
    }

    // Ожидание загрузки Google Identity Services
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        console.warn('Google Identity Services ещё не загружен, повторная попытка...');
        return false;
      }

      try {
        // Инициализация Google входа
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Отрисовка кнопки
        if (buttonRef.current) {
          const config: GoogleSignInButtonConfig = {
            type: 'standard',
            theme,
            size,
            text,
            shape: 'rectangular',
            logo_alignment: 'left',
          };

          if (width) {
            config.width = width;
          }

          window.google.accounts.id.renderButton(buttonRef.current, config);
        }
        return true;
      } catch (error) {
        console.error('Ошибка инициализации Google входа:', error);
        return false;
      }
    };

    // Попытка инициализации сразу
    if (initializeGoogle()) {
      return;
    }

    // Если не загружен, повторять с интервалом
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 500; // 500ms

    const intervalId = setInterval(() => {
      retryCount++;

      if (initializeGoogle()) {
        clearInterval(intervalId);
      } else if (retryCount >= maxRetries) {
        clearInterval(intervalId);
        console.error('Google Identity Services не удалось загрузить после нескольких попыток');
        onError?.('Google вход недоступен');
      }
    }, retryInterval);

    return () => clearInterval(intervalId);
  }, [clientId, theme, size, text, width]);

  const handleCredentialResponse = async (response: GoogleSignInResponse) => {
    setIsLoading(true);

    try {
      // Отправка ID токена на backend
      await loginWithGoogle(response.credential);

      // Успех
      onSuccess?.();
    } catch (error: any) {
      console.error('Ошибка Google входа:', error);
      const errorMessage =
        error.response?.data?.detail || error.message || 'Google вход не удался';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Показать состояние загрузки или заглушку, если Google не загружен или нет client ID
  if (!clientId) {
    return (
      <div className="flex items-center justify-center p-3 border border-gray-300 rounded-md bg-gray-50">
        <span className="text-sm text-gray-500">Google вход не настроен</span>
      </div>
    );
  }

  if (!window.google?.accounts?.id) {
    return (
      <div className="flex items-center justify-center p-3 border border-gray-300 rounded-md bg-gray-50">
        <span className="text-sm text-gray-500">Загрузка Google входа...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Здесь будет отрисована кнопка Google */}
      <div ref={buttonRef} className={isLoading ? 'opacity-50 pointer-events-none' : ''} />

      {/* Оверлей загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
