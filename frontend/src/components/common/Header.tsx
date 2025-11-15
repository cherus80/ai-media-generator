/**
 * Компонент Header - шапка приложения с балансом и меню
 * Используется на главной странице
 */

import React from 'react';

interface HeaderProps {
  balance: number;
  subscriptionType: 'BASIC' | 'PRO' | 'PREMIUM' | null;
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ balance, subscriptionType, onMenuClick }) => {
  // Определяем цвет и текст баджа в зависимости от типа подписки
  const getSubscriptionBadge = () => {
    if (!subscriptionType) return null;

    const badges = {
      BASIC: { text: 'Basic', color: 'bg-blue-500' },
      PRO: { text: 'Pro', color: 'bg-[#FF7F50]' },
      PREMIUM: { text: 'Premium', color: 'bg-golden' },
    };

    const badge = badges[subscriptionType];

    return (
      <p className={`text-white text-sm font-bold leading-normal tracking-[0.015em] shrink-0 ${badge.color} px-3 py-1 rounded-full`}>
        {badge.text}
      </p>
    );
  };

  return (
    <div className="flex items-center p-4 justify-between bg-white/10 dark:bg-black/20 backdrop-blur-sm">
      <h2 className="text-slate-800 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1">
        Баланс: {balance} {balance === 1 ? 'кредит' : balance < 5 ? 'кредита' : 'кредитов'}
      </h2>
      <div className="flex items-center justify-end gap-4">
        {getSubscriptionBadge()}
        <button
          onClick={onMenuClick}
          className="text-slate-800 dark:text-white focus:outline-none hover:opacity-80 transition-opacity"
          aria-label="Открыть меню"
        >
          {/* Гамбургер меню */}
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};
