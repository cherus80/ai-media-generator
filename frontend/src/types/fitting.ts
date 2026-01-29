/**
 * TypeScript типы для примерки одежды
 * Соответствуют backend схемам из app/schemas/fitting.py
 */

import type { AspectRatio } from './generation';

// Зоны для аксессуаров
export type AccessoryZone = 'head' | 'face' | 'neck' | 'hands' | 'legs' | 'body' | null;

// Статусы генерации
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Ответ при загрузке файла
export interface FittingUploadResponse {
  file_id: string; // UUID
  file_url: string; // Backend возвращает file_url, не url
  file_size: number; // Backend возвращает file_size, не size
  mime_type: string;
}

// Запрос на генерацию примерки
export interface FittingRequest {
  user_photo_id: string; // UUID
  item_photo_id: string; // UUID
  accessory_zone?: AccessoryZone;
  aspect_ratio?: AspectRatio;
}

// Ответ при запуске генерации
export interface FittingResponse {
  task_id: string;
  status: GenerationStatus;
  message: string;
}

// Статус генерации
export interface FittingStatusResponse {
  task_id: string;
  status: GenerationStatus;
  progress: number; // 0-100
  message: string;
}

// Результат генерации
export interface FittingResult {
  task_id: string;
  status: GenerationStatus;
  image_url?: string;
  error_message?: string;
  has_watermark: boolean;
  credits_spent: number;
  created_at: string;
  completed_at?: string;
}

// История генераций
export interface GenerationHistoryItem {
  id: number;
  task_id: string;
  status: GenerationStatus;
  image_url?: string;
  thumbnail_url?: string;
  generation_type?: 'fitting' | 'editing';
  credits_spent?: number;
  has_watermark: boolean;
  created_at: string;
}

export interface GenerationHistoryResponse {
  items: GenerationHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

// Ошибка API
export interface FittingError {
  detail: string;
  error_code?: string;
}

// Локальное состояние загруженного файла
export interface UploadedFile {
  file_id: string;
  url: string;
  preview: string; // data URL или URL с сервера для превью
  file: File; // оригинальный файл
  size: number;
  mime_type: string;
}
