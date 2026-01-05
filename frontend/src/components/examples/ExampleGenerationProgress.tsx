/**
 * Прогресс генерации по образцу
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useExampleGenerationStore } from '../../store/exampleGenerationStore';

export const ExampleGenerationProgress: React.FC = () => {
  const { progress, statusMessage } = useExampleGenerationStore();

  const getMessage = (): string => {
    if (statusMessage) return statusMessage;
    if (progress < 20) return 'Загружаем ваши фото...';
    if (progress < 40) return 'Анализируем изображения...';
    if (progress < 60) return 'Создаём AI-композицию...';
    if (progress < 80) return 'Применяем эффекты...';
    if (progress < 100) return 'Финальная обработка...';
    return 'Готово!';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center">
        <motion.div
          className="inline-block mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Генерируем изображение
        </h2>
        <p className="text-gray-600 mb-8">{getMessage()}</p>

        <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <p className="text-sm font-semibold text-gray-700">
          {Math.round(progress)}%
        </p>

        <div className="mt-8 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-blue-500 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Это займёт 20-60 секунд.</span>
            <br />
            Пожалуйста, не закрывайте приложение во время генерации.
          </p>
        </div>
      </div>
    </div>
  );
};
