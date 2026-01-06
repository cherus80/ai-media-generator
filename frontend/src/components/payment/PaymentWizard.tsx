/**
 * PaymentWizard Component
 * Пошаговый мастер оплаты (квиз)
 * Шаг 1: Выбор типа (Подписка / ⭐️Звезды)
 * Шаг 2: Выбор тарифа
 * Шаг 3: Подтверждение и оплата
 */

import React, { useEffect, useState } from 'react';
import { usePayment } from '../../store/paymentStore';
import { SubscriptionCard } from './SubscriptionCard';
import { CreditsCard } from './CreditsCard';
import type { PaymentType, SubscriptionType } from '../../types/payment';

type WizardStep = 'type' | 'tariff' | 'confirm';

export const PaymentWizard: React.FC = () => {
  const {
    selectedType,
    selectedTariff,
    tariffs,
    isLoading,
    error,
    user,
    setSelectedType,
    selectSubscription,
    selectCreditsPackage,
    loadTariffs,
    createPayment,
    clearError,
    reset,
  } = usePayment();

  const [currentStep, setCurrentStep] = useState<WizardStep>('type');

  // Загружаем тарифы при монтировании
  useEffect(() => {
    loadTariffs();
  }, []);

  // Автоматически переходим к следующему шагу при выборе типа
  useEffect(() => {
    if (selectedType && currentStep === 'type') {
      setCurrentStep('tariff');
    }
  }, [selectedType, currentStep]);

  // Обработчик выбора типа
  const handleTypeSelect = (type: PaymentType) => {
    setSelectedType(type);
  };

  // Обработчик выбора тарифа подписки
  const handleSubscriptionSelect = (type: SubscriptionType) => {
    selectSubscription(type);
    setCurrentStep('confirm');
  };

  // Обработчик выбора пакета кредитов
  const handleCreditsSelect = (amount: number) => {
    selectCreditsPackage(amount);
    setCurrentStep('confirm');
  };

  // Обработчик подтверждения оплаты
  const handleConfirm = async () => {
    await createPayment();
    // После создания платежа пользователь будет перенаправлен на ЮKassa
  };

  // Обработчик возврата на предыдущий шаг
  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('tariff');
    } else if (currentStep === 'tariff') {
      setCurrentStep('type');
      setSelectedType(null as any);
    }
  };

  // Обработчик закрытия мастера
  const handleClose = () => {
    reset();
    setCurrentStep('type');
  };

  // Рендер шага 1: Выбор типа
  const renderTypeStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Выберите тип оплаты
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Подписка */}
        <div
          className={`
            p-6 rounded-xl border-2 cursor-pointer transition-all
            ${
              selectedType === 'subscription'
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
            }
          `}
          onClick={() => handleTypeSelect('subscription')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Подписка</h3>
            <p className="text-sm text-gray-600 mb-4">
              Выгодное предложение для регулярного использования
            </p>
            <ul className="text-sm text-gray-700 space-y-2 text-left">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Больше генераций по лучшей цене
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Срок действия 30 дней
              </li>
            </ul>
          </div>
        </div>

        {/* ⭐️Звезды */}
        <div
          className={`
            p-6 rounded-xl border-2 cursor-pointer transition-all
            ${
              selectedType === 'credits'
                ? 'border-purple-500 bg-purple-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
            }
          `}
          onClick={() => handleTypeSelect('credits')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">⭐️Звезды</h3>
            <p className="text-sm text-gray-600 mb-4">
              Разовая покупка для эпизодического использования
            </p>
            <ul className="text-sm text-gray-700 space-y-2 text-left">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                ⭐️Звезды не сгорают
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Бонусы при больших пакетах
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // Рендер шага 2: Выбор тарифа
  const renderTariffStep = () => {
    if (!tariffs) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка тарифов...</p>
        </div>
      );
    }

    if (selectedType === 'subscription') {
      return (
        <div className="space-y-4">
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              Выберите тариф подписки
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.subscription_tariffs.map((tariff) => (
              <SubscriptionCard
                key={tariff.type}
                tariff={tariff}
                isSelected={selectedTariff?.subscription === tariff.type}
                onSelect={() => handleSubscriptionSelect(tariff.type)}
              />
            ))}
          </div>
        </div>
      );
    } else if (selectedType === 'credits') {
      return (
        <div className="space-y-4">
          <div className="flex items-center mb-6">
            <button
              onClick={handleBack}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              Выберите пакет ⭐️Звезд
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.credits_packages.map((pkg) => (
              <CreditsCard
                key={pkg.credits_amount}
                package={pkg}
                isSelected={selectedTariff?.credits_amount === pkg.credits_amount}
                onSelect={() => handleCreditsSelect(pkg.credits_amount)}
              />
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // Рендер шага 3: Подтверждение
  const renderConfirmStep = () => {
    if (!selectedTariff) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            Подтверждение заказа
          </h2>
        </div>

        {/* Информация о пользователе */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Ваш профиль</h3>
          <div className="text-sm text-gray-700 space-y-1">
            <div className="flex justify-between">
              <span>Telegram:</span>
              <span className="font-medium">@{user?.username || 'unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Текущий баланс:</span>
              <span className="font-medium">{user?.balance_credits || 0} ⭐️звезд</span>
            </div>
            {user?.subscription_type !== 'none' && (
              <div className="flex justify-between">
                <span>Подписка:</span>
                <span className="font-medium capitalize">{user?.subscription_type}</span>
              </div>
            )}
          </div>
        </div>

        {/* Детали заказа */}
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Детали заказа</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>{selectedTariff.description}</span>
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Итого к оплате:</span>
              <span>{selectedTariff.price} ₽</span>
            </div>
          </div>
        </div>

        {/* Кнопка оплаты */}
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className={`
            w-full py-4 px-6 rounded-lg font-bold text-lg transition-colors
            ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Обработка...
            </span>
          ) : (
            'Перейти к оплате'
          )}
        </button>

        {/* Информация о безопасности */}
        <div className="text-xs text-gray-500 text-center">
          <p>Оплата производится через защищённый сервис ЮKassa</p>
          <p className="mt-1">Мы не храним данные ваших платёжных карт</p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Индикатор прогресса */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${currentStep === 'type' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'type' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Тип</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className={`flex items-center ${currentStep === 'tariff' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'tariff' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Тариф</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className={`flex items-center ${currentStep === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'confirm' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Оплата</span>
          </div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Контент шага */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {currentStep === 'type' && renderTypeStep()}
        {currentStep === 'tariff' && renderTariffStep()}
        {currentStep === 'confirm' && renderConfirmStep()}
      </div>

      {/* Кнопка закрытия */}
      {currentStep === 'type' && (
        <div className="mt-6 text-center">
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
};
