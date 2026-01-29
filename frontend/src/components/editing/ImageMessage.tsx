/**
 * Компонент для отображения сгенерированного изображения в чате
 * С кнопками Zoom и Скачать
 */

import React from 'react';
import toast from 'react-hot-toast';
import type { ChatMessage } from '../../types/editing';
import { buildImageFilename, downloadImage, resolveAbsoluteUrl } from '../../utils/download';

interface ImageMessageProps {
  message: ChatMessage;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ message }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);

  const resolvedImageUrl = message.image_url ? resolveAbsoluteUrl(message.image_url) : '';

  if (!message.image_url) {
    return null;
  }

  const handleDownload = async () => {
    try {
      await downloadImage(
        message.image_url!,
        buildImageFilename(message.image_url!, `edited-image-${Date.now()}`)
      );
      toast.success('Изображение скачивается');
    } catch (error) {
      console.error('Не удалось скачать изображение:', error);
      toast.error('Не удалось скачать изображение');
    }
  };

  const handleShare = async () => {
    const shareText = 'Изображение сгенерировано в https://ai-generator.mix4.ru';
    const shareUrl = resolveAbsoluteUrl(message.image_url!);

    const buildShareFile = async () => {
      const response = await fetch(shareUrl, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Ошибка загрузки изображения: ${response.status}`);
      }
      const blob = await response.blob();
      const extension = blob.type?.split('/')[1] || 'png';
      return new File([blob], `ai-generator-${Date.now()}.${extension}`, {
        type: blob.type || 'image/png',
      });
    };

    if (navigator.share && typeof navigator.canShare === 'function') {
      try {
        const file = await buildShareFile();
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'AI Generator',
            text: shareText,
            files: [file],
          });
          toast.success('Успешно поделились');
          return;
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }

    const ClipboardCtor = typeof ClipboardItem !== 'undefined' ? ClipboardItem : null;
    if (navigator.clipboard && 'write' in navigator.clipboard && ClipboardCtor) {
      try {
        const file = await buildShareFile();
        const item = new ClipboardCtor({ [file.type]: file });
        await navigator.clipboard.write([item]);
        toast.success('Изображение скопировано в буфер');
        return;
      } catch (error) {
        console.error('Не удалось скопировать изображение в буфер:', error);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Generator',
          text: shareText,
        });
        toast.success('Успешно поделились');
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Сообщение скопировано в буфер обмена');
    } catch {
      toast.error('Не удалось поделиться изображением');
    }
  };

  const handleZoom = () => {
    setIsZoomed(true);
  };

  const handleCloseZoom = () => {
    setIsZoomed(false);
  };

  // Форматирование времени
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <>
      <div className="flex justify-start mb-4 animate-fade-in">
        <div className="max-w-[80%] bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          {/* Иконка ассистента */}
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mr-2">
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-600">AI-ассистент</span>
          </div>

          {/* Текст сообщения */}
          <p className="text-sm text-gray-800 mb-3 whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Изображение */}
          <div className="relative rounded-lg overflow-hidden bg-gray-200 max-w-[420px]">
            <img
              src={resolvedImageUrl}
              alt="Generated result"
              className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity object-contain max-h-80"
              onClick={handleZoom}
              loading="lazy"
              onError={() => toast.error('Не удалось загрузить изображение')}
            />
            {/* Кнопка Zoom поверх изображения */}
            <button
              onClick={handleZoom}
              className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-lg transition-all"
              title="Увеличить"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
            </button>
          </div>

          {/* Кнопки действий */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1.5"
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
              className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1.5"
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

          {/* Timestamp */}
          <p className="text-xs text-gray-500 mt-2">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={handleCloseZoom}
        >
          <button
            onClick={handleCloseZoom}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
            title="Закрыть"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <img
            src={message.image_url}
            alt="Zoomed result"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
