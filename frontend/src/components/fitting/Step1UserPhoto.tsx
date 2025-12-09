/**
 * Шаг 1: Загрузка фото пользователя
 */

import React from 'react';
import { FileUpload } from '../common/FileUpload';
import { useFittingStore } from '../../store/fittingStore';
import toast from 'react-hot-toast';

interface Step1UserPhotoProps {
  onNext: () => void;
}

export const Step1UserPhoto: React.FC<Step1UserPhotoProps> = ({ onNext }) => {
  const { userPhoto, uploadUserPhoto, uploadError, clearError } = useFittingStore();
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    clearError();

    try {
      await uploadUserPhoto(file);
      toast.success('Фото загружено успешно!');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки фото');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (!userPhoto) {
      toast.error('Пожалуйста, загрузите фото');
      return;
    }
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Шаг 1: Загрузите ваше фото
        </h2>
        <p className="text-gray-600">
          Выберите фотографию, на которую будет примеряться одежда или аксессуар
        </p>
      </div>

      {/* File upload */}
      <FileUpload
        onFileSelect={handleFileSelect}
        preview={userPhoto?.preview}
        isLoading={isUploading}
        error={uploadError}
        label="Ваше фото"
        hint="Загрузите фото в полный рост или портрет. JPEG / PNG / WebP / HEIC, до 10MB"
      />

      {/* File info */}
      {userPhoto && (
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
                Размер: {(userPhoto.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={!userPhoto || isUploading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Далее →
        </button>
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Советы для лучшего результата:
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Используйте фото с хорошим освещением</li>
          <li>• Фон должен быть контрастным</li>
          <li>• Избегайте размытых изображений</li>
          <li>• Лучше всего работает с фото в полный рост</li>
        </ul>
      </div>
    </div>
  );
};
