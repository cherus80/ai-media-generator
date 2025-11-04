/**
 * Шаг 3: Выбор зоны для аксессуара и запуск генерации
 */

import React from 'react';
import { useFittingStore } from '../../store/fittingStore';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import type { AccessoryZone } from '../../types/fitting';

interface Step3ZoneProps {
  onBack: () => void;
  onGenerate: () => void;
}

const ZONES = [
  { id: 'head' as AccessoryZone, label: 'Голова', icon: '👒', description: 'Шляпы, шапки' },
  { id: 'face' as AccessoryZone, label: 'Лицо', icon: '👓', description: 'Очки, маски' },
  { id: 'neck' as AccessoryZone, label: 'Шея', icon: '📿', description: 'Колье, шарфы' },
  { id: 'hands' as AccessoryZone, label: 'Руки', icon: '💍', description: 'Часы, браслеты, кольца' },
  { id: 'legs' as AccessoryZone, label: 'Ноги', icon: '👟', description: 'Обувь' },
  { id: 'body' as AccessoryZone, label: 'Всё тело', icon: '👔', description: 'Одежда, костюмы' },
];

export const Step3Zone: React.FC<Step3ZoneProps> = ({ onBack, onGenerate }) => {
  const { accessoryZone, setAccessoryZone } = useFittingStore();
  const { user } = useAuthStore();

  const handleGenerate = () => {
    // Проверка баланса
    if (!user) {
      toast.error('Необходима авторизация');
      return;
    }

    const hasCredits = user.balance_credits >= 2;
    const hasSubscription = user.subscription_type && user.subscription_type !== 'none';
    const hasFreemium = user.freemium_actions_remaining > 0;

    if (!hasCredits && !hasSubscription && !hasFreemium) {
      toast.error('Недостаточно кредитов для генерации');
      return;
    }

    onGenerate();
  };

  const handleSkipZone = () => {
    setAccessoryZone(null);
    handleGenerate();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Шаг 3: Выберите зону (опционально)
        </h2>
        <p className="text-gray-600">
          Если примеряете аксессуар, укажите зону размещения
        </p>
      </div>

      {/* Zone selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {ZONES.map((zone) => (
          <button
            key={zone.id}
            onClick={() => setAccessoryZone(zone.id)}
            className={`p-4 border-2 rounded-lg transition-all hover:border-blue-400 ${
              accessoryZone === zone.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 bg-white'
            }`}
          >
            <div className="text-4xl mb-2">{zone.icon}</div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{zone.label}</h3>
              <p className="text-xs text-gray-600">{zone.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Selected zone indicator */}
      {accessoryZone && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Выбрана зона: <span className="font-semibold">{ZONES.find(z => z.id === accessoryZone)?.label}</span>
          </p>
        </div>
      )}

      {/* Cost info */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-gray-600 mr-2 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Стоимость генерации: 2 кредита
            </p>
            <p className="text-xs text-gray-600">
              Ваш баланс: {user?.balance_credits || 0} кредитов
              {user?.subscription_type && user.subscription_type !== 'none' && (
                <span className="ml-2 text-blue-600">
                  + подписка ({user.subscription_type})
                </span>
              )}
              {user?.freemium_actions_remaining && user.freemium_actions_remaining > 0 && (
                <span className="ml-2 text-green-600">
                  + {user.freemium_actions_remaining} бесплатных действий
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          ← Назад
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleSkipZone}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 border-2 border-gray-300 transition-colors"
          >
            Пропустить
          </button>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            Примерить ✨
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">
          Когда указывать зону?
        </h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Для одежды (футболки, платья) — зону можно не указывать</li>
          <li>• Для аксессуаров (очки, украшения) — укажите зону для точности</li>
          <li>• Если не уверены — нажмите "Пропустить", AI определит автоматически</li>
        </ul>
      </div>
    </div>
  );
};
