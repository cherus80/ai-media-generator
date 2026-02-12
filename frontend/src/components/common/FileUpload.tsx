/**
 * Компонент для загрузки файлов с drag & drop
 * Использует react-dropzone
 */

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import {
  buildAcceptedTypesLabel,
  getDropzoneErrorMessage,
} from '../../utils/uploadErrors';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  preview?: string | null;
  isLoading?: boolean;
  error?: string | null;
  accept?: Record<string, string[]>;
  maxSize?: number; // в байтах
  label?: string;
  hint?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  preview,
  isLoading = false,
  error = null,
  accept = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/heic': ['.heic'],
    'image/heif': ['.heif'],
    'image/mpo': ['.mpo'],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  label = 'Загрузите фото',
  hint = 'JPEG, PNG, WebP или фото iPhone (HEIC/MPO), до 10MB',
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: 1,
    disabled: isLoading,
    multiple: false,
  });

  // Ошибки валидации
  const validationError = fileRejections.length > 0 && fileRejections[0].errors.length > 0
    ? getDropzoneErrorMessage(fileRejections[0].errors[0], {
        maxSizeBytes: maxSize,
        allowedTypesLabel: buildAcceptedTypesLabel(accept),
      })
    : null;

  const displayError = error || validationError;

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
          {
            'border-blue-400 bg-blue-50': isDragActive && !isDragReject,
            'border-red-400 bg-red-50': isDragReject || displayError,
            'border-gray-300 hover:border-gray-400 bg-white': !isDragActive && !displayError,
            'opacity-50 cursor-not-allowed': isLoading,
          }
        )}
      >
        <input {...getInputProps()} />

        {/* Preview */}
        {preview && !isLoading && (
          <div className="mb-4">
            <img
              src={preview}
              alt="Предпросмотр"
              className="max-h-48 mx-auto rounded-lg shadow-md object-contain"
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm text-gray-600">Загрузка...</p>
          </div>
        )}

        {/* Upload prompt */}
        {!preview && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center">
            {/* Upload icon */}
            <svg
              className="w-12 h-12 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            {isDragActive && !isDragReject && (
              <p className="text-blue-600 font-medium">Отпустите файл здесь</p>
            )}

            {isDragReject && (
              <p className="text-red-600 font-medium">Неподдерживаемый формат</p>
            )}

            {!isDragActive && (
              <>
                <p className="text-gray-700 font-medium mb-1">
                  Перетащите фото сюда или нажмите для выбора
                </p>
                <p className="text-sm text-gray-500">{hint}</p>
              </>
            )}
          </div>
        )}

        {/* Preview exists - show change prompt */}
        {preview && !isLoading && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Нажмите или перетащите для замены
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {displayError && (
        <p className="mt-2 text-sm text-red-600">{displayError}</p>
      )}

      {/* Hint (when no error) */}
      {!displayError && hint && !label && (
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  );
};
