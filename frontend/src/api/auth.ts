/**
 * Auth API client
 *
 * Handles authentication requests to backend
 */

import apiClient from './client';
import type {
  TelegramAuthRequest,
  LoginResponse,
  UserProfile,
  AuthError,
} from '../types/auth';

/**
 * Login with Telegram initData
 *
 * @param initData - Telegram WebApp initData string
 * @returns LoginResponse with token and user profile
 * @throws AuthError if authentication fails
 */
export const loginWithTelegram = async (
  initData: string
): Promise<LoginResponse> => {
  try {
    const request: TelegramAuthRequest = { init_data: initData };

    const response = await apiClient.post<LoginResponse>(
      '/api/v1/auth/telegram',
      request
    );

    return response.data;
  } catch (error: any) {
    const authError: AuthError = {
      detail: error.response?.data?.detail || 'Ошибка авторизации',
    };
    throw authError;
  }
};

/**
 * Get current user profile
 *
 * @returns UserProfile
 * @throws AuthError if not authenticated
 */
export const getCurrentUser = async (): Promise<UserProfile> => {
  try {
    const response = await apiClient.get<{ user: UserProfile }>(
      '/api/v1/auth/me'
    );

    return response.data.user;
  } catch (error: any) {
    const authError: AuthError = {
      detail: error.response?.data?.detail || 'Не удалось получить профиль пользователя',
    };
    throw authError;
  }
};

/**
 * Refresh user profile from server
 *
 * @returns Updated UserProfile
 */
export const refreshUserProfile = async (): Promise<UserProfile> => {
  return getCurrentUser();
};
