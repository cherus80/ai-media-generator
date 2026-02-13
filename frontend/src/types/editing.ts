/**
 * TypeScript типы для редактирования изображений
 * Соответствуют backend схемам из app/schemas/editing.py
 */

import type { AspectRatio } from './generation';

// Роли сообщений в чате
export type MessageRole = 'user' | 'assistant';

// Вложение к сообщению
export interface ChatAttachment {
  id: string;
  url: string;
  type: 'image';
  name?: string;
  size?: number;
  role?: 'reference' | 'base-extra';
}

// Запрос на создание сессии чата
export interface ChatSessionCreate {
  base_image_url?: string | null;
}

// Ответ с созданной сессией
export interface ChatSessionResponse {
  session_id: string; // UUID
  base_image_url?: string | null;
  created_at: string;
}

// Запрос на отправку сообщения
export interface ChatMessageRequest {
  session_id: string;
  message: string;
  attachments?: ChatAttachment[];
}

// Ответ от AI-ассистента
export interface ChatMessageResponse {
  role: MessageRole;
  content: string;
  prompt?: string; // Финальный промпт от AI
  attachments?: ChatAttachment[];
  timestamp: string;
}

// Запрос на генерацию изображения
export interface GenerateImageRequest {
  session_id?: string;
  prompt: string;
  attachments?: ChatAttachment[];
  aspect_ratio?: AspectRatio;
}

// Запрос на генерацию по образцу (без истории)
export interface ExampleGenerateRequest {
  prompt: string;
  attachments?: ChatAttachment[];
  aspect_ratio?: AspectRatio;
}

// Ответ при запуске генерации
export interface GenerateImageResponse {
  task_id: string;
  status: string;
  message: string;
}

// Сообщение из истории чата
export interface ChatHistoryMessage {
  role: MessageRole;
  content: string;
  prompt?: string;
  attachments?: ChatAttachment[];
  image_url?: string; // URL сгенерированного изображения (если есть)
  timestamp: string;
}

// Ответ с историей чата
export interface ChatHistoryResponse {
  session_id: string;
  base_image_url?: string;
  messages: ChatHistoryMessage[];
  message_count: number;
  is_active: boolean;
}

// Ответ на сброс сессии
export interface ResetSessionResponse {
  session_id: string;
  message: string;
}

// Ошибка API
export interface EditingError {
  detail: string;
  error_code?: string;
}

// Локальное состояние сообщения (для UI)
export interface ChatMessage {
  id: string; // Локальный ID для React keys
  role: MessageRole;
  content: string;
  image_url?: string;
  attachments?: ChatAttachment[];
  prompt?: string; // Финальный промпт
  timestamp: Date;
  isLoading?: boolean; // Индикатор загрузки
}

// Состояние загрузки базового изображения
export interface BaseImageUpload {
  file_id: string;
  url: string;
  preview: string; // data URL для превью
  file: File | null;
}
