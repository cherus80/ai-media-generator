/**
 * API клиент для примерки одежды
 * Все запросы к /api/v1/fitting/*
 */

import axios from 'axios';
import apiClient from './client';
import type {
  FittingUploadResponse,
  FittingRequest,
  FittingResponse,
  FittingStatusResponse,
  FittingResult,
  GenerationHistoryResponse,
} from '../types/fitting';

/**
 * Загрузка фото пользователя или одежды
 * POST /api/v1/fitting/upload
 */
export const uploadPhoto = async (file: File): Promise<FittingUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<FittingUploadResponse>(
    '/api/v1/fitting/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 60 секунд для загрузки файлов
    }
  );

  return response.data;
};

/**
 * Запуск генерации примерки
 * POST /api/v1/fitting/generate
 */
export const generateFitting = async (
  request: FittingRequest
): Promise<FittingResponse> => {
  const response = await apiClient.post<FittingResponse>(
    '/api/v1/fitting/generate',
    request
  );

  return response.data;
};

/**
 * Проверка статуса генерации
 * GET /api/v1/fitting/status/{task_id}
 */
export const getFittingStatus = async (
  taskId: string
): Promise<FittingStatusResponse> => {
  const response = await apiClient.get<FittingStatusResponse>(
    `/api/v1/fitting/status/${taskId}`
  );

  return response.data;
};

/**
 * Получение результата генерации
 * GET /api/v1/fitting/result/{task_id}
 */
export const getFittingResult = async (taskId: string): Promise<FittingResult> => {
  const response = await apiClient.get<FittingResult>(
    `/api/v1/fitting/result/${taskId}`
  );

  return response.data;
};

/**
 * Получение истории генераций
 * GET /api/v1/fitting/history
 */
export const getFittingHistory = async (
  page: number = 1,
  pageSize: number = 20,
  generationType?: 'fitting' | 'editing'
): Promise<GenerationHistoryResponse> => {
  const response = await apiClient.get<GenerationHistoryResponse>(
    '/api/v1/fitting/history',
    {
      params: {
        page,
        page_size: pageSize,
        generation_type: generationType,
      },
    }
  );

  return response.data;
};

/**
 * Polling функция для отслеживания прогресса генерации
 * Опрашивает endpoint каждые 2 секунды до завершения
 */
export const pollFittingStatus = async (
  taskId: string,
  onProgress: (status: FittingStatusResponse) => void,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    maxDurationMs?: number;
    slowWarningMs?: number;
    verySlowWarningMs?: number;
    onSlowWarning?: () => void;
    onVerySlowWarning?: () => void;
  } = {}
): Promise<FittingResult> => {
  let attempts = 0;
  const {
    intervalMs = 2000,
    maxAttempts,
    maxDurationMs = 10 * 60 * 1000,
    slowWarningMs = 60000,
    verySlowWarningMs = 5 * 60 * 1000,
    onSlowWarning,
    onVerySlowWarning,
  } = options;

  const startedAt = Date.now();
  let warnedSlow = false;
  let warnedVerySlow = false;

  const getRetryDelayMs = (error: unknown, fallbackMs: number) => {
    if (axios.isAxiosError(error)) {
      const retryAfter = error.response?.headers?.['retry-after'];
      if (retryAfter) {
        const parsed = Number(retryAfter);
        if (!Number.isNaN(parsed)) {
          return Math.min(parsed * 1000, 15000);
        }
      }
    }
    return Math.min(Math.max(fallbackMs, 2000) * 2, 15000);
  };

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;

        // Проверяем статус
        const status = await getFittingStatus(taskId);
        onProgress(status);

        // Если завершено - получаем результат
        if (status.status === 'completed' || status.status === 'failed') {
          const result = await getFittingResult(taskId);
          resolve(result);
          return;
        }

        const elapsedMs = Date.now() - startedAt;

        // Сообщение о долгой генерации
        if (!warnedSlow && elapsedMs >= slowWarningMs) {
          warnedSlow = true;
          onSlowWarning?.();
        }
        if (!warnedVerySlow && elapsedMs >= verySlowWarningMs) {
          warnedVerySlow = true;
          onVerySlowWarning?.();
        }

        // Если превышено количество попыток
        if (typeof maxAttempts === 'number' && attempts >= maxAttempts) {
          reject(new Error('Таймаут: генерация заняла слишком много времени'));
          return;
        }
        if (elapsedMs >= maxDurationMs) {
          reject(new Error('Таймаут: генерация заняла слишком много времени'));
          return;
        }

        // Продолжаем опрос
        setTimeout(poll, intervalMs);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          attempts = Math.max(0, attempts - 1);
          const elapsedMs = Date.now() - startedAt;
          if (!warnedSlow && elapsedMs >= slowWarningMs) {
            warnedSlow = true;
            onSlowWarning?.();
          }
          if (!warnedVerySlow && elapsedMs >= verySlowWarningMs) {
            warnedVerySlow = true;
            onVerySlowWarning?.();
          }
          if (elapsedMs >= maxDurationMs) {
            reject(new Error('Таймаут: генерация заняла слишком много времени'));
            return;
          }
          const delay = getRetryDelayMs(error, intervalMs);
          setTimeout(poll, delay + Math.floor(Math.random() * 250));
          return;
        }
        reject(error);
      }
    };

    // Запускаем первый опрос
    poll();
  });
};
