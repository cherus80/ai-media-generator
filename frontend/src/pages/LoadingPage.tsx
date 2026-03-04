/**
 * Loading Page
 *
 * Displayed during authentication and initial app load
 */

import React from 'react';

interface LoadingPageProps {
  message?: string;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Загрузка...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        {/* Animated spinner */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>

        {/* Logo or app name */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          ИИ Генератор
        </h1>

        {/* Loading message */}
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          {message}
        </p>
      </div>
    </div>
  );
};
