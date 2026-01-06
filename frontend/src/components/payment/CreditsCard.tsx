/**
 * CreditsCard Component
 * Карточка пакета кредитов
 */

import React from 'react';
import type { CreditsPackage } from '../../types/payment';

interface CreditsCardProps {
  package: CreditsPackage;
  isSelected?: boolean;
  onSelect: () => void;
}

export const CreditsCard: React.FC<CreditsCardProps> = ({
  package: pkg,
  isSelected = false,
  onSelect,
}) => {
  const baseCredits = Number(pkg.credits_amount ?? 0);
  const bonusCredits = Number(pkg.bonus_credits ?? 0);
  const totalCredits = baseCredits + bonusCredits;
  const hasBonus = bonusCredits > 0;
  const creditsLabel = hasBonus ? `${totalCredits}` : `${baseCredits}`;
  const tryOnCount = Math.floor(totalCredits / 2);
  const editsWithoutAssistant = Math.floor(totalCredits / 2);
  const editsWithAssistant = Math.floor(totalCredits / 3);

  return (
    <div
      className={`
        relative p-6 rounded-xl border-2 transition-all cursor-pointer max-[360px]:p-4
        ${
          isSelected
            ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
        }
        ${pkg.is_popular ? 'ring-2 ring-orange-400' : ''}
      `}
      onClick={onSelect}
    >
      {/* Популярный бейдж */}
      {pkg.is_popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-orange-400 text-orange-900 text-xs font-bold px-3 py-1 rounded-full">
            Популярный
          </span>
        </div>
      )}

      {/* Количество звезд */}
      <div className="text-center mb-4">
        <div className="flex items-baseline justify-center">
          <span className="text-4xl font-bold text-gray-900 max-[360px]:text-3xl">
            {creditsLabel}
          </span>
          {hasBonus && (
            <span className="ml-2 text-sm font-semibold text-green-600 max-[360px]:text-xs">
              (+{bonusCredits} бонусных ⭐️)
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-1 max-[360px]:text-[12px]">
          {hasBonus ? (
            <>
              <span className="font-semibold">{totalCredits} ⭐️звезд</span>
              <span className="text-green-600 ml-1">(с бонусом)</span>
            </>
          ) : (
            '⭐️звезд'
          )}
        </div>
      </div>

      {/* Описание */}
      {pkg.description && (
        <p className="text-sm text-gray-600 text-center mb-4 max-[360px]:text-[13px]">
          {pkg.description}
        </p>
      )}

      {/* Цена */}
      <div className="mb-4">
        <div className="flex items-baseline justify-center">
          <span className="text-3xl font-bold text-gray-900 max-[360px]:text-2xl">{pkg.price}</span>
          <span className="ml-1 text-gray-600">{pkg.currency}</span>
        </div>

        {/* Стоимость за звезду */}
        <div className="text-center text-sm text-gray-500 mt-2 max-[360px]:text-[12px]">
          ~{(pkg.price / totalCredits).toFixed(2)} {pkg.currency} за ⭐️звезду
        </div>

        {/* Экономия при бонусе */}
        {hasBonus && (
          <div className="text-center text-sm text-green-600 font-semibold mt-1">
            Экономия: {((pkg.bonus_credits! / totalCredits) * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Информационная секция */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-600 space-y-1 max-[360px]:text-[11px]">
          <div className="flex justify-between">
            <span>Примерка одежды:</span>
            <span className="font-semibold">{tryOnCount} раз</span>
          </div>
          <div className="flex justify-between items-start">
            <span>Редактирование:</span>
            <div className="text-right">
              <div className="font-semibold">
                до {editsWithAssistant}-{editsWithoutAssistant} раз
              </div>
              <div className="text-[10px] leading-tight text-gray-500 max-[360px]:text-[9px]">
                2 ⭐️звезды за генерацию, +1 при использовании AI-помощника
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка выбора */}
      <button
        className={`
          w-full py-3 px-4 rounded-lg font-semibold transition-colors
          ${
            isSelected
              ? 'bg-purple-600 text-white'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }
        `}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {isSelected ? 'Выбрано' : 'Выбрать пакет'}
      </button>

      {/* Срок действия */}
      <div className="mt-3 text-center text-xs text-gray-500">
        ⭐️Звезды не сгорают
      </div>
    </div>
  );
};
