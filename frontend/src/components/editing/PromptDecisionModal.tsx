import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface PromptDecisionModalProps {
  prompt: string;
  isOpen: boolean;
  onClose: () => void;
  onUseOriginal: () => void;
  onUseAiHelper: () => void;
  modelName: string;
  loadingTarget?: 'original' | 'ai' | null;
}

export const PromptDecisionModal: React.FC<PromptDecisionModalProps> = ({
  prompt,
  isOpen,
  onClose,
  onUseOriginal,
  onUseAiHelper,
  modelName,
  loadingTarget = null,
}) => {
  if (!isOpen) {
    return null;
  }

  const isBusy = Boolean(loadingTarget);
  const showOriginalProgress = loadingTarget === 'original';
  const showAiProgress = loadingTarget === 'ai';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-3xl w-full max-h-[90vh] overflow-y-auto overscroll-contain"
      >
        <Card variant="glass" padding="xl" className="shadow-glow-primary p-3 sm:p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold gradient-text">
                Как отправить промпт?
              </h3>
              <p className="text-dark-600 mt-1">
                Выберите: отправить запрос сразу или сначала попросить AI улучшить формулировку. Улучшение тоже тратит кредиты.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
            />
          </div>

          <Card variant="glass" padding="md" className="border border-primary-200 mb-6 bg-white/60">
            <p className="text-sm text-dark-500 mb-2 font-semibold">Ваш промпт</p>
            <div className="rounded-xl bg-white/70 border border-white/50 p-4 max-h-48 overflow-auto text-dark-800 whitespace-pre-wrap leading-relaxed">
              {prompt}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <Card variant="glass" padding="lg" className="border border-success-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🚀</span>
                  <p className="text-lg font-bold text-dark-900">Отправить как есть</p>
                </div>
                <Badge variant="success" size="sm">−2 кредита</Badge>
              </div>
              <p className="text-sm text-dark-600 mb-4">
                Сразу отправим запрос на генерацию без дополнительных шагов. Быстро и без списания за ассистента.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isBusy) onUseOriginal();
                }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  type="submit"
                  disabled={isBusy}
                  isLoading={showOriginalProgress}
                  loadingLabel="Генерация..."
                >
                  Отправить без улучшений
                </Button>
                {showOriginalProgress && (
                  <div className="mt-3">
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500"
                        style={{ width: '50%' }}
                        animate={{ x: ['-50%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                      />
                    </div>
                    <p className="text-xs text-primary-700 font-semibold mt-2">Генерация...</p>
                  </div>
                )}
              </form>
            </Card>

            <Card variant="glass" padding="lg" className="border border-primary-200 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🤖</span>
                  <p className="text-lg font-bold text-dark-900">Улучшить с AI</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="primary" size="sm">Ассистент</Badge>
              <Badge variant="warning" size="sm">−1 кредит</Badge>
            </div>
          </div>
          <p className="text-sm text-dark-600 mb-3">
            Помощник <span className="font-semibold">{modelName}</span> предложит улучшенные варианты и попросит подтвердить один из них перед отправкой. Генерация изображения также спишет 2 кредита.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isBusy) onUseAiHelper();
            }}
          >
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              type="submit"
              disabled={isBusy}
              isLoading={showAiProgress}
              loadingLabel="Генерация..."
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                </svg>
              }
            >
              Улучшить с AI
            </Button>
            {showAiProgress && (
              <div className="mt-3">
                <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-secondary-500 via-primary-500 to-secondary-500"
                    style={{ width: '50%' }}
                    animate={{ x: ['-50%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  />
                </div>
                <p className="text-xs text-secondary-700 font-semibold mt-2">Генерация...</p>
              </div>
            )}
          </form>
        </Card>
      </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};
