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
  shape?: GoogleSignInButtonConfig['shape'];
  className?: string;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  shape = 'rectangular',
  width,
  className,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const styleGuardLock = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState<boolean>(Boolean(window.google?.accounts?.id));
  const { loginWithGoogle } = useAuth();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const applyUnifiedStyles = (button: HTMLDivElement | null, state: 'default' | 'hover' | 'active' | 'focus' = 'default') => {
    if (!button || styleGuardLock.current) return;

    styleGuardLock.current = true;

    const baseShadow = '0 1px 2px rgba(15, 23, 42, 0.04)';
    const background =
      state === 'active' ? '#f1f5f9' : state === 'hover' ? '#f8fafc' : '#ffffff';
    const focusRing =
      state === 'focus' ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : baseShadow;

    button.style.width = '100%';
    button.style.maxWidth = '100%';
    button.style.minHeight = '48px';
    button.style.height = '48px';
    button.style.borderRadius = '12px';
    button.style.background = background;
    button.style.border = '1px solid #E5E7EB';
    button.style.boxShadow = focusRing;
    button.style.fontWeight = '600';
    button.style.fontSize = '14px';
    button.style.fontFamily = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
    button.style.letterSpacing = '0.01em';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '10px';
    button.style.padding = '0 16px';
    button.style.boxSizing = 'border-box';
    button.style.color = '#0f172a';
    button.style.cursor = 'pointer';
    button.style.transition =
      'background-color 150ms ease, box-shadow 180ms ease, transform 120ms ease, border-color 150ms ease';
    button.style.outline = 'none';
    button.style.transform = state === 'active' ? 'translateY(0.5px)' : 'none';

    const label = button.querySelector('span');
    if (label) {
      label.style.color = '#0f172a';
      label.style.fontWeight = '600';
      label.style.fontSize = '14px';
    }

    const logo = button.querySelector('svg');
    if (logo) {
      logo.style.height = '20px';
      logo.style.width = '20px';
    }

    requestAnimationFrame(() => {
      styleGuardLock.current = false;
    });
  };

  const bindStyleGuards = (button: HTMLDivElement | null) => {
    if (!button) return () => {};

    applyUnifiedStyles(button);

    const observer = new MutationObserver(() => applyUnifiedStyles(button));
    observer.observe(button, { attributes: true, attributeFilter: ['style', 'class'] });

    const events: Array<[keyof HTMLElementEventMap, 'default' | 'hover' | 'active' | 'focus']> = [
      ['mouseenter', 'hover'],
      ['mouseleave', 'default'],
      ['focus', 'focus'],
      ['blur', 'default'],
      ['mousedown', 'active'],
      ['mouseup', 'hover'],
    ];

    const handlers = events.map(([event, state]) => {
      const handler = () => applyUnifiedStyles(button, state);
      button.addEventListener(event, handler);
      return { event, handler };
    });

    return () => {
      observer.disconnect();
      handlers.forEach(({ event, handler }) => button.removeEventListener(event, handler));
    };
  };

  const ensureScriptLoaded = () => {
    if (window.google?.accounts?.id) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-gis-sdk]');
      if (existing && (existing as any)._gisReady) {
        resolve(true);
        return;
      }
      const script = existing || document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.gisSdk = '1';
      (script as any)._gisReady = false;
      script.onload = () => {
        (script as any)._gisReady = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      if (!existing) document.head.appendChild(script);
    });
  };

  useEffect(() => {
    // Проверка, настроен ли client ID
    if (!clientId) {
      console.error('Google Client ID не настроен. Установите VITE_GOOGLE_CLIENT_ID в .env');
      onError?.('Google вход не настроен');
      return;
    }

    let cancelled = false;

    const init = async () => {
      cleanupRef.current?.();

      const loaded = await ensureScriptLoaded();
      if (!loaded || cancelled || !window.google?.accounts?.id) {
        console.error('Google Identity Services не удалось загрузить');
        onError?.('Google вход недоступен');
        return;
      }

      try {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
          buttonRef.current.style.height = '48px';
          buttonRef.current.style.minHeight = '48px';
          buttonRef.current.style.maxHeight = '48px';
          buttonRef.current.style.width = '100%';
          buttonRef.current.style.borderRadius = '12px';
          buttonRef.current.style.overflow = 'hidden';

          const config: GoogleSignInButtonConfig = {
            type: 'standard',
            theme,
            size,
            text, // используем выбранный вариант текста
            shape,
            logo_alignment: 'left',
            width,
          };

          window.google.accounts.id.renderButton(buttonRef.current, config);

          const renderedButton = buttonRef.current.querySelector('div[role="button"]') as HTMLDivElement | null;
          if (renderedButton) {
            cleanupRef.current = bindStyleGuards(renderedButton);
          }
        }
        setIsReady(true);
      } catch (error) {
        console.error('Ошибка инициализации Google входа:', error);
        onError?.('Google вход недоступен');
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, [clientId, theme, size, text, width, shape]);

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
      <div className="flex items-center justify-center p-3 h-12 min-h-[48px] max-h-[48px] rounded-xl border border-slate-200 bg-white shadow-sm">
        <span className="text-sm text-gray-500">Google вход не настроен</span>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-3 h-12 min-h-[48px] max-h-[48px] rounded-xl border border-slate-200 bg-white shadow-sm">
        <span className="text-sm text-gray-500">Загрузка Google входа...</span>
      </div>
    );
  }

  return (
    <div
      className={`relative h-12 min-h-[48px] max-h-[48px] w-full ${className || ''}`}
    >
      {/* Здесь будет отрисована кнопка Google */}
      <div
        ref={buttonRef}
        className={`h-full flex items-stretch justify-center ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      />

      {/* Оверлей загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
