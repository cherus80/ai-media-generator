/**
 * Payment API Client
 * API клиент для работы с платежами через ЮKassa
 */

import apiClient from './client';
import type {
  PaymentCreateRequest,
  PaymentCreateResponse,
  PaymentStatusResponse,
  PaymentHistoryResponse,
  TariffsListResponse,
  PaymentHideResponse,
} from '../types/payment';

/**
 * Создать платёж
 * @param request - Данные для создания платежа
 * @returns URL для редиректа на оплату
 */
export const createPayment = async (
  request: PaymentCreateRequest
): Promise<PaymentCreateResponse> => {
  const response = await apiClient.post<PaymentCreateResponse>(
    '/api/v1/payments/create',
    request
  );
  return response.data;
};

/**
 * Получить статус платежа
 * @param paymentId - ID платежа
 * @returns Информация о статусе платежа
 */
export const getPaymentStatus = async (
  paymentId: string
): Promise<PaymentStatusResponse> => {
  const response = await apiClient.get<PaymentStatusResponse>(
    `/api/v1/payments/status/${paymentId}`
  );
  return response.data;
};

/**
 * Получить историю платежей пользователя
 * @param page - Номер страницы (по умолчанию 1)
 * @param pageSize - Размер страницы (по умолчанию 20)
 * @returns Список платежей с пагинацией
 */
export const getPaymentHistory = async (
  page: number = 1,
  pageSize: number = 20
): Promise<PaymentHistoryResponse> => {
  const response = await apiClient.get<PaymentHistoryResponse>(
    '/api/v1/payments/history',
    {
      params: { page, page_size: pageSize },
    }
  );
  return response.data;
};

/**
 * Получить список доступных тарифов
 * @returns Список тарифов подписок и пакетов кредитов
 */
export const getTariffs = async (): Promise<TariffsListResponse> => {
  const response = await apiClient.get<TariffsListResponse>(
    '/api/v1/payments/tariffs'
  );
  return response.data;
};

/**
 * Скрыть выбранные платежи из истории пользователя
 * @param paymentIds - ID платежей для скрытия
 */
export const hidePayments = async (paymentIds: number[]): Promise<PaymentHideResponse> => {
  const response = await apiClient.post<PaymentHideResponse>(
    '/api/v1/payments/history/hide',
    { payment_ids: paymentIds }
  );
  return response.data;
};

/**
 * Открыть окно оплаты (редирект на ЮKassa)
 * @param confirmationUrl - URL для подтверждения платежа
 */
export const openPaymentWindow = (confirmationUrl: string): void => {
  // В Telegram WebApp открываем в том же окне
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.openLink(confirmationUrl);
  } else {
    // Для dev режима открываем в новой вкладке
    window.open(confirmationUrl, '_blank');
  }
};

/**
 * Обработать возврат после оплаты
 * Проверяет URL параметры после редиректа с ЮKassa
 * @returns Payment ID если есть в URL
 */
export const handlePaymentReturn = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('payment_id');
};

/**
 * Polling для проверки статуса платежа
 * @param paymentId - ID платежа
 * @param onStatusChange - Callback при изменении статуса
 * @param maxAttempts - Максимальное количество попыток (по умолчанию 30)
 * @param intervalMs - Интервал между попытками в мс (по умолчанию 2000)
 */
export const pollPaymentStatus = async (
  paymentId: string,
  onStatusChange: (status: PaymentStatusResponse) => void,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<void> => {
  let attempts = 0;

  const poll = async (): Promise<void> => {
    try {
      const status = await getPaymentStatus(paymentId);
      onStatusChange(status);

      // Завершаем polling если платёж завершён
      if (
        status.status === 'succeeded' ||
        status.status === 'canceled' ||
        status.status === 'failed'
      ) {
        return;
      }

      // Продолжаем polling если не достигли лимита
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, intervalMs);
      }
    } catch (error) {
      console.error('Error polling payment status:', error);
      // Продолжаем попытки даже при ошибке
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, intervalMs);
      }
    }
  };

  await poll();
};
