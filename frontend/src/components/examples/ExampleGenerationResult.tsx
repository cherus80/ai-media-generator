/**
 * Результат генерации по образцу
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useExampleGenerationStore } from '../../store/exampleGenerationStore';
import toast from 'react-hot-toast';
import { buildImageFilename, downloadImage, resolveAbsoluteUrl } from '../../utils/download';

interface ExampleGenerationResultProps {
  onBackToExamples: () => void;
  onTryAgain: () => void;
}

export const ExampleGenerationResult: React.FC<ExampleGenerationResultProps> = ({
  onBackToExamples,
  onTryAgain,
}) => {
  const { result } = useExampleGenerationStore();
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
        buildImageFilename(result.image_url, `example-${result.task_id}`)
      );
      toast.success('Изображение скачано!');
    } catch (error) {
      console.error('Не удалось скачать изображение:', error);
      toast.error('Ошибка при скачивании изображения');
    }
  };

  const handleShare = async () => {
    if (!result.image_url) return;

    const shareUrl = resolveAbsoluteUrl(result.image_url);

    if (window.Telegram?.WebApp?.openTelegramLink) {
      const tgLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`;
      window.Telegram.WebApp.openTelegramLink(tgLink);
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: 'Моя генерация по образцу',
          text: 'Посмотрите на результат генерации по образцу!',
          url: shareUrl,
        });
        toast.success('Успешно поделились!');
      } catch (error) {
        if (error) {
          toast.error('Не удалось поделиться изображением');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Ссылка скопирована в буфер обмена');
      } catch {
        toast.error('Не удалось скопировать ссылку');
      }
    }
  };

  if (result.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Произошла ошибка
          </h2>
          <p className="text-gray-600 mb-8">
            {result.error_message || 'Не удалось сгенерировать изображение'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onTryAgain}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Попробовать снова
            </button>
            <button
              onClick={onBackToExamples}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              К образцам
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-6">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Изображение готово!
          </h2>
          <p className="text-gray-600">
            Скачайте результат или поделитесь им
          </p>
        </div>

        <div className="mb-6 relative">
          <img
            src={resolvedImageUrl}
            alt="Example generation result"
            className="w-full rounded-lg shadow-lg cursor-pointer"
            onClick={() => setIsFullscreen(true)}
            onError={() => toast.error('Не удалось загрузить превью изображения')}
          />
          {result.has_watermark && (
            <div className="absolute top-4 right-4 bg-yellow-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Freemium
            </div>
          )}
        </div>

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

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleDownload}
            className="px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Скачать
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            Поделиться
          </button>
        </div>

        <button
          onClick={onBackToExamples}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
        >
          Сгенерировать по другому образцу ✨
        </button>
      </motion.div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={result.image_url}
            alt="Example generation fullscreen"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
