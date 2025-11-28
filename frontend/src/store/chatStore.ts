/**
 * Zustand store для редактирования изображений через AI-чат
 * Управляет состоянием чата, сообщениями и генерацией
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  BaseImageUpload,
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

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
  sendMessage: (text: string) => Promise<void>;
  selectPrompt: (prompt: string) => Promise<void>;

  // Actions: генерация изображения
  generateImage: (prompt: string) => Promise<FittingResult>;

  // Actions: управление сессией
  reset: () => void;
  resetSession: () => Promise<void>;
  clearError: () => void;

  // Actions: внутренние
  updateGenerationProgress: (status: FittingStatusResponse) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
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
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        throw new Error('Поддерживаются только JPEG, PNG и WebP форматы');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Размер файла не должен превышать 10MB');
      }

      // Создаём preview
      const preview = await createPreview(file);

      // Загружаем на сервер
      const uploadResponse = await uploadBaseImage(file);

      // Создаём сессию чата
      const sessionResponse = await createChatSession({
        base_image_url: uploadResponse.base_image_url,
      });

      const resolvedUrl = uploadResponse.base_image_url.startsWith('http')
        ? uploadResponse.base_image_url
        : `${API_BASE_URL}${uploadResponse.base_image_url}`;

      // Сохраняем в state
      set({
        baseImage: {
          file_id: 'base-image',
          url: resolvedUrl,
          preview,
          file,
        },
        sessionId: sessionResponse.session_id,
        isSessionActive: true,
        messages: [],
        isLoading: false,
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка загрузки изображения';
      set({ uploadError: errorMessage, isLoading: false });
      throw error;
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
        image_url: msg.image_url,
        timestamp: new Date(msg.timestamp),
        prompts: undefined, // Промпты не сохраняются в истории
      }));

      set({
        sessionId: history.session_id,
        messages,
        isSessionActive: history.is_active,
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка загрузки истории';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Отправка сообщения AI-ассистенту
  sendMessage: async (text: string) => {
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
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, userMessage] }));

    try {
      // Отправляем сообщение на сервер (списывает 1 кредит)
      const response = await sendChatMessage({
        session_id: sessionId,
        message: text,
      });

      // Добавляем ответ ассистента с промптами
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        prompts: response.prompts,
        timestamp: new Date(response.timestamp),
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        currentPrompts: response.prompts || null,
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
  selectPrompt: async (prompt: string) => {
    // Просто генерируем изображение по выбранному промпту
    await get().generateImage(prompt);
  },

  // Генерация изображения по промпту
  generateImage: async (prompt: string) => {
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
        }
      );

      // Добавляем сообщение с результатом
      if (result.status === 'completed' && result.image_url) {
        const imageMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `Изображение готово! Промпт: "${prompt}"`,
          image_url: result.image_url,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, imageMessage],
          isGenerating: false,
          generationProgress: 100,
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
}));

/**
 * Утилита для создания preview изображения (data URL)
 */
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
