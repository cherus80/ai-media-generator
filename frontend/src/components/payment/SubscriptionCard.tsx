/**
 * SubscriptionCard Component
 * Карточка тарифа подписки
 */

import React from 'react';
import type { SubscriptionTariff } from '../../types/payment';

interface SubscriptionCardProps {
  tariff: SubscriptionTariff;
  isSelected?: boolean;
  onSelect: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  tariff,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      className={`
        relative p-6 rounded-xl border-2 transition-all cursor-pointer max-[360px]:p-4
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
        }
        ${tariff.is_recommended ? 'ring-2 ring-yellow-400' : ''}
      `}
      onClick={onSelect}
    >
      {/* Рекомендованный бейдж */}
      {tariff.is_recommended && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
            Рекомендуем
          </span>
        </div>
      )}

      {/* Название тарифа */}
      <h3 className="text-xl font-bold text-gray-900 mb-2 max-[360px]:text-lg">{tariff.name}</h3>

      {/* Описание */}
      <p className="text-sm text-gray-600 mb-4 max-[360px]:text-[13px]">{tariff.description}</p>

      {/* Цена */}
      <div className="mb-4">
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-gray-900 max-[360px]:text-2xl">
            {tariff.price}
          </span>
          <span className="ml-1 text-gray-600">{tariff.currency}</span>
        </div>
        <div className="text-sm text-gray-500 mt-1 max-[360px]:text-[12px]">
          {tariff.actions_count} действий на {tariff.duration_days} дней
        </div>
      </div>

      {/* Особенности тарифа */}
      {tariff.features && tariff.features.length > 0 && (
        <ul className="space-y-2 mb-4">
          {tariff.features.map((feature, index) => (
            <li key={index} className="flex items-start text-sm">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5 max-[360px]:w-4 max-[360px]:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-700 max-[360px]:text-[13px]">{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Кнопка выбора */}
      <button
        className={`
          w-full py-3 px-4 rounded-lg font-semibold transition-colors
          ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }
        `}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {isSelected ? 'Выбрано' : 'Выбрать тариф'}
      </button>

      {/* Информация о стоимости за действие */}
      <div className="mt-3 text-center text-xs text-gray-500">
        ~{(tariff.price / tariff.actions_count).toFixed(2)} {tariff.currency} за действие
      </div>
    </div>
  );
};
