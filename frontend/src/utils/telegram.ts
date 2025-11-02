/**
 * Telegram WebApp SDK utilities
 *
 * Provides helper functions for working with Telegram Mini App
 */

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import type { TelegramUser } from '../types/auth';

/**
 * Check if the app is running inside Telegram
 */
export const isTelegramWebApp = (): boolean => {
  try {
    const launchParams = retrieveLaunchParams();
    return !!launchParams;
  } catch {
    return false;
  }
};

/**
 * Get Telegram initData string for backend authentication
 *
 * @returns initData string or null if not in Telegram
 */
export const getTelegramInitData = (): string | null => {
  try {
    const launchParams = retrieveLaunchParams();
    return launchParams.initDataRaw || null;
  } catch (error) {
    console.error('Failed to get Telegram initData:', error);
    return null;
  }
};

/**
 * Get Telegram user data from WebApp
 *
 * @returns TelegramUser object or null
 */
export const getTelegramUser = (): TelegramUser | null => {
  try {
    const launchParams = retrieveLaunchParams();
    const user = launchParams.initData?.user;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username,
      language_code: user.languageCode,
      is_premium: user.isPremium,
    };
  } catch (error) {
    console.error('Failed to get Telegram user:', error);
    return null;
  }
};

/**
 * Get Telegram theme parameters
 */
export const getTelegramTheme = () => {
  try {
    const launchParams = retrieveLaunchParams();
    return launchParams.themeParams;
  } catch {
    return null;
  }
};

/**
 * Close Telegram WebApp
 */
export const closeTelegramWebApp = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    }
  } catch (error) {
    console.error('Failed to close Telegram WebApp:', error);
  }
};

/**
 * Show Telegram WebApp main button
 */
export const showMainButton = (text: string, onClick: () => void) => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const { MainButton } = window.Telegram.WebApp;
      MainButton.setText(text);
      MainButton.onClick(onClick);
      MainButton.show();
    }
  } catch (error) {
    console.error('Failed to show main button:', error);
  }
};

/**
 * Hide Telegram WebApp main button
 */
export const hideMainButton = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.MainButton.hide();
    }
  } catch (error) {
    console.error('Failed to hide main button:', error);
  }
};

/**
 * Expand Telegram WebApp to full height
 */
export const expandTelegramWebApp = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
    }
  } catch (error) {
    console.error('Failed to expand Telegram WebApp:', error);
  }
};

/**
 * Enable closing confirmation
 */
export const enableClosingConfirmation = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.enableClosingConfirmation();
    }
  } catch (error) {
    console.error('Failed to enable closing confirmation:', error);
  }
};

/**
 * Disable closing confirmation
 */
export const disableClosingConfirmation = () => {
  try {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.disableClosingConfirmation();
    }
  } catch (error) {
    console.error('Failed to disable closing confirmation:', error);
  }
};

// Telegram WebApp types are defined in telegram.d.ts
