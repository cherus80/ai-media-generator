/**
 * Компонент отображения результата примерки
 * Показывает сгенерированное изображение с опциями скачивания и повтора
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useFittingStore } from '../../store/fittingStore';
import toast from 'react-hot-toast';
import {
  buildImageFilename,
  downloadImage,
  resolveAbsoluteUrl,
  shareGeneratedImage,
} from '../../utils/download';

interface FittingResultProps {
  onNewFitting: () => void;
}

export const FittingResult: React.FC<FittingResultProps> = ({ onNewFitting }) => {
  const { result, reset } = useFittingStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!result) {
    return null;
  }

  const resolvedImageUrl = resolveAbsoluteUrl(result.image_url || '');

  const handleDownload = async () => {
    if (!result.image_url) return;

    try {
      await downloadImage(
        result.image_url,
        buildImageFilename(result.image_url, `fitting-${result.task_id}`)
      );
      toast.success('Изображение скачано!');
    } catch (error) {
      console.error('Не удалось скачать изображение:', error);
      toast.error('Ошибка при скачивании изображения');
    }
  };

  const handleShare = async () => {
    if (!result.image_url) return;

    try {
      const resultType = await shareGeneratedImage({
        imageUrl: result.image_url,
        fileBaseName: `fitting-${result.task_id}`,
        title: 'Моя виртуальная примерка',
        message: 'Посмотри на мою виртуальную примерку',
      });

      if (resultType === 'aborted') {
        return;
      }

      if (resultType === 'copied_to_clipboard') {
        toast.success('Текст, ссылка на приложение и ссылка на изображение скопированы');
        return;
      }

      toast.success('Успешно поделились!');
    } catch (error) {
      console.error('Не удалось поделиться изображением:', error);
      toast.error('Не удалось поделиться изображением');
    }
  };

  const handleNewFitting = () => {
    reset();
    onNewFitting();
  };

  // Error state
  if (result.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center">
          {/* Error icon */}
          <div className="inline-block mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Error message */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Произошла ошибка
          </h2>
          <p className="text-gray-600 mb-8">
            {result.error_message || 'Не удалось сгенерировать изображение'}
          </p>

          {/* Retry button */}
          <button
            onClick={handleNewFitting}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Ваша примерка готова!
          </h2>
          <p className="text-gray-600">
            Посмотрите на результат и сохраните, если понравилось
          </p>
        </div>

        {/* Image */}
        <div className="mb-6 relative">
          <img
            src={resolvedImageUrl}
            alt="Результат примерки"
            className="w-full rounded-lg shadow-lg cursor-pointer"
            onClick={() => setIsFullscreen(true)}
            onError={() => toast.error('Не удалось загрузить превью изображения')}
          />
          {result.has_watermark && (
            <div className="absolute top-4 right-4 bg-yellow-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Бесплатный режим
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Потрачено ⭐️звезд:</span>
            <span className="font-semibold text-gray-900">{result.credits_spent}</span>
          </div>
          {result.has_watermark && (
            <p className="mt-2 text-xs text-yellow-700">
              На изображении есть водяной знак. Оформите подписку для генерации без водяных знаков.
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleDownload}
            className="px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Скачать
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Поделиться
          </button>
        </div>

        {/* New fitting button */}
        <button
          onClick={handleNewFitting}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
        >
          Создать новую примерку ✨
        </button>
      </motion.div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={result.image_url}
            alt="Результат примерки (полный экран)"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};
