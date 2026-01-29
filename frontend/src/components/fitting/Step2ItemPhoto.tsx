/**
 * Шаг 2: Загрузка фото одежды/аксессуара
 */

import React from 'react';
import { FileUpload } from '../common/FileUpload';
import { useFittingStore } from '../../store/fittingStore';
import toast from 'react-hot-toast';

interface Step2ItemPhotoProps {
  onNext: () => void;
  onBack: () => void;
}

export const Step2ItemPhoto: React.FC<Step2ItemPhotoProps> = ({
  onNext,
  onBack,
}) => {
  const { itemPhoto, uploadItemPhoto, uploadError, clearError } = useFittingStore();
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    clearError();

    try {
      await uploadItemPhoto(file);
      toast.success('Фото загружено успешно!');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки фото');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (!itemPhoto) {
      toast.error('Пожалуйста, загрузите фото одежды');
      return;
    }
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Шаг 2: Загрузите фото одежды или аксессуара
        </h2>
        <p className="text-gray-600">
          Выберите изображение одежды или аксессуара для примерки
        </p>
      </div>

      {/* File upload */}
      <FileUpload
        onFileSelect={handleFileSelect}
        preview={itemPhoto?.preview}
        isLoading={isUploading}
        error={uploadError}
        label="Одежда или аксессуар"
        hint="Загрузите фото одежды, обуви или аксессуара. JPEG / PNG / WebP / HEIC, до 10MB (если файл больше 5MB — сожмём автоматически)."
      />

      {/* File info */}
      {itemPhoto && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-600 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">
                Фото готово
              </p>
              <p className="text-xs text-green-600">
                Размер: {(itemPhoto.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          disabled={isUploading}
          className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          ← Назад
        </button>
        <button
          onClick={handleNext}
          disabled={!itemPhoto || isUploading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Далее →
        </button>
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Что можно примерить:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Одежду (футболки, рубашки, худи, джинсы, костюмы, куртки)</li>
            <li>• Обувь (кроссовки, ботинки, лоферы)</li>
            <li>• Аксессуары (очки, шляпы, украшения)</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Рекомендации к фото одежды:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Лучше всего — фото одежды без человека (каталог/манекен/flat-lay).</li>
            <li>• Если одежда на модели, кадрируйте так, чтобы не было лица, рук и ног.</li>
            <li>• Одежда должна быть полностью в кадре, без сильных перекрытий и складок.</li>
            <li>• Однотонный фон и хорошее освещение повышают качество примерки.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
