/**
 * Payment TypeScript Types
 * Типы для монетизации и платёжной системы (ЮKassa)
 */

/**
 * Тип платежа
 */
export type PaymentType = 'subscription' | 'credits';

/**
 * Тип подписки
 */
export type SubscriptionType = 'basic' | 'pro' | 'premium' | 'standard';

/**
 * Статус платежа
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'failed';

/**
 * Запрос на создание платежа
 */
export interface PaymentCreateRequest {
  payment_type: PaymentType;
  subscription_type?: SubscriptionType;
  credits_amount?: number;
}

/**
 * Ответ с данными для создания платежа
 */
export interface PaymentCreateResponse {
  payment_id: string;
  confirmation_url: string;
  amount: number;
  currency: string;
}

/**
 * Статус платежа
 */
export interface PaymentStatusResponse {
  payment_id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  created_at: string;
  paid_at?: string;
  description?: string;
}

/**
 * История платежей - один элемент
 */
export interface PaymentHistoryItem {
  id: number;
  user_id: number;
  payment_id: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  subscription_type?: SubscriptionType;
  subscription_expires_at?: string;
  credits_amount?: number;
  created_at: string;
  paid_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Ответ с историей платежей (пагинация)
 */
export interface PaymentHistoryResponse {
  items: PaymentHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Информация о тарифе подписки
 */
export interface SubscriptionTariff {
  type: SubscriptionType;
  name: string;
  description: string;
  price: number;
  currency: string;
  actions_count: number;
  duration_days: number;
  is_recommended?: boolean;
  features: string[];
}

/**
 * Пакет кредитов
 */
export interface CreditsPackage {
  credits_amount: number;
  price: number;
  currency: string;
  bonus_credits?: number;
  is_popular?: boolean;
  description?: string;
}

/**
 * Информация о тарифе (общая структура)
 */
export interface TariffInfo {
  subscription_tariffs: SubscriptionTariff[];
  credits_packages: CreditsPackage[];
}

/**
 * Ответ со списком всех тарифов
 */
export interface TariffsListResponse {
  subscriptions: BackendTariff[];
  credits_packages: BackendTariff[];
}

/**
 * Тариф, возвращаемый бэкендом
 */
export interface BackendTariff {
  tariff_id: string;
  type: PaymentType;
  name: string;
  description: string;
  price: number;
  credits_amount?: number;
  duration_days?: number;
  is_popular?: boolean;
}

/**
 * Локальное состояние для выбора тарифа
 */
export interface SelectedTariff {
  type: PaymentType;
  subscription?: SubscriptionType;
  credits_amount?: number;
  price: number;
  description: string;
}

/**
 * Разбивка суммы по налогам и комиссиям
 */
export interface TaxBreakdown {
  gross_amount: number;
  npd_tax: number;
  yukassa_commission: number;
  total_deductions: number;
  net_amount: number;
}
