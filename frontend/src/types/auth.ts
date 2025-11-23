/**
 * Authentication Types — TypeScript типы для веб-авторизации
 *
 * Поддерживает:
 * - Email/Password регистрацию и вход
 * - Google OAuth авторизацию
 * - Legacy Telegram авторизацию (для обратной совместимости)
 */

// ============================================================================
// Auth Providers
// ============================================================================

export type AuthProvider = 'email' | 'google' | 'telegram';

// ============================================================================
// Email/Password Registration & Login
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ============================================================================
// Google OAuth
// ============================================================================

export interface GoogleOAuthRequest {
  id_token: string; // Google ID token (JWT) from Google Sign-In
}

export interface GoogleOAuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
  is_new_user: boolean; // True if this is a new user registration
}

// ============================================================================
// Legacy Telegram (для обратной совместимости)
// ============================================================================

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramAuthRequest {
  init_data: string;
}

// ============================================================================
// User Profile (универсальный для всех типов авторизации)
// ============================================================================

export interface UserProfile {
  id: number;

  // Auth method
  auth_provider: AuthProvider;

  // Email (for web users)
  email?: string;
  email_verified: boolean;

  // Legacy Telegram (optional)
  telegram_id?: number;

  // Profile
  username?: string;
  first_name?: string;
  last_name?: string;

  // Balance & Subscription
  balance_credits: number;
  subscription_type?: 'basic' | 'pro' | 'premium';
  subscription_expires_at?: string;

  // Freemium
  freemium_actions_used: number;
  freemium_reset_at: string;
  can_use_freemium: boolean;

  // Status
  is_blocked: boolean;
  created_at: string;
  last_activity_at: string;

  // Role
  role: 'USER' | 'ADMIN'; // User role for admin panel access

  // Referral
  referral_code: string;
  referred_by_id?: number;
}

// ============================================================================
// Common Response Types
// ============================================================================

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface UserProfileResponse {
  user: UserProfile;
}

export interface AuthError {
  detail: string;
}

// ============================================================================
// Password Management
// ============================================================================

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

// ============================================================================
// Email Verification
// ============================================================================

export interface SendVerificationEmailResponse {
  message: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: UserProfile;
}

// ============================================================================
// Form Validation
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  general?: string;
}

// ============================================================================
// Password Strength
// ============================================================================

export interface PasswordStrength {
  score: number; // 0-4 (weak to strong)
  feedback: string[];
  isStrong: boolean;
}

// ============================================================================
// Google Sign-In Types (from Google Identity Services)
// ============================================================================

export interface GoogleSignInResponse {
  credential: string; // ID token (JWT)
  select_by?: string;
}

export interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleSignInResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
}

export interface GoogleSignInButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

// Window extension for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: GoogleSignInButtonConfig
          ) => void;
          disableAutoSelect: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
      };
    };
  }
}
