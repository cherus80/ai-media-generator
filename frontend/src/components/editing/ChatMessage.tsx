/**
 * Компонент отдельного сообщения в чате
 * Отображает сообщения пользователя и AI-ассистента
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage as ChatMessageType } from '../../types/editing';

interface ChatMessageProps {
  message: ChatMessageType;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const resolveUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
  };

  // Форматирование времени
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-medium ${
          isUser
            ? 'bg-gradient-to-br from-primary-500 to-secondary-500 text-white'
            : 'glass border border-white/20 text-dark-900'
        }`}
      >
        {/* Иконка ассистента */}
        {isAssistant && (
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg mr-2">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <span className="text-xs font-bold gradient-text bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">AI Assistant</span>
          </div>
        )}

        {/* Текст сообщения */}
        <p
          className={`text-sm whitespace-pre-wrap break-words ${
            isUser ? 'text-white' : 'text-dark-800'
          }`}
        >
          {message.content}
        </p>

        {/* Вложения */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="w-20 h-20 rounded-xl overflow-hidden border border-white/30 bg-white/60 shadow-sm"
              >
                <img
                  src={resolveUrl(att.url)}
                  alt={att.name || 'attachment'}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Индикатор загрузки */}
        {message.isLoading && (
          <div className="mt-3 flex items-center space-x-1.5">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0 }}
              className="w-2 h-2 bg-primary-400 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0, delay: 0.15 }}
              className="w-2 h-2 bg-secondary-400 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0, delay: 0.3 }}
              className="w-2 h-2 bg-accent-400 rounded-full"
            />
          </div>
        )}

        {/* Timestamp */}
        <p
          className={`text-xs mt-2 font-medium ${
            isUser ? 'text-white/70' : 'text-dark-500'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </motion.div>
  );
};
