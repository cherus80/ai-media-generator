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
        className="max-w-3xl w-full"
      >
        <Card variant="glass" padding="xl" className="shadow-glow-primary">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="glass" padding="lg" className="border border-success-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🚀</span>
                  <p className="text-lg font-bold text-dark-900">Отправить как есть</p>
                </div>
                <Badge variant="success" size="sm">−1 кредит</Badge>
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
                  isLoading={loadingTarget === 'original'}
                >
                  Отправить без улучшений
                </Button>
              </form>
            </Card>

            <Card variant="glass" padding="lg" className="border border-primary-200">
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
            Помощник <span className="font-semibold">{modelName}</span> предложит улучшенные варианты и попросит подтвердить один из них перед отправкой. Генерация изображения также спишет 1 кредит.
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
              isLoading={loadingTarget === 'ai'}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                </svg>
              }
            >
              Улучшить с AI
            </Button>
          </form>
        </Card>
      </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};
