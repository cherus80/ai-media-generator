/**
 * Страница примерки одежды
 * Главная страница для виртуальной примерки
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FittingWizard } from '../components/fitting/FittingWizard';
import { useAuthStore } from '../store/authStore';
import { useFittingStore } from '../store/fittingStore';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const FittingPage: React.FC = () => {
  const { user } = useAuthStore();
  const { reset } = useFittingStore();

  // Сброс состояния при монтировании страницы
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-white/20 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-3"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">
                    Виртуальная примерка
                  </h1>
                  <p className="text-sm text-dark-600">
                    Примерьте одежду на своё фото
                  </p>
                </div>
              </motion.div>

              {user && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Card variant="gradient" padding="sm" className="border border-primary-200">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary-700">
                        {user.balance_credits}
                      </p>
                      <p className="text-xs text-primary-600 font-semibold">кредитов</p>
                    </div>
                  </Card>
                  {user.subscription_type && user.subscription_type !== 'none' && (
                    <Badge variant="primary" size="sm" className="mt-1">
                      {user.subscription_type}
                    </Badge>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main>
          <FittingWizard />
        </main>
      </div>
    </AuthGuard>
  );
};
