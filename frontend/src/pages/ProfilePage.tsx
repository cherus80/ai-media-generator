/**
 * ProfilePage Component
 * Страница профиля пользователя с балансом, подпиской, историей действий и платежей
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePayment } from '../store/paymentStore';
import { PaymentWizard } from '../components/payment/PaymentWizard';
import { handlePaymentReturn, pollPaymentStatus } from '../api/payment';
import { getReferralStats, copyReferralLink, shareReferralLink, type ReferralStatsResponse } from '../api/referral';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuthStore();
  const { paymentHistory, loadPaymentHistory, isLoading } = usePayment();
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [paymentReturnMessage, setPaymentReturnMessage] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStatsResponse | null>(null);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);

  // Загружаем историю платежей при монтировании
  useEffect(() => {
    loadPaymentHistory();
    loadReferralStats();
  }, []);

  // Загрузка статистики рефералов
  const loadReferralStats = async () => {
    setIsLoadingReferrals(true);
    try {
      const stats = await getReferralStats();
      setReferralStats(stats);
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  // Проверяем возврат с оплаты
  useEffect(() => {
    const paymentId = handlePaymentReturn();
    if (paymentId) {
      // Запускаем polling для проверки статуса платежа
      setPaymentReturnMessage('Проверяем статус платежа...');

      pollPaymentStatus(
        paymentId,
        (status) => {
          if (status.status === 'succeeded') {
            setPaymentReturnMessage('Оплата успешно завершена!');
            // Обновляем профиль для получения новых кредитов/подписки
            refreshProfile();
            // Обновляем историю платежей
            loadPaymentHistory();

            // Скрываем сообщение через 5 секунд
            setTimeout(() => setPaymentReturnMessage(null), 5000);
          } else if (status.status === 'canceled' || status.status === 'failed') {
            setPaymentReturnMessage('Оплата не была завершена');
            setTimeout(() => setPaymentReturnMessage(null), 5000);
          }
        }
      );
    }
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Получение статуса подписки
  const getSubscriptionStatus = () => {
    if (user.subscription_type === 'none') {
      return 'Нет активной подписки';
    }

    const expiresAt = user.subscription_expires_at
      ? new Date(user.subscription_expires_at)
      : null;

    if (!expiresAt) {
      return `Подписка: ${user.subscription_type}`;
    }

    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return `Подписка: ${user.subscription_type} (${daysLeft} дн.)`;
  };

  // Рендер статуса платежа
  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { text: 'Успешно', color: 'bg-green-100 text-green-800' },
      pending: { text: 'В обработке', color: 'bg-yellow-100 text-yellow-800' },
      canceled: { text: 'Отменён', color: 'bg-gray-100 text-gray-800' },
      failed: { text: 'Ошибка', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      text: status,
      color: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Модальное окно с PaymentWizard
  if (showPaymentWizard) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setShowPaymentWizard(false)}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад в профиль
          </button>
          <PaymentWizard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Заголовок */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Мой профиль</h1>
          <p className="text-gray-600">@{user.username || 'unknown'}</p>
        </div>

        {/* Уведомление о возврате с оплаты */}
        {paymentReturnMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-blue-800">{paymentReturnMessage}</span>
            </div>
          </div>
        )}

        {/* Баланс и подписка */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Баланс кредитов */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Баланс кредитов</h2>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-4xl font-bold mb-2">{user.balance_credits}</div>
            <p className="text-purple-100 text-sm">кредитов доступно</p>
          </div>

          {/* Подписка */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Подписка</h2>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xl font-bold mb-2 capitalize">
              {user.subscription_type === 'none' ? 'Не активна' : user.subscription_type}
            </div>
            <p className="text-blue-100 text-sm">{getSubscriptionStatus()}</p>
          </div>
        </div>

        {/* Freemium счётчик */}
        {user.subscription_type === 'none' && user.balance_credits === 0 && (
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-2">Бесплатные действия</h2>
                <p className="text-green-100 text-sm">
                  Осталось {user.freemium_actions_remaining || 0} из {user.freemium_actions_limit || 10} действий в месяц
                </p>
                {user.freemium_last_reset && (
                  <p className="text-green-100 text-xs mt-1">
                    Сброс: {formatDate(user.freemium_last_reset)}
                  </p>
                )}
              </div>
              <div className="text-4xl font-bold">
                {user.freemium_actions_remaining || 0}
              </div>
            </div>
          </div>
        )}

        {/* Кнопка покупки */}
        <button
          onClick={() => setShowPaymentWizard(true)}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
        >
          Купить кредиты или подписку
        </button>

        {/* История платежей */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">История платежей</h2>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Загрузка...</p>
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600">История платежей пуста</p>
              <p className="text-gray-500 text-sm mt-2">
                Совершите первую покупку, чтобы увидеть историю здесь
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {payment.payment_type === 'subscription'
                          ? `Подписка ${payment.subscription_type}`
                          : `${payment.credits_amount} кредитов`}
                      </span>
                      {getPaymentStatusBadge(payment.status)}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        {payment.amount} {payment.currency}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>ID: {payment.payment_id}</div>
                    <div>Дата: {formatDate(payment.created_at)}</div>
                    {payment.paid_at && (
                      <div>Оплачено: {formatDate(payment.paid_at)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Реферальная программа */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Реферальная программа
          </h2>

          {isLoadingReferrals ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Загрузка...</p>
            </div>
          ) : referralStats ? (
            <>
              {/* Статистика */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {referralStats.total_referrals}
                  </div>
                  <div className="text-sm text-green-600">Всего друзей</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">
                    {referralStats.active_referrals}
                  </div>
                  <div className="text-sm text-blue-600">Активных</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-700">
                    {referralStats.total_earned}
                  </div>
                  <div className="text-sm text-purple-600">Заработано</div>
                </div>
              </div>

              {/* Реферальная ссылка */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ваша реферальная ссылка
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={referralStats.referral_link}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={async () => {
                      const success = await copyReferralLink(referralStats.referral_link);
                      if (success) {
                        toast.success('Ссылка скопирована!');
                      } else {
                        toast.error('Не удалось скопировать ссылку');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Скопировать ссылку"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      shareReferralLink(
                        referralStats.referral_link,
                        'Присоединяйся к AI Image Generator Bot и получай бонусы за создание изображений!'
                      );
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Поделиться"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Приглашайте друзей и получайте +10 кредитов за каждого активного реферала!
                </p>
              </div>

              {/* Список рефералов */}
              {referralStats.referrals.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Ваши рефералы</h3>
                  <div className="space-y-2">
                    {referralStats.referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            referral.is_awarded ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {referral.is_awarded ? '✓' : '⏳'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              @{referral.username || `user_${referral.telegram_id}`}
                            </div>
                            <div className="text-xs text-gray-600">
                              {referral.is_awarded ? 'Активный' : 'Ожидает первого действия'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            +{referral.credits_awarded} кредитов
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(referral.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-600">
              Не удалось загрузить информацию о рефералах
            </div>
          )}
        </div>

        {/* Информация о пользователе */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Информация об аккаунте
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Telegram ID:</span>
              <span className="font-medium text-gray-900">{user.telegram_id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Имя пользователя:</span>
              <span className="font-medium text-gray-900">
                @{user.username || 'не указано'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Регистрация:</span>
              <span className="font-medium text-gray-900">
                {formatDate(user.created_at)}
              </span>
            </div>
            {user.last_activity_at && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Последняя активность:</span>
                <span className="font-medium text-gray-900">
                  {formatDate(user.last_activity_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
