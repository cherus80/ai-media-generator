/**
 * TypeScript типы для админки.
 *
 * Соответствуют Pydantic схемам из backend/app/schemas/admin.py
 */

// ============================================================================
// Общая статистика
// ============================================================================

export interface AdminStats {
  // Пользователи
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  active_users_month: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;

  // Генерации
  total_generations: number;
  generations_today: number;
  generations_week: number;
  generations_month: number;
  fitting_generations: number;
  editing_generations: number;

  // Платежи
  total_payments: number;
  successful_payments: number;
  total_revenue: string; // Decimal as string
  revenue_today: string;
  revenue_week: string;
  revenue_month: string;
  average_payment: string;

  // Подписки
  active_subscriptions_basic: number;
  active_subscriptions_pro: number;
  active_subscriptions_premium: number;

  // Рефералы
  total_referrals: number;
  active_referrals: number;

  // Freemium
  freemium_users: number;
  freemium_generations_today: number;
}

// ============================================================================
// Графики
// ============================================================================

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface AdminChartsData {
  revenue_chart: ChartDataPoint[];
  users_chart: ChartDataPoint[];
  generations_chart: ChartDataPoint[];
}

// ============================================================================
// Пользователи
// ============================================================================

export interface AdminUserItem {
  id: number;
  email: string | null;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  balance_credits: number;
  subscription_type: string | null;
  subscription_expires_at: string | null; // ISO datetime
  freemium_actions_remaining: number;
  freemium_reset_at: string | null; // ISO datetime
  created_at: string; // ISO datetime
  last_active_at: string | null; // ISO datetime
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; // User role
  total_generations: number;
  total_spent: string; // Decimal as string
  referrals_count: number;
  is_active: boolean;
  is_blocked: boolean;
  last_login_at: string | null; // ISO datetime
  last_login_ip: string | null;
  last_login_device: string | null;
  last_login_user_agent: string | null;
  ip_shared_accounts: number;
  device_shared_accounts: number;
  suspicion_score: number;
  is_suspicious: boolean;
  suspicion_reason: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminUsersRequest {
  page?: number;
  page_size?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filter_subscription?: string;
  filter_active?: boolean;
}

// ============================================================================
// Экспорт платежей
// ============================================================================

export interface PaymentExportItem {
  payment_id: string;
  user_id: number;
  telegram_id: number;
  username: string | null;
  payment_type: string;
  amount: string; // Decimal as string
  status: string;
  created_at: string; // ISO datetime
  paid_at: string | null; // ISO datetime
  subscription_type: string | null;
  credits_amount: number | null;
  yukassa_payment_id: string | null;
  npd_tax: string; // Decimal as string
  yukassa_commission: string; // Decimal as string
  net_amount: string; // Decimal as string
}

export interface PaymentExportResponse {
  payments: PaymentExportItem[];
  total_count: number;
  total_amount: string; // Decimal as string
  total_npd_tax: string; // Decimal as string
  total_yukassa_commission: string; // Decimal as string
  total_net_amount: string; // Decimal as string
  date_from: string | null; // ISO datetime
  date_to: string | null; // ISO datetime
}

export interface PaymentExportRequest {
  date_from?: string; // ISO datetime
  date_to?: string; // ISO datetime
  status?: string;
  format?: 'csv' | 'json';
}

// ============================================================================
// Согласия на обработку ПДн
// ============================================================================

export interface ConsentExportItem {
  id: number;
  user_id: number;
  email: string | null;
  consent_version: string;
  source: string;
  ip_address: string | null;
  user_agent: string | null;
  granted_at: string;
}

export interface ConsentExportResponse {
  consents: ConsentExportItem[];
  total_count: number;
  date_from: string | null;
  date_to: string | null;
  version: string | null;
}

export interface ConsentExportRequest {
  date_from?: string;
  date_to?: string;
  version?: string;
  format?: 'csv' | 'json';
}

export interface DeleteConsentsResponse {
  deleted_count: number;
}

// ============================================================================
// Админ-уведомления
// ============================================================================

export interface AdminNotificationCreateRequest {
  title: string;
  message: string;
  user_ids?: number[];
  send_to_all?: boolean;
}

export interface AdminNotificationCreateResponse {
  created_count: number;
  skipped_count: number;
}

// ============================================================================
// Локальные типы для UI
// ============================================================================

export interface StatsCardData {
  title: string;
  value: string | number;
  change?: number; // Процент изменения (может быть отрицательным)
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
}

export interface ChartConfig {
  label: string;
  data: ChartDataPoint[];
  color: string;
  backgroundColor?: string;
}

// ============================================================================
// Динамика регистраций
// ============================================================================

export interface UserRegistrationData {
  date: string; // YYYY-MM-DD
  count: number;
}

// ============================================================================
// Активность пользователей
// ============================================================================

export interface TopUserByGenerations {
  id: number;
  email: string | null;
  username: string | null;
  generations_count: number;
}

export interface UserActivityStats {
  active_today: number;
  active_this_week: number;
  active_this_month: number;
  top_users: TopUserByGenerations[];
  avg_generations_per_user: number;
  total_credits_spent: number;
}

// ============================================================================
// Редактирование кредитов
// ============================================================================

export interface UpdateCreditsRequest {
  new_balance: number;
  reason?: string;
}

export interface UpdateCreditsResponse {
  success: boolean;
  user_id: number;
  previous_balance: number;
  new_balance: number;
  message: string;
}

export interface UpdateUserBlockRequest {
  is_blocked: boolean;
  reason?: string;
}

export interface UpdateUserBlockResponse {
  success: boolean;
  user_id: number;
  previous_is_blocked: boolean;
  is_blocked: boolean;
  message: string;
}

// ============================================================================
// Детали пользователя
// ============================================================================

export interface UserDetailsResponse {
  user: AdminUserItem;
  recent_generations: any[]; // Can be typed more specifically if needed
  recent_payments: any[]; // Can be typed more specifically if needed
  referrals: { id: number; email?: string; username?: string; created_at: string }[];
}

// ============================================================================
// Статистика рефералов
// ============================================================================

export interface ReferralStatsItem {
  user_id: number;
  email: string | null;
  username: string | null;
  referrals_count: number;
  active_referrals: number;
  credits_earned: number;
}

export interface ReferralStatsResponse {
  stats: ReferralStatsItem[];
  total_referrals: number;
  total_credits_earned: number;
}

// ============================================================================
// Промпты примерки
// ============================================================================

export interface FittingPromptItem {
  zone: string;
  prompt: string;
  is_default: boolean;
  updated_at: string | null;
  updated_by_user_id: number | null;
}

export interface FittingPromptListResponse {
  items: FittingPromptItem[];
  total: number;
}

export interface UpdateFittingPromptRequest {
  prompt?: string;
  use_default?: boolean;
}

// ============================================================================
// Fallback (GrsAI / kie.ai)
// ============================================================================

export type GenerationProvider = 'grsai' | 'kie_ai';

export interface FallbackSettings {
  primary_provider: GenerationProvider;
  fallback_provider: GenerationProvider | null;
  available_providers: GenerationProvider[];
  // Legacy поля для совместимости
  use_kie_ai?: boolean;
  disable_fallback?: boolean;
}

export interface UpdateFallbackSettingsRequest {
  primary_provider?: GenerationProvider;
  fallback_provider?: GenerationProvider | null;
  // Legacy поля для совместимости
  use_kie_ai?: boolean;
  disable_fallback?: boolean;
}
