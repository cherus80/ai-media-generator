import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface InsufficientBalanceModalProps {
  isOpen: boolean;
  title?: string;
  description: string;
  currentCredits: number;
  requiredCredits?: number;
  requiredActions?: number;
  onClose: () => void;
  onBuyCredits: () => void;
  onBuySubscription: () => void;
}

export const InsufficientBalanceModal: React.FC<InsufficientBalanceModalProps> = ({
  isOpen,
  title = 'Недостаточно баланса',
  description,
  currentCredits,
  requiredCredits,
  requiredActions,
  onClose,
  onBuyCredits,
  onBuySubscription,
}) => {
  if (!isOpen) {
    return null;
  }

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
        className="max-w-xl w-full"
      >
        <Card variant="glass" padding="lg" className="shadow-glow-primary p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-2xl font-bold gradient-text">{title}</h3>
              <p className="text-dark-600 mt-1">{description}</p>
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

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Badge variant="neutral" size="sm">
              Баланс: {currentCredits} ⭐️
            </Badge>
            {typeof requiredCredits === 'number' && (
              <Badge variant="warning" size="sm">
                Нужно ⭐️звезд: {requiredCredits}
              </Badge>
            )}
            {typeof requiredActions === 'number' && requiredActions > 0 && (
              <Badge variant="primary" size="sm">
                Нужно генераций: {requiredActions}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="primary" size="lg" onClick={onBuyCredits} fullWidth>
              Купить ⭐️звезды
            </Button>
            <Button variant="secondary" size="lg" onClick={onBuySubscription} fullWidth>
              Оформить подписку
            </Button>
          </div>

          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Пока не нужно
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};
