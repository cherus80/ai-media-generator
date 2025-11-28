/**
 * Web Authentication API Client
 *
 * Handles Email/Password, Google OAuth, and VK OAuth authentication
 */

import client from './client';
import type {
  RegisterRequest,
  LoginRequest,
  GoogleOAuthRequest,
  VKOAuthRequest,
  LoginResponse,
  GoogleOAuthResponse,
  VKOAuthResponse,
  VKOAuthPKCERequest,
  UserProfileResponse,
  SendVerificationEmailResponse,
  VerifyEmailResponse,
} from '../types/auth';

/**
 * Register a new user with email and password
 */
export async function registerWithEmail(data: RegisterRequest): Promise<LoginResponse> {
  const response = await client.post<LoginResponse>('/api/v1/auth-web/register', data);
  return response.data;
}

/**
 * Login with email and password
 */
export async function loginWithEmail(data: LoginRequest): Promise<LoginResponse> {
  const response = await client.post<LoginResponse>('/api/v1/auth-web/login', data);
  return response.data;
}

/**
 * Login or register with Google OAuth
 */
export async function loginWithGoogle(idToken: string): Promise<GoogleOAuthResponse> {
  const data: GoogleOAuthRequest = { id_token: idToken };
  const response = await client.post<GoogleOAuthResponse>('/api/v1/auth-web/google', data);
  return response.data;
}

/**
 * Login or register with VK OAuth
 */
export async function loginWithVK(token: string, uuid: string): Promise<VKOAuthResponse> {
  const data: VKOAuthRequest = { token, uuid };
  const response = await client.post<VKOAuthResponse>('/api/v1/auth-web/vk', data);
  return response.data;
}

/**
 * Login or register with VK OAuth 2.1 (PKCE)
 */
export async function loginWithVKPKCE(payload: VKOAuthPKCERequest): Promise<VKOAuthResponse> {
  const response = await client.post<VKOAuthResponse>('/api/v1/auth-web/vk/pkce', payload);
  return response.data;
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<UserProfileResponse> {
  const response = await client.get<UserProfileResponse>('/api/v1/auth-web/me');
  return response.data;
}

/**
 * Refresh user profile (fetch latest data from server)
 */
export async function refreshUserProfile(): Promise<UserProfileResponse> {
  return getCurrentUser();
}

/**
 * Logout (client-side only - clears token)
 */
export function logout(): void {
  // Token is cleared in authStore
  // Could add server-side logout endpoint in the future (e.g., token blacklist)
}

// ============================================================================
// Email Verification
// ============================================================================

/**
 * Send verification email to current user
 * Requires authentication
 */
export async function sendVerificationEmail(): Promise<SendVerificationEmailResponse> {
  const response = await client.post<SendVerificationEmailResponse>(
    '/api/v1/auth-web/send-verification'
  );
  return response.data;
}

/**
 * Verify email with token
 * No authentication required
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const response = await client.get<VerifyEmailResponse>(
    `/api/v1/auth-web/verify?token=${encodeURIComponent(token)}`
  );
  return response.data;
}
