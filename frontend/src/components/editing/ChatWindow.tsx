/**
 * Компонент окна чата с автоматическим скроллингом
 * Контейнер для всех сообщений
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChatMessage } from './ChatMessage';
import { ImageMessage } from './ImageMessage';
import { PromptSelector } from './PromptSelector';
import { Card } from '../ui/Card';
import type { ChatMessage as ChatMessageType } from '../../types/editing';

interface ChatWindowProps {
  messages: ChatMessageType[];
  currentPrompts: string[] | null;
  onSelectPrompt: (prompt: string) => void;
  isGenerating?: boolean;
  baseImageUrl?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  currentPrompts,
  onSelectPrompt,
  isGenerating = false,
  baseImageUrl,
}) => {
  const promptAssistantModel =
    import.meta.env.VITE_PROMPT_ASSISTANT_MODEL || 'AI-ассистент';
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Автоматический scroll вниз при новых сообщениях
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, currentPrompts]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Показываем базовое изображение в начале чата
  const shouldShowBaseImage = baseImageUrl && messages.length === 0;

  return (
    <div
      className="flex-1 px-2 sm:px-4 py-4 sm:py-6 overscroll-contain"
      style={{ minHeight: '60vh' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Базовое изображение */}
        {shouldShowBaseImage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <Card variant="glass" padding="lg" className="border border-primary-200">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-success-500 to-primary-500 rounded-xl flex items-center justify-center shadow-lg mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-base font-bold gradient-text">
                  Базовое изображение
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden shadow-large bg-white/60 border border-white/40">
                <img
                  src={baseImageUrl}
                  alt="Base image"
                  className="w-full max-h-96 object-contain mx-auto"
                />
              </div>
              <p className="mt-4 text-sm text-dark-600">
                Опишите, что хотите изменить. После ввода можно отправить запрос сразу или попросить AI ({promptAssistantModel}) улучшить формулировку (спишет 1 кредит) перед генерацией.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Приветственное сообщение */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6, delay: 0.3 }}
              className="inline-block mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-3xl blur-2xl opacity-50 animate-pulse-slow" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl flex items-center justify-center shadow-large">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
            </motion.div>
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-bold gradient-text mb-3"
            >
              Начните беседу с AI-ассистентом
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-dark-600 max-w-md mx-auto"
            >
              Опишите, как хотите изменить изображение, затем выберите — отправить запрос как есть или улучшить его с AI. Например:
              "Измени фон на закат", "Добавь эффект черно-белого фото", "Сделай изображение ярче"
            </motion.p>
          </motion.div>
        )}

        {/* Сообщения */}
        {messages.map((message) => (
          <React.Fragment key={message.id}>
            {message.image_url ? (
              <ImageMessage message={message} />
            ) : (
              <ChatMessage message={message} />
            )}
            {/* Показываем промпты после сообщения ассистента */}
            {message.role === 'assistant' &&
              message.prompts &&
              message.prompts.length > 0 &&
              !message.image_url && (
                <PromptSelector
                  prompts={message.prompts}
                  onSelect={onSelectPrompt}
                  isGenerating={isGenerating}
                />
              )}
          </React.Fragment>
        ))}

        {/* Индикатор генерации */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex justify-center my-4"
          >
            <Card variant="glass" padding="md" className="border border-primary-200">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-6 h-6 text-primary-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm font-semibold gradient-text">
                  Генерируем изображение...
                </span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
