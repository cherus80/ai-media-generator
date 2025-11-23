/**
 * Referral API Client
 * API клиент для работы с реферальной программой
 */

import apiClient from './client';

/**
 * Информация о реферале
 */
export interface ReferralItem {
  id: number;
  telegram_id: number;
  username: string | null;
  credits_awarded: number;
  is_awarded: boolean;
  created_at: string;
}

/**
 * Ответ с реферальной ссылкой
 */
export interface ReferralLinkResponse {
  referral_link: string;
  referral_code: string;
  total_referrals: number;
  total_earned: number;
}

/**
 * Запрос на регистрацию по реферальному коду
 */
export interface ReferralRegisterRequest {
  referral_code: string;
}

/**
 * Ответ после регистрации по реферальному коду
 */
export interface ReferralRegisterResponse {
  success: boolean;
  message: string;
  bonus_credits: number;
}

/**
 * Статистика по рефералам
 */
export interface ReferralStatsResponse {
  total_referrals: number;
  active_referrals: number;
  pending_referrals: number;
  total_earned: number;
  referrals: ReferralItem[];
  referral_link: string;
  referral_code: string;
}

/**
 * Получить реферальную ссылку текущего пользователя
 * @returns Реферальная ссылка и статистика
 */
export const getReferralLink = async (): Promise<ReferralLinkResponse> => {
  const response = await apiClient.get<ReferralLinkResponse>(
    '/api/v1/referrals/link'
  );
  return response.data;
};

/**
 * Зарегистрировать пользователя по реферальному коду
 * @param request - Реферальный код
 * @returns Результат регистрации
 */
export const registerReferral = async (
  request: ReferralRegisterRequest
): Promise<ReferralRegisterResponse> => {
  const response = await apiClient.post<ReferralRegisterResponse>(
    '/api/v1/referrals/register',
    request
  );
  return response.data;
};

/**
 * Получить статистику по рефералам
 * @returns Статистика: количество рефералов, заработанные кредиты, список рефералов
 */
export const getReferralStats = async (): Promise<ReferralStatsResponse> => {
  const response = await apiClient.get<ReferralStatsResponse>(
    '/api/v1/referrals/stats'
  );
  return response.data;
};

/**
 * Скопировать реферальную ссылку в буфер обмена
 * @param link - Реферальная ссылка
 * @returns true если успешно скопировано
 */
export const copyReferralLink = async (link: string): Promise<boolean> => {
  try {
    // Используем Telegram WebApp API для копирования, если доступно
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(`Ссылка скопирована:\n${link}`);
    }

    // Копируем в буфер обмена
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    console.error('Failed to copy referral link:', error);
    return false;
  }
};

/**
 * Поделиться реферальной ссылкой
 * Использует Web Share API если доступен, иначе копирует в буфер обмена
 * @param link - Реферальная ссылка
 * @param text - Текст сообщения
 */
export const shareReferralLink = async (link: string, text?: string): Promise<void> => {
  const message = text || 'Join AI Image Generator and get bonus credits!';

  // Проверяем поддержку Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'AI Image Generator',
        text: message,
        url: link,
      });
      console.log('Successfully shared via Web Share API');
    } catch (error) {
      // Пользователь отменил шаринг или произошла ошибка
      console.log('Share cancelled or failed:', error);
      // Fallback: копируем в буфер обмена
      await copyReferralLink(link);
    }
  } else {
    // Fallback: копируем в буфер обмена
    await copyReferralLink(link);
    alert('Link copied to clipboard! Share it with your friends.');
  }
};
