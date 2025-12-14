/**
 * Zustand store for authentication state
 *
 * Supports:
 * - Email/Password authentication
 * - Google OAuth authentication
 * - VK OAuth authentication
 * - Legacy Telegram authentication (for backwards compatibility)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile, RegisterRequest, LoginRequest } from '../types/auth';
import {
  registerWithEmail as registerEmailAPI,
  loginWithEmail as loginEmailAPI,
  loginWithGoogle as loginGoogleAPI,
  loginWithVK as loginVKAPI,
  loginWithVKPKCE as loginVKPKCEAPI,
  getCurrentUser,
} from '../api/authWeb';
import { loginWithTelegram } from '../api/auth'; // Legacy Telegram auth
import { getTelegramInitData } from '../utils/telegram';
import type { VKOAuthPKCERequest } from '../types/auth';
import { PD_CONSENT_VERSION } from '../constants/pdConsent';

interface AuthState {
  // State
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pdConsentVersionAccepted: string | null;

  // Actions
  registerWithEmail: (data: RegisterRequest) => Promise<void>;
  loginWithEmail: (data: LoginRequest) => Promise<void>;
  loginWithGoogle: (idToken: string, consentVersion?: string) => Promise<void>;
  loginWithVK: (token: string, uuid: string, consentVersion?: string) => Promise<void>;
  loginWithVKPKCE: (payload: VKOAuthPKCERequest) => Promise<void>;
  loginWithTelegram: () => Promise<void>; // Legacy
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  setToken: (token: string) => void;
  setPdConsentAccepted: (version: string | null) => void;
  clearError: () => void;

  // Computed values
  hasCredits: boolean;
  canUseFreemium: boolean;
  hasActiveSubscription: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const computeAccessFlags = (user: UserProfile | null) => {
        const hasActiveSubscription =
          !!user?.subscription_type &&
          user.subscription_type !== 'none' &&
          !!user.subscription_expires_at &&
          new Date(user.subscription_expires_at) > new Date();

        return {
          hasCredits: (user?.balance_credits ?? 0) > 0,
          canUseFreemium: user?.can_use_freemium ?? false,
          hasActiveSubscription,
          isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
          isSuperAdmin: user?.role === 'SUPER_ADMIN',
        };
      };

      return {
        // Initial state
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        pdConsentVersionAccepted: null,
        ...computeAccessFlags(null),

        // Register with Email/Password
        registerWithEmail: async (data: RegisterRequest) => {
          // Если профиль уже есть и не запрашивали принудительно — избегаем лишнего спиннера
          if (get().user) {
            try {
              const profile = await getCurrentUser();
              const user = profile.user;
              set({ user, isLoading: false, error: null, ...computeAccessFlags(user) });
              return;
            } catch {
              // просто падаем к обычной логике
            }
          }

          set({ isLoading: true, error: null });

          try {
            const response = await registerEmailAPI(data);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              pdConsentVersionAccepted: data.consent_version || PD_CONSENT_VERSION,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.detail || error.message || 'Не удалось завершить регистрацию';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Login with Email/Password
        loginWithEmail: async (data: LoginRequest) => {
          set({ isLoading: true, error: null });

          try {
            const response = await loginEmailAPI(data);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              pdConsentVersionAccepted: data.consent_version || PD_CONSENT_VERSION,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage = error.response?.data?.detail || error.message || 'Ошибка входа';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Login with Google OAuth
        loginWithGoogle: async (idToken: string, consentVersion?: string) => {
          set({ isLoading: true, error: null });

          try {
            const response = await loginGoogleAPI(idToken, consentVersion);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              pdConsentVersionAccepted: consentVersion || PD_CONSENT_VERSION,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.detail || error.message || 'Не удалось войти через Google';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Login with VK OAuth
        loginWithVK: async (token: string, uuid: string, consentVersion?: string) => {
          set({ isLoading: true, error: null });

          try {
            const response = await loginVKAPI(token, uuid, consentVersion);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              pdConsentVersionAccepted: consentVersion || PD_CONSENT_VERSION,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.detail || error.message || 'Не удалось войти через VK';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Login with VK OAuth (PKCE)
        loginWithVKPKCE: async (payload: VKOAuthPKCERequest) => {
          set({ isLoading: true, error: null });

          try {
            const response = await loginVKPKCEAPI(payload);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.detail || error.message || 'Не удалось войти через VK';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Legacy Telegram login
        loginWithTelegram: async () => {
          set({ isLoading: true, error: null });

          try {
            const initData = getTelegramInitData();

            if (!initData) {
              throw new Error(
                'Telegram data not available. Please open this app in Telegram.'
              );
            }

            const response = await loginWithTelegram(initData);

            set({
              token: response.access_token,
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              ...computeAccessFlags(response.user),
            });
          } catch (error: any) {
            const errorMessage =
              error.response?.data?.detail || error.message || 'Не удалось войти через Telegram';
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              ...computeAccessFlags(null),
            });

            throw error;
          }
        },

        // Logout action
        logout: () => {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            ...computeAccessFlags(null),
          });

          // Zustand persist will automatically clear localStorage when state is null
        },

        // Refresh user profile from server
        refreshProfile: async () => {
          const { token } = get();

          // Нет токена — просто выходим, сбрасывая флаги загрузки/ошибки
          if (!token) {
            set({ isLoading: false, error: null, ...computeAccessFlags(null) });
            return;
          }

          try {
            const profile = await getCurrentUser();
            const user = profile.user;

            set({
              user,
              error: null,
              ...computeAccessFlags(user),
            });
          } catch (error: any) {
            const errorMessage = error.detail || 'Не удалось обновить профиль';
            set({
              error: errorMessage,
            });

            throw error;
          }
        },

        // Set user (used after successful operations that return updated user)
        setUser: (user: UserProfile) => {
          set({ user, ...computeAccessFlags(user) });
          // Zustand persist automatically updates localStorage
        },

        // Set token (used for manual token updates)
        setToken: (token: string) => {
          set({ token, isAuthenticated: true });
          // Zustand persist automatically updates localStorage
        },

        // Save accepted PD consent version
        setPdConsentAccepted: (version: string | null) => {
          set({ pdConsentVersionAccepted: version });
        },

        // Clear error
        clearError: () => {
          set({ error: null });
        },

        // Computed values cached in store (updated through computeAccessFlags)
        hasCredits: false,
        canUseFreemium: false,
        hasActiveSubscription: false,
        isAdmin: false,
      };
    },
    {
      name: 'auth-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist token and user, not loading/error states
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        pdConsentVersionAccepted: state.pdConsentVersionAccepted,
      }),
      onRehydrateStorage: () => {
        console.log('🔄 Начинаем восстановление состояния авторизации из localStorage');
        return (state, error) => {
          if (error) {
            console.error('❌ Ошибка восстановления состояния:', error);
          } else if (state) {
            // Recompute access flags from rehydrated user
            const computeAccessFlags = (user: UserProfile | null) => {
              const hasActiveSubscription =
                !!user?.subscription_type &&
                user.subscription_type !== 'none' &&
                !!user.subscription_expires_at &&
                new Date(user.subscription_expires_at) > new Date();

              return {
                hasCredits: (user?.balance_credits ?? 0) > 0,
                canUseFreemium: user?.can_use_freemium ?? false,
                hasActiveSubscription,
                isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
                isSuperAdmin: user?.role === 'SUPER_ADMIN',
              };
            };

            // Apply computed flags to rehydrated state
            Object.assign(state, computeAccessFlags(state.user));

            console.log('✅ Состояние авторизации восстановлено:', {
              hasToken: !!state.token,
              isAuthenticated: state.isAuthenticated,
              hasUser: !!state.user,
              isAdmin: state.isAdmin,
              role: state.user?.role,
              pdConsentVersionAccepted: state.pdConsentVersionAccepted,
            });
          }
        };
      },
    }
  )
);

// Export hook for convenience
export function useAuth() {
  return useAuthStore();
}
