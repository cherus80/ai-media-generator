/**
 * Zustand store для редактирования изображений через AI-чат
 * Управляет состоянием чата, сообщениями и генерацией
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  BaseImageUpload,
  ChatAttachment,
} from '../types/editing';
import type { FittingStatusResponse, FittingResult } from '../types/fitting';
import {
  uploadBaseImage,
  createChatSession,
  sendChatMessage,
  generateEditedImage,
  getChatHistory,
  resetChatSession,
  pollEditingStatus,
} from '../api/editing';
import { useAuthStore } from './authStore';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/authToken';
import { getUploadErrorMessage } from '../utils/uploadErrors';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/$/, '')
  .replace(/\/api$/, '');

interface ChatState {
  // State: сессия чата
  sessionId: string | null;
  baseImage: BaseImageUpload | null;
  isSessionActive: boolean;

  // State: сообщения
  messages: ChatMessage[];
  isLoading: boolean;
  isSendingMessage: boolean;

  // State: промпты от AI
  currentPrompts: string[] | null;

  // State: генерация изображения
  isGenerating: boolean;
  taskId: string | null;
  generationProgress: number; // 0-100

  // State: ошибки
  error: string | null;
  uploadError: string | null;

  // Actions: инициализация сессии
  uploadAndCreateSession: (file: File) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<void>;

  // Actions: работа с чатом
  sendMessage: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  selectPrompt: (prompt: string, attachments?: ChatAttachment[]) => Promise<void>;

  // Actions: генерация изображения
  generateImage: (prompt: string, attachments?: ChatAttachment[]) => Promise<FittingResult>;

  // Actions: управление сессией
  reset: () => void;
  resetSession: () => Promise<void>;
  clearError: () => void;

  // Actions: внутренние
  updateGenerationProgress: (status: FittingStatusResponse) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}

const CHAT_STORAGE_KEY = 'editing-chat-storage';

const getStoredAuthToken = (): string | null => getAuthToken();

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  // Initial state
  sessionId: null,
  baseImage: null,
  isSessionActive: false,
  messages: [],
  isLoading: false,
  isSendingMessage: false,
  currentPrompts: null,
  isGenerating: false,
  taskId: null,
  generationProgress: 0,
  error: null,
  uploadError: null,

  // Загрузка базового изображения и создание сессии
  uploadAndCreateSession: async (file: File) => {
    set({ uploadError: null, isLoading: true });

    try {
      // Валидация на клиенте
      const isSupportedType =
        file.type.match(/^image\/(jpeg|png|webp|heic|heif|mpo)$/) ||
        /\.(heic|heif|mpo)$/i.test(file.name);

      if (!isSupportedType) {
        throw new Error(
          'Неподдерживаемый формат. Используйте JPEG, PNG, WebP, HEIC/HEIF или MPO.'
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          'Файл слишком большой. Максимальный размер: 10MB. Сожмите изображение или выберите файл меньшего размера.'
        );
      }

      // Создаём preview
      const preview = await createPreview(file);

      // Загружаем на сервер
      const uploadResponse = await uploadBaseImage(file);

      // Создаём сессию чата
      const sessionResponse = await createChatSession({
        base_image_url: uploadResponse.base_image_url,
      });

      const resolvedUrl = resolveUploadUrl(uploadResponse.base_image_url);
      const finalPreview = shouldUseServerPreview(file) ? resolvedUrl : preview;

      // Сохраняем в state
      set({
        baseImage: {
          file_id: 'base-image',
          url: resolvedUrl,
          preview: finalPreview,
          file,
        },
        sessionId: sessionResponse.session_id,
        isSessionActive: true,
        messages: [],
        isLoading: false,
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = getUploadErrorMessage(error, {
        kind: 'image',
        maxSizeMb: 10,
        allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
        fallback: 'Не удалось загрузить изображение. Попробуйте еще раз.',
      });
      set({ uploadError: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Загрузка истории чата
  loadHistory: async (sessionId: string) => {
    set({ isLoading: true, error: null });

    try {
      const history = await getChatHistory(sessionId);

      // Конвертируем историю в формат ChatMessage
      const messages: ChatMessage[] = history.messages.map((msg) => ({
        id: uuidv4(),
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments,
        image_url: msg.image_url,
        timestamp: new Date(msg.timestamp),
        prompt: msg.prompt,
      }));

      const resolvedBaseUrl = history.base_image_url
        ? history.base_image_url.startsWith('http')
          ? history.base_image_url
          : `${API_BASE_URL}${history.base_image_url.startsWith('/') ? history.base_image_url : `/${history.base_image_url}`}`
        : null;

      set({
        sessionId: history.session_id,
        messages,
        isSessionActive: history.is_active,
        baseImage: resolvedBaseUrl
          ? {
              file_id: 'base-image',
              url: resolvedBaseUrl,
              preview: resolvedBaseUrl,
              file: null,
            }
          : get().baseImage,
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка загрузки истории';
      const status = error.response?.status;
      if (status === 404 || status === 410) {
        get().reset();
      } else {
        set({ error: errorMessage, isLoading: false });
      }
      throw error;
    }
  },

  // Отправка сообщения AI-ассистенту
  sendMessage: async (text: string, attachments?: ChatAttachment[]) => {
    const { sessionId } = get();

    if (!sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    if (!text.trim()) {
      throw new Error('Сообщение не может быть пустым');
    }

    set({ isSendingMessage: true, error: null, currentPrompts: null });

    // Добавляем сообщение пользователя
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, userMessage] }));

    try {
      // Отправляем сообщение на сервер (списывает 1 кредит)
      const response = await sendChatMessage({
        session_id: sessionId,
        message: text,
        attachments,
      });

      // Добавляем ответ ассистента с финальным промптом
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        prompt: response.prompt,
        attachments: response.attachments,
        timestamp: new Date(response.timestamp),
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        currentPrompts: response.prompt ? [response.prompt] : null,
        isSendingMessage: false,
      }));

      // Обновляем профиль пользователя (списан 1 кредит)
      await useAuthStore.getState().refreshProfile();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка отправки сообщения';
      set({ error: errorMessage, isSendingMessage: false });

      // Удаляем сообщение пользователя, если произошла ошибка
      set((state) => ({
        messages: state.messages.filter((msg) => msg.id !== userMessage.id),
      }));

      throw error;
    }
  },

  // Выбор промпта для генерации
  selectPrompt: async (prompt: string, attachments?: ChatAttachment[]) => {
    // Просто генерируем изображение по выбранному промпту
    await get().generateImage(prompt, attachments);
  },

  // Генерация изображения по промпту
  generateImage: async (prompt: string, attachments?: ChatAttachment[]) => {
    const { sessionId } = get();

    console.log('[chatStore] generateImage called with prompt:', prompt);
    console.log('[chatStore] Current sessionId:', sessionId);

    if (!sessionId) {
      console.error('[chatStore] No sessionId - throwing error');
      throw new Error('Сессия не инициализирована');
    }

    if (!prompt.trim()) {
      console.error('[chatStore] Empty prompt - throwing error');
      throw new Error('Промпт не может быть пустым');
    }

    set({
      isGenerating: true,
      error: null,
      generationProgress: 0,
      currentPrompts: null,
    });

    try {
      console.log('[chatStore] Calling API /editing/generate...');
      // Запускаем генерацию (списывает 2 кредита)
      const response = await generateEditedImage({
        session_id: sessionId,
        prompt,
        attachments,
      });

      console.log('[chatStore] API response:', response);

      set({
        taskId: response.task_id,
      });

      // Запускаем polling для отслеживания прогресса
      const result = await pollEditingStatus(
        response.task_id,
        (status) => {
          get().updateGenerationProgress(status);
        },
        {
          slowWarningMs: 60000,
          onSlowWarning: () =>
            toast(
              'Генерация может занять до 3 минут из-за нагрузки на сервис. Приложение продолжает ждать ответ.',
              { icon: '⏳' }
            ),
        }
      );

      // Добавляем сообщение с результатом
      if (result.status === 'completed' && result.image_url) {
        const resolvedResultUrl = result.image_url.startsWith('http')
          ? result.image_url
          : `${API_BASE_URL}${result.image_url.startsWith('/') ? result.image_url : `/${result.image_url}`}`;

        const imageMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `Изображение готово! Промпт: "${prompt}"`,
          image_url: resolvedResultUrl,
          attachments,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, imageMessage],
          isGenerating: false,
          generationProgress: 100,
          // Обновляем базовое изображение, чтобы следующие генерации использовали свежий результат
          baseImage: state.baseImage
            ? {
                ...state.baseImage,
                url: resolvedResultUrl,
                preview: resolvedResultUrl,
              }
            : state.baseImage,
        }));
      } else {
        throw new Error(result.error_message || 'Ошибка генерации');
      }

      // Обновляем профиль пользователя (списан 1 кредит)
      await useAuthStore.getState().refreshProfile();

      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка генерации изображения';
      set({
        isGenerating: false,
        error: errorMessage,
        generationProgress: 0,
      });
      throw error;
    }
  },

  // Обновление прогресса генерации (вызывается из polling)
  updateGenerationProgress: (status: FittingStatusResponse) => {
    set({
      generationProgress: status.progress,
    });
  },

  // Добавление сообщения в чат
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  // Сброс всего состояния (локально)
  reset: () => {
    set({
      sessionId: null,
      baseImage: null,
      isSessionActive: false,
      messages: [],
      isLoading: false,
      isSendingMessage: false,
      currentPrompts: null,
      isGenerating: false,
      taskId: null,
      generationProgress: 0,
      error: null,
      uploadError: null,
    });
  },

  // Сброс сессии на сервере и локально
  resetSession: async () => {
    const { sessionId } = get();

    if (!sessionId) {
      get().reset();
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await resetChatSession(sessionId);
      get().reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка сброса сессии';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => {
    set({ error: null, uploadError: null });
  },
    }),
    {
      name: CHAT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        baseImage: state.baseImage
          ? {
              file_id: state.baseImage.file_id,
              url: state.baseImage.url,
              preview: state.baseImage.url,
              file: null,
            }
          : null,
        isSessionActive: state.isSessionActive,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('Ошибка восстановления состояния чата:', error);
            return;
          }
          if (!state?.sessionId) return;
          const token = getStoredAuthToken();
          if (!token) return;
          state.loadHistory(state.sessionId).catch((loadError) => {
            console.error('Ошибка авто-восстановления истории чата:', loadError);
          });
        };
      },
    }
  )
);

/**
 * Утилита для создания preview изображения (data URL)
 */
const resolveUploadUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

const shouldUseServerPreview = (file: File): boolean =>
  /^image\/(heic|heif|mpo)/i.test(file.type);

const createPreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Не удалось прочитать файл'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };

    reader.readAsDataURL(file);
  });
};
