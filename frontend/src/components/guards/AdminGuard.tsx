/**
 * Admin Guard - Защита маршрутов админки.
 *
 * Проверяет, что пользователь авторизован и имеет роль ADMIN.
 * Если нет - перенаправляет на главную страницу с сообщением об ошибке.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Если загрузка завершена и пользователь не авторизован или не админ
    if (!isLoading) {
      if (!isAuthenticated) {
        // Не авторизован - перенаправляем на страницу входа
        navigate('/login', {
          state: { message: 'Требуется авторизация для доступа к админ-панели' },
        });
      } else if (!isAdmin) {
        // Авторизован, но не админ - перенаправляем на главную
        navigate('/', {
          state: { message: 'У вас нет прав доступа к админ-панели' },
        });
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate]);

  // Показываем загрузку пока проверяем права
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован или не админ - ничего не отображаем (идет редирект)
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  // Все проверки пройдены - отображаем защищенный контент
  return <>{children}</>;
};
