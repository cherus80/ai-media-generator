/**
 * API клиент для примерки одежды
 * Все запросы к /api/v1/fitting/*
 */

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
  pageSize: number = 20
): Promise<GenerationHistoryResponse> => {
  const response = await apiClient.get<GenerationHistoryResponse>(
    '/api/v1/fitting/history',
    {
      params: {
        page,
        page_size: pageSize,
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
  intervalMs: number = 2000,
  maxAttempts: number = 150 // 5 минут максимум (150 * 2сек)
): Promise<FittingResult> => {
  let attempts = 0;

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

        // Если превышено количество попыток
        if (attempts >= maxAttempts) {
          reject(new Error('Таймаут: генерация заняла слишком много времени'));
          return;
        }

        // Продолжаем опрос
        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    // Запускаем первый опрос
    poll();
  });
};
