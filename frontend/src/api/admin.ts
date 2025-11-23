/**
 * API клиент для админки.
 *
 * Все запросы требуют роль ADMIN (проверяется через JWT токен).
 */

import apiClient from './client';
import type {
  AdminStats,
  AdminChartsData,
  AdminUsersResponse,
  AdminUsersRequest,
  PaymentExportResponse,
  PaymentExportRequest,
  UserRegistrationData,
  UserActivityStats,
  UserDetailsResponse,
  AddCreditsRequest,
  AddCreditsResponse,
  ReferralStatsResponse,
} from '../types/admin';

// ============================================================================
// Dashboard API
// ============================================================================

/**
 * Получить общую статистику приложения.
 */
export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await apiClient.get<AdminStats>('/api/v1/admin/dashboard/stats');
  return response.data;
};

/**
 * Получить данные для графиков (последние 30 дней).
 */
export const getAdminCharts = async (): Promise<AdminChartsData> => {
  const response = await apiClient.get<AdminChartsData>('/api/v1/admin/dashboard/charts');
  return response.data;
};

/**
 * Получить динамику регистраций пользователей по дням.
 */
export const getUserRegistrations = async (days: number = 30): Promise<UserRegistrationData[]> => {
  const response = await apiClient.get<UserRegistrationData[]>(
    '/api/v1/admin/dashboard/user-registrations',
    { params: { days } }
  );
  return response.data;
};

/**
 * Получить статистику активности пользователей.
 */
export const getUserActivity = async (): Promise<UserActivityStats> => {
  const response = await apiClient.get<UserActivityStats>('/api/v1/admin/dashboard/user-activity');
  return response.data;
};

// ============================================================================
// Users API
// ============================================================================

/**
 * Получить список пользователей с фильтрацией и пагинацией.
 */
export const getAdminUsers = async (params?: AdminUsersRequest): Promise<AdminUsersResponse> => {
  const response = await apiClient.get<AdminUsersResponse>('/api/v1/admin/users', {
    params: params || {},
  });
  return response.data;
};

/**
 * Получить детальную информацию о пользователе.
 */
export const getUserDetails = async (userId: number): Promise<UserDetailsResponse> => {
  const response = await apiClient.get<UserDetailsResponse>(`/api/v1/admin/users/${userId}`);
  return response.data;
};

/**
 * Начислить кредиты пользователю.
 */
export const addUserCredits = async (
  userId: number,
  data: AddCreditsRequest
): Promise<AddCreditsResponse> => {
  const response = await apiClient.post<AddCreditsResponse>(
    `/api/v1/admin/users/${userId}/add-credits`,
    data
  );
  return response.data;
};

// ============================================================================
// Referrals API
// ============================================================================

/**
 * Получить статистику рефералов.
 */
export const getReferralStats = async (): Promise<ReferralStatsResponse> => {
  const response = await apiClient.get<ReferralStatsResponse>('/api/v1/admin/referrals/stats');
  return response.data;
};

// ============================================================================
// Export API
// ============================================================================

/**
 * Экспортировать пользователей в CSV и скачать файл.
 */
export const exportUsersCSV = async (): Promise<void> => {
  const response = await apiClient.get('/api/v1/admin/export/users', {
    responseType: 'blob',
  });

  // Создаём ссылку для скачивания
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Получаем имя файла из заголовка Content-Disposition или генерируем
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'users_export.csv';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Экспортировать платежи в JSON.
 */
export const exportPaymentsJSON = async (
  params?: PaymentExportRequest
): Promise<PaymentExportResponse> => {
  const response = await apiClient.get<PaymentExportResponse>('/api/v1/admin/export/payments', {
    params: {
      ...params,
      format: 'json',
    },
  });
  return response.data;
};

/**
 * Экспортировать платежи в CSV и скачать файл.
 */
export const exportPaymentsCSV = async (params?: PaymentExportRequest): Promise<void> => {
  const response = await apiClient.get('/api/v1/admin/export/payments', {
    params: {
      ...params,
      format: 'csv',
    },
    responseType: 'blob',
  });

  // Создаём ссылку для скачивания
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Получаем имя файла из заголовка Content-Disposition или генерируем
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'payments_export.csv';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Экспортировать генерации в CSV и скачать файл.
 */
export const exportGenerationsCSV = async (): Promise<void> => {
  const response = await apiClient.get('/api/v1/admin/export/generations', {
    responseType: 'blob',
  });

  // Создаём ссылку для скачивания
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Получаем имя файла из заголовка Content-Disposition или генерируем
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'generations_export.csv';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ============================================================================
// Вспомогательные функции для форматирования
// ============================================================================

/**
 * Форматировать число с разделителями тысяч.
 */
export const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU').format(num);
};

/**
 * Форматировать валюту (рубли).
 */
export const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Форматировать дату.
 */
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Форматировать относительное время (например, "2 дня назад").
 */
export const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 30) return `${diffDays} дн. назад`;
  return formatDate(dateString);
};

/**
 * Вычислить процент изменения между двумя значениями.
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};
