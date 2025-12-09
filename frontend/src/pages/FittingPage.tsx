/**
 * Страница примерки одежды
 * Главная страница для виртуальной примерки
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FittingWizard, FittingWizardHandle } from '../components/fitting/FittingWizard';
import { useFittingStore } from '../store/fittingStore';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';

export const FittingPage: React.FC = () => {
  const { reset } = useFittingStore();
  const wizardRef = useRef<FittingWizardHandle>(null);
  const navigate = useNavigate();

  // Сброс состояния при монтировании страницы
  useEffect(() => {
    reset();
  }, [reset]);

  const handleBack = () => {
    if (wizardRef.current?.goBack()) {
      return;
    }
    navigate(-1);
  };

  return (
    <AuthGuard>
      <Layout
        title="Виртуальная примерка"
        subtitle="Примерьте одежду на своё фото"
        gradient="from-purple-500 to-blue-500"
        onBack={handleBack}
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        }
      >
        <FittingWizard ref={wizardRef} />
      </Layout>
    </AuthGuard>
  );
};
