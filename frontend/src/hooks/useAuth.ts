/**
 * useAuth hook
 *
 * Provides easy access to authentication state and actions
 */

import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    loginWithVK,
    loginWithVKPKCE,
    loginWithTelegram,
    logout,
    refreshProfile,
    clearError,
  } = useAuthStore();

  // Если есть токен, но профиль ещё не загружен — подтягиваем его тихо
  useEffect(() => {
    const fetchProfile = async () => {
      if (token && !user && !isLoading) {
        try {
          await refreshProfile();
        } catch {
          /* ignore refresh errors */
        }
      }
    };
    fetchProfile();
  }, [token, user, isLoading, refreshProfile]);

  // Auto-login on mount if not authenticated
  useEffect(() => {
    const attemptAutoLogin = async () => {
      // Skip if already authenticated or loading
      if (isAuthenticated || isLoading) {
        return;
      }

      // Telegram auto-login: оставляем только если пользователь действительно в Telegram
      if (window.Telegram?.WebApp) {
        try {
          await loginWithTelegram();
        } catch (error) {
          console.error('Ошибка автоматической авторизации Telegram:', error);
          // Error is already stored in state
        }
      }
    };

    attemptAutoLogin();
  }, []); // Run only on mount

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    error,

    // Actions
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    loginWithVK,
    loginWithVKPKCE,
    loginWithTelegram,
    logout,
    refreshProfile,
    clearError,

    // Computed values
    hasCredits: user ? user.balance_credits > 0 : false,
    canUseFreemium: user ? user.can_use_freemium : false,
    hasActiveSubscription: (() => {
      if (!user || !user.subscription_type || user.subscription_type === 'none') return false;
      const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
      return !!expiresAt && expiresAt > new Date();
    })(),
  };
};
