/**
 * Главный компонент wizard для примерки
 * Управляет навигацией между шагами и процессом генерации
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Step1UserPhoto } from './Step1UserPhoto';
import { Step2ItemPhoto } from './Step2ItemPhoto';
import { Step3Zone } from './Step3Zone';
import { GenerationProgress } from './GenerationProgress';
import { FittingResult } from './FittingResult';
import { useFittingStore } from '../../store/fittingStore';
import { Card } from '../ui/Card';
import toast from 'react-hot-toast';

type WizardStep = 'user_photo' | 'item_photo' | 'zone' | 'generating' | 'result';

export interface FittingWizardHandle {
  goBack: () => boolean;
}

export const FittingWizard = forwardRef<FittingWizardHandle>((_, ref) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('user_photo');
  const { startGeneration, result, isGenerating } = useFittingStore();

  // Если есть результат или идёт генерация, синхронизируем шаг — защищает от случайного сброса на шаг 1
  useEffect(() => {
    if (isGenerating && currentStep !== 'generating') {
      setCurrentStep('generating');
      return;
    }
    if (result && currentStep !== 'result') {
      setCurrentStep('result');
    }
  }, [isGenerating, result, currentStep]);

  const handleGenerateClick = async () => {
    setCurrentStep('generating');

    try {
      await startGeneration();
      setCurrentStep('result');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка генерации');
      // Остаёмся на шаге выбора зоны при ошибке
      setCurrentStep('zone');
    }
  };

  const handleRestart = () => {
    setCurrentStep('user_photo');
  };

  // Позволяем кнопке "Назад" в layout возвращать на предыдущий шаг, а не на главную
  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (currentStep === 'result') {
        setCurrentStep('zone');
        return true;
      }
      if (currentStep === 'zone' || currentStep === 'generating') {
        setCurrentStep('item_photo');
        return true;
      }
      if (currentStep === 'item_photo') {
        setCurrentStep('user_photo');
        return true;
      }
      return false;
    },
  }));

  // Progress indicator
  const getStepNumber = (): number => {
    switch (currentStep) {
      case 'user_photo':
        return 1;
      case 'item_photo':
        return 2;
      case 'zone':
        return 3;
      case 'generating':
      case 'result':
        return 3;
      default:
        return 1;
    }
  };

  const totalSteps = 3;

  const stepTitles = {
    user_photo: 'Загрузите ваше фото',
    item_photo: 'Загрузите фото одежды',
    zone: 'Выберите зону примерки',
    generating: 'Генерация...',
    result: 'Результат',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        {currentStep !== 'generating' && currentStep !== 'result' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card variant="glass" padding="lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold gradient-text">
                    {stepTitles[currentStep]}
                  </h2>
                  <p className="text-sm text-dark-600">
                    Шаг {getStepNumber()} из {totalSteps}
                  </p>
                </div>
                <div className="flex items-center space-x-2 justify-start sm:justify-end">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all duration-300 ${
                        step === getStepNumber()
                          ? 'bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-lg scale-110'
                          : step < getStepNumber()
                          ? 'bg-success-500 text-white'
                          : 'bg-dark-200 text-dark-500'
                      }`}
                    >
                      {step < getStepNumber() ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative w-full bg-dark-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(getStepNumber() / totalSteps) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>

              <div className="mt-2 text-right">
                <span className="text-sm font-semibold text-primary-600">
                  {Math.round((getStepNumber() / totalSteps) * 100)}% завершено
                </span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Main content with animations */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 'user_photo' && (
              <Step1UserPhoto onNext={() => setCurrentStep('item_photo')} />
            )}

            {currentStep === 'item_photo' && (
              <Step2ItemPhoto
                onNext={() => setCurrentStep('zone')}
                onBack={() => setCurrentStep('user_photo')}
              />
            )}

            {currentStep === 'zone' && (
              <Step3Zone
                onBack={() => setCurrentStep('item_photo')}
                onGenerate={handleGenerateClick}
              />
            )}

            {currentStep === 'generating' && <GenerationProgress />}

            {currentStep === 'result' && (
              <FittingResult onNewFitting={handleRestart} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-xs text-dark-400 mt-4 text-center">
        Результат создаётся внешним AI-сервисом и может отличаться от ваших ожиданий. Проверьте итог перед скачиванием или публикацией.
      </p>
    </div>
  );
});

FittingWizard.displayName = 'FittingWizard';
