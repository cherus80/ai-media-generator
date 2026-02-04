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
import toast from 'react-hot-toast';
import { getUploadErrorMessage } from '../utils/uploadErrors';
import { compressImageFile } from '../utils/imageCompression';
import type { AspectRatio } from '../types/generation';
import { getGenerationErrorMessage } from '../utils/billingErrors';

const TARGET_UPLOAD_SIZE = 9 * 1024 * 1024;
const MAX_SOURCE_FILE_SIZE = 40 * 1024 * 1024;

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
  aspectRatio: AspectRatio;

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
  setAspectRatio: (ratio: AspectRatio) => void;

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
  aspectRatio: 'auto',

  // Загрузка фото пользователя
  uploadUserPhoto: async (file: File) => {
    set({ uploadError: null });

    try {
      // Валидация на клиенте
      if (!file.type.match(/^image\/(jpeg|png|webp|heic|heif|mpo)$/)) {
        throw new Error(
          'Неподдерживаемый формат. Используйте JPEG, PNG, WebP, HEIC/HEIF или MPO.'
        );
      }

      if (file.size > MAX_SOURCE_FILE_SIZE) {
        throw new Error(
          'Файл слишком большой для автосжатия. Максимальный размер исходного файла: 40MB. Выберите файл меньшего размера.'
        );
      }

      const compression = await compressImageFile(file, {
        maxSizeBytes: TARGET_UPLOAD_SIZE,
      });

      if (!compression.meetsLimit) {
        const isIphoneFormat = /heic|heif|mpo/i.test(file.type) || /\.(heic|heif|mpo)$/i.test(file.name);
        throw new Error(
          isIphoneFormat
            ? 'Формат HEIC/HEIF/MPO нельзя сжать в браузере. Сохраните файл в JPEG/PNG или выберите фото меньшего размера.'
            : 'Не удалось сжать изображение до 9MB. Попробуйте другое фото или уменьшите размер.'
        );
      }

      const uploadFile = compression.file;

      // Создаём preview
      const preview = await createPreview(uploadFile);

      // Загружаем на сервер
      const uploadResponse = await uploadPhoto(uploadFile);
      const resolvedUrl = resolveUploadUrl(uploadResponse.file_url);
      const finalPreview = shouldUseServerPreview(uploadFile) ? resolvedUrl : preview;

      // Сохраняем в state
      set({
        userPhoto: {
          file_id: uploadResponse.file_id,
          url: uploadResponse.file_url, // Исправлено: file_url вместо url
          preview: finalPreview,
          file: uploadFile,
          size: uploadResponse.file_size, // Исправлено: file_size вместо size
          mime_type: uploadResponse.mime_type,
        },
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = getUploadErrorMessage(error, {
        kind: 'image',
        maxSizeMb: 9,
        allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
        fallback: 'Не удалось загрузить фото. Попробуйте еще раз.',
      });
      set({ uploadError: errorMessage });
      throw new Error(errorMessage);
    }
  },

  // Загрузка фото одежды/аксессуара
  uploadItemPhoto: async (file: File) => {
    set({ uploadError: null });

    try {
      // Валидация на клиенте
      if (!file.type.match(/^image\/(jpeg|png|webp|heic|heif|mpo)$/)) {
        throw new Error(
          'Неподдерживаемый формат. Используйте JPEG, PNG, WebP, HEIC/HEIF или MPO.'
        );
      }

      if (file.size > MAX_SOURCE_FILE_SIZE) {
        throw new Error(
          'Файл слишком большой для автосжатия. Максимальный размер исходного файла: 40MB. Выберите файл меньшего размера.'
        );
      }

      const compression = await compressImageFile(file, {
        maxSizeBytes: TARGET_UPLOAD_SIZE,
      });

      if (!compression.meetsLimit) {
        const isIphoneFormat = /heic|heif|mpo/i.test(file.type) || /\.(heic|heif|mpo)$/i.test(file.name);
        throw new Error(
          isIphoneFormat
            ? 'Формат HEIC/HEIF/MPO нельзя сжать в браузере. Сохраните файл в JPEG/PNG или выберите фото меньшего размера.'
            : 'Не удалось сжать изображение до 9MB. Попробуйте другое фото или уменьшите размер.'
        );
      }

      const uploadFile = compression.file;

      // Создаём preview
      const preview = await createPreview(uploadFile);

      // Загружаем на сервер
      const uploadResponse = await uploadPhoto(uploadFile);
      const resolvedUrl = resolveUploadUrl(uploadResponse.file_url);
      const finalPreview = shouldUseServerPreview(uploadFile) ? resolvedUrl : preview;

      // Сохраняем в state
      set({
        itemPhoto: {
          file_id: uploadResponse.file_id,
          url: uploadResponse.file_url, // Исправлено: file_url вместо url
          preview: finalPreview,
          file: uploadFile,
          size: uploadResponse.file_size, // Исправлено: file_size вместо size
          mime_type: uploadResponse.mime_type,
        },
        uploadError: null,
      });
    } catch (error: any) {
      const errorMessage = getUploadErrorMessage(error, {
        kind: 'image',
        maxSizeMb: 9,
        allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
        fallback: 'Не удалось загрузить фото. Попробуйте еще раз.',
      });
      set({ uploadError: errorMessage });
      throw new Error(errorMessage);
    }
  },

  // Установка зоны аксессуара
  setAccessoryZone: (zone: AccessoryZone) => {
    set({ accessoryZone: zone });
  },
  setAspectRatio: (ratio: AspectRatio) => {
    set({ aspectRatio: ratio });
  },

  // Запуск генерации
  startGeneration: async () => {
    const { userPhoto, itemPhoto, accessoryZone, aspectRatio } = get();

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
        aspect_ratio: aspectRatio,
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
        },
        {
          maxDurationMs: 10 * 60 * 1000,
          slowWarningMs: 60000,
          onSlowWarning: () =>
            toast(
              'Генерация может занять до 10 минут из-за нагрузки на сервис. Приложение продолжает ждать ответ.',
              { icon: '⏳' }
            ),
          verySlowWarningMs: 5 * 60 * 1000,
          onVerySlowWarning: () =>
            toast(
              'Генерация все еще выполняется (возможен fallback модели). Не закрывайте страницу — результат появится автоматически.',
              { icon: '⏳' }
            ),
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
      const errorMessage = getGenerationErrorMessage(error);
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
      aspectRatio: 'auto',
    });
  },

  // Очистка ошибок
  clearError: () => {
    set({ error: null, uploadError: null });
  },
}));

const resolveUploadUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
    .replace(/\/$/, '')
    .replace(/\/api$/, '');
  if (!baseUrl) return url;
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
};

const shouldUseServerPreview = (file: File): boolean =>
  /^image\/(heic|heif|mpo)/i.test(file.type);

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
