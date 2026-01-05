/**
 * API клиент для редактирования изображений
 * Все запросы к /api/v1/editing/*
 */

import apiClient from './client';
import type {
  ChatSessionCreate,
  ChatSessionResponse,
  ChatMessageRequest,
  ChatMessageResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  ExampleGenerateRequest,
  ChatHistoryResponse,
  ResetSessionResponse,
  ChatAttachment,
} from '../types/editing';
import type { FittingStatusResponse, FittingResult } from '../types/fitting';

/**
 * Загрузка базового изображения для редактирования
 * POST /api/v1/editing/upload
 */
export const uploadBaseImage = async (file: File): Promise<ChatSessionCreate> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ChatSessionCreate>(
    '/api/v1/editing/upload',
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
 * Загрузка дополнительного изображения (референса)
 * POST /api/v1/editing/attachment
 */
export const uploadAttachment = async (file: File): Promise<ChatAttachment> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ChatAttachment>(
    '/api/v1/editing/attachment',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    }
  );

  return response.data;
};

/**
 * Создание сессии чата
 * POST /api/v1/editing/session
 */
export const createChatSession = async (
  request: ChatSessionCreate
): Promise<ChatSessionResponse> => {
  const response = await apiClient.post<ChatSessionResponse>(
    '/api/v1/editing/session',
    request
  );

  return response.data;
};

/**
 * Отправка сообщения AI-ассистенту
 * POST /api/v1/editing/chat
 * Списывает 1 кредит
 */
export const sendChatMessage = async (
  request: ChatMessageRequest
): Promise<ChatMessageResponse> => {
  const response = await apiClient.post<ChatMessageResponse>(
    '/api/v1/editing/chat',
    request,
    {
      timeout: 30000, // 30 секунд для ответа AI
    }
  );

  return response.data;
};

/**
 * Генерация изображения по промпту
 * POST /api/v1/editing/generate
 * Списывает 2 кредита
 */
export const generateEditedImage = async (
  request: GenerateImageRequest
): Promise<GenerateImageResponse> => {
  const response = await apiClient.post<GenerateImageResponse>(
    '/api/v1/editing/generate',
    request
  );

  return response.data;
};

/**
 * Генерация изображения по образцу без истории
 * POST /api/v1/editing/example-generate
 */
export const generateExampleImage = async (
  request: ExampleGenerateRequest
): Promise<GenerateImageResponse> => {
  const response = await apiClient.post<GenerateImageResponse>(
    '/api/v1/editing/example-generate',
    request
  );

  return response.data;
};

/**
 * Получение истории чата
 * GET /api/v1/editing/history/{session_id}
 */
export const getChatHistory = async (sessionId: string): Promise<ChatHistoryResponse> => {
  const response = await apiClient.get<ChatHistoryResponse>(
    `/api/v1/editing/history/${sessionId}`
  );

  return response.data;
};

/**
 * Сброс сессии чата
 * DELETE /api/v1/editing/session/{session_id}
 */
export const resetChatSession = async (sessionId: string): Promise<ResetSessionResponse> => {
  const response = await apiClient.delete<ResetSessionResponse>(
    `/api/v1/editing/session/${sessionId}`
  );

  return response.data;
};

/**
 * Проверка статуса генерации изображения
 * GET /api/v1/fitting/status/{task_id}
 * (Используется тот же endpoint, что и для примерки)
 */
export const getEditingStatus = async (
  taskId: string
): Promise<FittingStatusResponse> => {
  const response = await apiClient.get<FittingStatusResponse>(
    `/api/v1/fitting/status/${taskId}`
  );

  return response.data;
};

/**
 * Получение результата генерации изображения
 * GET /api/v1/fitting/result/{task_id}
 * (Используется тот же endpoint, что и для примерки)
 */
export const getEditingResult = async (taskId: string): Promise<FittingResult> => {
  const response = await apiClient.get<FittingResult>(
    `/api/v1/fitting/result/${taskId}`
  );

  return response.data;
};

/**
 * Polling функция для отслеживания прогресса генерации
 * Опрашивает endpoint каждые 2 секунды до завершения
 */
export const pollEditingStatus = async (
  taskId: string,
  onProgress: (status: FittingStatusResponse) => void,
  options: {
    intervalMs?: number;
    maxAttempts?: number;
    slowWarningMs?: number;
    onSlowWarning?: () => void;
  } = {}
): Promise<FittingResult> => {
  let attempts = 0;
  const {
    intervalMs = 2000,
    maxAttempts = 150,
    slowWarningMs = 60000,
    onSlowWarning,
  } = options;

  const startedAt = Date.now();
  let warnedSlow = false;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;

        // Проверяем статус
        const status = await getEditingStatus(taskId);
        onProgress(status);

        // Если завершено - получаем результат
        if (status.status === 'completed' || status.status === 'failed') {
          const result = await getEditingResult(taskId);
          resolve(result);
          return;
        }

        // Сообщение о долгой генерации
        if (!warnedSlow && Date.now() - startedAt >= slowWarningMs) {
          warnedSlow = true;
          onSlowWarning?.();
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
