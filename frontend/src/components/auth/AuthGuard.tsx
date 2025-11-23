/**
 * AuthGuard component
 *
 * Protects routes that require authentication
 * Shows loading state during authentication
 * Redirects to error page if authentication fails
 */

import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingPage } from '../../pages/LoadingPage';
import { isTelegramWebApp } from '../../utils/telegram';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { isAuthenticated, isLoading, error, token } = useAuth();
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Ждем восстановления состояния из localStorage
  React.useEffect(() => {
    // Даем zustand время восстановить состояние из localStorage
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 500); // 500ms для надежного восстановления

    return () => clearTimeout(timer);
  }, []);

  // Check if running in Telegram
  const inTelegram = isTelegramWebApp();
  const isDev = import.meta.env.DEV; // Vite development mode

  // Not in Telegram - show error (skip check in dev mode)
  if (!inTelegram && !isDev) {
    return fallback || (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-gray-900 p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
            Недопустимый доступ
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Это приложение должно быть открыто через Telegram.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Пожалуйста, используйте официальное приложение Telegram для доступа к этому сервису.
          </p>
        </div>
      </div>
    );
  }

  // DEV MODE: Show dev badge when running locally
  if (isDev && !inTelegram) {
    console.log('🔧 Работает в DEV режиме без Telegram');
  }

  // Ждем гидратации состояния из localStorage
  if (!isHydrated) {
    return <LoadingPage message="Загрузка..." />;
  }

  // Loading - show loading page
  if (isLoading) {
    return <LoadingPage message="Авторизация..." />;
  }

  // Error - show error page
  if (error && !isAuthenticated) {
    return fallback || (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50 dark:bg-gray-900 p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
            Ошибка авторизации
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback - redirect to login (только после гидратации)
  return <Navigate to="/login" replace />;
};
