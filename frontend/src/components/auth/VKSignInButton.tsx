/**
 * Компонент кнопки VK входа
 *
 * Отображает официальную кнопку VK ID и обрабатывает OAuth flow
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../store/authStore';
import type { VKIDAuthResponse } from '../../types/auth';

interface VKSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function VKSignInButton({ onSuccess, onError }: VKSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const { loginWithVK } = useAuth();

  const appId = import.meta.env.VITE_VK_APP_ID;

  useEffect(() => {
    // Проверка, настроен ли VK App ID
    if (!appId) {
      console.error('VK App ID не настроен. Установите VITE_VK_APP_ID в .env');
      setSdkError('VK вход не настроен');
      onError?.('VK вход не настроен');
      return;
    }

    const ensureVKSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (window.VKID) {
          resolve();
          return;
        }

        const existing = document.getElementById('vkid-sdk') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('VK ID SDK failed to load')), {
            once: true,
          });
          const readyState = (existing as any).readyState;
          if (readyState === 'complete' || readyState === 'loaded') {
            resolve();
          }
          return;
        }

        const script = document.createElement('script');
        script.id = 'vkid-sdk';
        script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('VK ID SDK failed to load'));
        document.body.appendChild(script);
      });

    const initializeVK = () => {
      if (!window.VKID) {
        console.warn('VK ID SDK ещё не загружен, повторная попытка...');
        return false;
      }

      try {
        window.VKID.Config.init({
          app: appId,
          redirectUrl: window.location.origin,
          scope: 'email phone',
        });

        if (containerRef.current && !buttonInstanceRef.current) {
          const button = new window.VKID.FloatingOneTapButton(containerRef.current);
          button.on('success', handleVKAuthResponse);
          button.render();
          buttonInstanceRef.current = button;
        }

        return true;
      } catch (error) {
        console.error('Ошибка инициализации VK ID SDK:', error);
        setSdkError('Ошибка загрузки VK входа');
        return false;
      }
    };

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const bootstrap = async () => {
      try {
        await ensureVKSdk();
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setSdkError('VK вход недоступен');
          onError?.('VK вход недоступен');
        }
        return;
      }

      if (initializeVK()) return;

      let retryCount = 0;
      const maxRetries = 20;
      const retryInterval = 500;

      intervalId = setInterval(() => {
        retryCount += 1;
        if (initializeVK()) {
          if (intervalId) clearInterval(intervalId);
        } else if (retryCount >= maxRetries) {
          if (intervalId) clearInterval(intervalId);
          if (!cancelled) {
            console.error('VK ID SDK не удалось загрузить после нескольких попыток');
            setSdkError('VK вход недоступен');
            onError?.('VK вход недоступен');
          }
        }
      }, retryInterval);
    };

    bootstrap();

    // Cleanup
    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (buttonInstanceRef.current) {
        try {
          buttonInstanceRef.current.destroy();
          buttonInstanceRef.current = null;
        } catch (error) {
          console.error('Ошибка при очистке VK ID кнопки:', error);
        }
      }
    };
  }, [appId, onError]);

  const handleVKAuthResponse = async (response: VKIDAuthResponse) => {
    setIsLoading(true);

    try {
      // Отправка silent token и UUID на backend
      await loginWithVK(response.token, response.uuid);

      // Успех
      onSuccess?.();
    } catch (error: any) {
      console.error('Ошибка VK входа:', error);
      const errorMessage =
        error.response?.data?.detail || error.message || 'VK вход не удался';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Показать ошибку, если VK App ID не настроен или SDK не загружен
  if (!appId || sdkError) {
    return (
      <div className="flex items-center justify-center p-3 border border-gray-300 rounded-md bg-gray-50">
        <span className="text-sm text-gray-500">
          {sdkError || 'VK вход не настроен'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Контейнер для кнопки VK ID */}
      <div
        ref={containerRef}
        className={isLoading ? 'opacity-50 pointer-events-none' : ''}
        style={{ minHeight: '44px' }}
      />

      {/* Фолбек если SDK не загрузился */}
      {!window.VKID && !sdkError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-md">
          <span className="text-sm text-gray-500">VK вход загружается...</span>
        </div>
      )}

      {/* Оверлей загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      )}
  </div>
  );
}
