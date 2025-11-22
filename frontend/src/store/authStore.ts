/**
 * Zustand store for authentication state
 *
 * Supports:
 * - Email/Password authentication
 * - Google OAuth authentication
 * - Legacy Telegram authentication (for backwards compatibility)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile, RegisterRequest, LoginRequest } from '../types/auth';
import {
  registerWithEmail as registerEmailAPI,
  loginWithEmail as loginEmailAPI,
  loginWithGoogle as loginGoogleAPI,
  getCurrentUser,
} from '../api/authWeb';
import { loginWithTelegram } from '../api/auth'; // Legacy Telegram auth
import { getTelegramInitData } from '../utils/telegram';

interface AuthState {
  // State
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  registerWithEmail: (data: RegisterRequest) => Promise<void>;
  loginWithEmail: (data: LoginRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithTelegram: () => Promise<void>; // Legacy
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  setToken: (token: string) => void;
  clearError: () => void;

  // Computed values
  hasCredits: boolean;
  canUseFreemium: boolean;
  hasActiveSubscription: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Register with Email/Password
      registerWithEmail: async (data: RegisterRequest) => {
        // Если профиль уже есть и не запрашивали принудительно — избегаем лишнего спиннера
        if (get().user) {
          try {
            const user = await getCurrentUser();
            set({ user, isLoading: false, error: null });
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
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.detail || error.message || 'Registration failed';
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
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
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || error.message || 'Login failed';
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });

          throw error;
        }
      },

      // Login with Google OAuth
      loginWithGoogle: async (idToken: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await loginGoogleAPI(idToken);

          set({
            token: response.access_token,
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.detail || error.message || 'Google login failed';
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
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
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.detail || error.message || 'Telegram login failed';
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
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
        });

        // Zustand persist will automatically clear localStorage when state is null
      },

      // Refresh user profile from server
      refreshProfile: async () => {
        const { token } = get();

        // Нет токена — просто выходим, сбрасывая флаги загрузки/ошибки
        if (!token) {
          set({ isLoading: false, error: null });
          return;
        }

        try {
          const user = await getCurrentUser();

          set({
            user,
            error: null,
          });

          // Zustand persist automatically updates localStorage
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
        set({ user });
        // Zustand persist automatically updates localStorage
      },

      // Set token (used for manual token updates)
      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
        // Zustand persist automatically updates localStorage
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Computed values
      get hasCredits() {
        const { user } = get();
        return (user?.balance_credits ?? 0) > 0;
      },

      get canUseFreemium() {
        const { user } = get();
        return user?.can_use_freemium ?? false;
      },

      get hasActiveSubscription() {
        const { user } = get();
        if (!user?.subscription_type || !user?.subscription_expires_at) {
          return false;
        }
        return new Date(user.subscription_expires_at) > new Date();
      },
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist token and user, not loading/error states
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Export hook for convenience
export function useAuth() {
  return useAuthStore();
}
