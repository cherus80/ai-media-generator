/**
 * Zustand store для генерации по образцу без истории
 */

import { create } from 'zustand';
import type { ChatAttachment } from '../types/editing';
import type { FittingStatusResponse, FittingResult, GenerationStatus } from '../types/fitting';
import type { OutputFormat } from '../types/generation';
import { generateExampleImage, pollEditingStatus } from '../api/editing';
import { useAuthStore } from './authStore';
import toast from 'react-hot-toast';

const MAX_PROMPT_LENGTH = 4000;

interface ExampleGenerationState {
  isGenerating: boolean;
  taskId: string | null;
  generationStatus: GenerationStatus | null;
  progress: number;
  statusMessage: string | null;
  result: FittingResult | null;
  error: string | null;

  startGeneration: (prompt: string, attachments: ChatAttachment[], outputFormat?: OutputFormat) => Promise<FittingResult>;
  reset: () => void;
  updateProgress: (status: FittingStatusResponse) => void;
}

export const useExampleGenerationStore = create<ExampleGenerationState>((set, get) => ({
  isGenerating: false,
  taskId: null,
  generationStatus: null,
  progress: 0,
  statusMessage: null,
  result: null,
  error: null,

  startGeneration: async (prompt: string, attachments: ChatAttachment[], outputFormat?: OutputFormat) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Промпт не может быть пустым');
    }
    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`Промпт превышает ${MAX_PROMPT_LENGTH} символов`);
    }
    if (!attachments || attachments.length === 0) {
      throw new Error('Необходимо прикрепить хотя бы одно фото');
    }

    set({
      isGenerating: true,
      error: null,
      progress: 0,
      statusMessage: 'Запускаем генерацию...',
      result: null,
    });

    try {
      const response = await generateExampleImage({
        prompt: trimmedPrompt,
        attachments,
        output_format: outputFormat,
      });

      if (!response.task_id) {
        throw new Error('Не удалось запустить генерацию');
      }

      set({
        taskId: response.task_id,
        generationStatus: response.status as GenerationStatus,
        statusMessage: response.message,
      });

      const result = await pollEditingStatus(
        response.task_id,
        (status) => {
          get().updateProgress(status);
        },
        {
          slowWarningMs: 60000,
          onSlowWarning: () =>
            toast(
              'Генерация может занять до 5 минут из-за нагрузки на сервис. Приложение продолжает ждать ответ.',
              { icon: '⏳' }
            ),
        }
      );

      set({
        result,
        isGenerating: false,
        generationStatus: result.status,
        progress: 100,
        statusMessage: result.status === 'completed' ? 'Готово!' : 'Произошла ошибка',
      });

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

  updateProgress: (status: FittingStatusResponse) => {
    set({
      generationStatus: status.status,
      progress: status.progress,
      statusMessage: status.message,
    });
  },

  reset: () => {
    set({
      isGenerating: false,
      taskId: null,
      generationStatus: null,
      progress: 0,
      statusMessage: null,
      result: null,
      error: null,
    });
  },
}));
