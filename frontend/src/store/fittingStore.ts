/**
 * Zustand store для примерки одежды
 * Управляет состоянием step-wizard и процессом генерации
 */

import { create } from 'zustand';
import type {
  UploadedFile,
  AccessoryZone,
  FittingStatusResponse,
  FittingResult,
  GenerationStatus,
} from '../types/fitting';
import {
  uploadPhoto,
  generateFitting,
  pollFittingStatus,
} from '../api/fitting';
import { useAuthStore } from './authStore';

interface FittingState {
  // State: загруженные файлы
  userPhoto: UploadedFile | null;
  itemPhoto: UploadedFile | null;

  // State: выбор зоны аксессуара
  accessoryZone: AccessoryZone;

  // State: процесс генерации
  isGenerating: boolean;
  taskId: string | null;
  generationStatus: GenerationStatus | null;
  progress: number; // 0-100
  statusMessage: string | null;

  // State: результат
  result: FittingResult | null;

  // State: ошибки
  error: string | null;
  uploadError: string | null;

  // Actions: загрузка файлов
  uploadUserPhoto: (file: File) => Promise<void>;
  uploadItemPhoto: (file: File) => Promise<void>;

  // Actions: выбор зоны
  setAccessoryZone: (zone: AccessoryZone) => void;

  // Actions: генерация
  startGeneration: () => Promise<FittingResult>;

  // Actions: сброс
  reset: () => void;
  clearError: () => void;

  // Actions: внутренние (для polling)
  updateProgress: (status: FittingStatusResponse) => void;
}

export const useFittingStore = create<FittingState>((set, get) => ({
  // Initial state
  userPhoto: null,
  itemPhoto: null,
  accessoryZone: null,
  isGenerating: false,
  taskId: null,
  generationStatus: null,
  progress: 0,
  statusMessage: null,
  result: null,
  error: null,
  uploadError: null,

  // Загрузка фото пользователя
  uploadUserPhoto: async (file: File) => {
    set({ uploadError: null });

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
      const uploadResponse = await uploadPhoto(file);

      // Сохраняем в state
      set({
        userPhoto: {
          file_id: uploadResponse.file_id,
          url: uploadResponse.url,
          preview,
          file,
          size: uploadResponse.size,
          mime_type: uploadResponse.mime_type,
        },
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка загрузки фото';
      set({ uploadError: errorMessage });
      throw error;
    }
  },

  // Загрузка фото одежды/аксессуара
  uploadItemPhoto: async (file: File) => {
    set({ uploadError: null });

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
      const uploadResponse = await uploadPhoto(file);

      // Сохраняем в state
      set({
        itemPhoto: {
          file_id: uploadResponse.file_id,
          url: uploadResponse.url,
          preview,
          file,
          size: uploadResponse.size,
          mime_type: uploadResponse.mime_type,
        },
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка загрузки фото';
      set({ uploadError: errorMessage });
      throw error;
    }
  },

  // Установка зоны аксессуара
  setAccessoryZone: (zone: AccessoryZone) => {
    set({ accessoryZone: zone });
  },

  // Запуск генерации
  startGeneration: async () => {
    const { userPhoto, itemPhoto, accessoryZone } = get();

    if (!userPhoto || !itemPhoto) {
      throw new Error('Необходимо загрузить оба фото');
    }

    set({
      isGenerating: true,
      error: null,
      progress: 0,
      statusMessage: 'Запускаем генерацию...',
      result: null,
    });

    try {
      // Запускаем генерацию
      const response = await generateFitting({
        user_photo_id: userPhoto.file_id,
        item_photo_id: itemPhoto.file_id,
        accessory_zone: accessoryZone || undefined,
      });

      set({
        taskId: response.task_id,
        generationStatus: response.status,
        statusMessage: response.message,
      });

      // Запускаем polling для отслеживания прогресса
      const result = await pollFittingStatus(
        response.task_id,
        (status) => {
          get().updateProgress(status);
        }
      );

      // Сохраняем результат
      set({
        result,
        isGenerating: false,
        generationStatus: result.status,
        progress: 100,
        statusMessage: result.status === 'completed'
          ? 'Готово!'
          : 'Произошла ошибка',
      });

      // Обновляем профиль пользователя (баланс кредитов)
      await useAuthStore.getState().refreshProfile();

      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка генерации';
      set({
        isGenerating: false,
        error: errorMessage,
        statusMessage: 'Ошибка',
        progress: 0,
      });
      throw error;
    }
  },

  // Обновление прогресса (вызывается из polling)
  updateProgress: (status: FittingStatusResponse) => {
    set({
      generationStatus: status.status,
      progress: status.progress,
      statusMessage: status.message,
    });
  },

  // Сброс всего состояния
  reset: () => {
    set({
      userPhoto: null,
      itemPhoto: null,
      accessoryZone: null,
      isGenerating: false,
      taskId: null,
      generationStatus: null,
      progress: 0,
      statusMessage: null,
      result: null,
      error: null,
      uploadError: null,
    });
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
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};
