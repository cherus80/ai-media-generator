/**
 * ProfilePage Component
 * Страница профиля пользователя с балансом, подпиской, историей действий и платежей
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { usePayment } from '../store/paymentStore';
import { PaymentWizard } from '../components/payment/PaymentWizard';
import { handlePaymentReturn, pollPaymentStatus } from '../api/payment';
import { getReferralStats, copyReferralLink, shareReferralLink, type ReferralStatsResponse } from '../api/referral';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
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
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setShowPaymentWizard(false)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
            className="mb-4"
          >
            Назад в профиль
          </Button>
          <PaymentWizard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Заголовок с анимацией */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card variant="glass" padding="lg" className="relative overflow-hidden">
            {/* Декоративный фон */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full filter blur-3xl opacity-20 -mr-32 -mt-32" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold text-white">
                      {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold gradient-text">Мой профиль</h1>
                    <p className="text-dark-600 flex items-center space-x-2">
                      <span>@{user.username || 'unknown'}</span>
                      <Badge variant="success" size="sm" dot>Активен</Badge>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Уведомление о возврате с оплаты */}
        {paymentReturnMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card variant="bordered" padding="md" className="bg-primary-50 border-primary-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-primary-900 font-medium">{paymentReturnMessage}</span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Баланс и подписка */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Баланс кредитов */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card variant="default" padding="none" className="relative overflow-hidden card-hover">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary-500 to-secondary-600" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full filter blur-3xl opacity-10 -mr-16 -mt-16" />

              <div className="relative z-10 p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Баланс кредитов</h2>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-5xl font-bold mb-2">{user.balance_credits}</div>
                <p className="text-secondary-100 text-sm font-medium">кредитов доступно</p>
              </div>
            </Card>
          </motion.div>

          {/* Подписка */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="default" padding="none" className="relative overflow-hidden card-hover">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full filter blur-3xl opacity-10 -ml-16 -mb-16" />

              <div className="relative z-10 p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Подписка</h2>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold mb-2 capitalize">
                  {user.subscription_type === 'none' ? 'Не активна' : user.subscription_type}
                </div>
                <p className="text-primary-100 text-sm font-medium">{getSubscriptionStatus()}</p>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Freemium счётчик */}
        {user.subscription_type === 'none' && user.balance_credits === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card variant="default" padding="none" className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-success-500 to-success-600" />
              <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full filter blur-3xl opacity-10 -ml-32 -mt-32" />

              <div className="relative z-10 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2 flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                      Бесплатные действия
                    </h2>
                    <p className="text-success-100 text-base mb-1">
                      <span className="font-bold text-2xl">{user.freemium_actions_remaining || 0}</span>
                      {' '}из {user.freemium_actions_limit || 10} действий осталось
                    </p>
                    {user.freemium_last_reset && (
                      <p className="text-success-200 text-xs">
                        Обновление: {formatDate(user.freemium_last_reset)}
                      </p>
                    )}
                  </div>
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <div className="text-4xl font-bold">
                      {user.freemium_actions_remaining || 0}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Кнопка покупки */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => setShowPaymentWizard(true)}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
            className="shadow-glow-primary"
          >
            Купить кредиты или подписку
          </Button>
        </motion.div>

        {/* История платежей */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card variant="glass" padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">История платежей</h2>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 spinner"></div>
                <p className="text-dark-600 font-medium">Загрузка...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-dark-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-dark-700 font-semibold mb-2">История платежей пуста</p>
                <p className="text-dark-500 text-sm">
                  Совершите первую покупку, чтобы увидеть историю здесь
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment, index) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Card variant="bordered" padding="md" hover className="bg-white/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {payment.payment_type === 'subscription' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              )}
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-bold text-dark-900">
                                {payment.payment_type === 'subscription'
                                  ? `Подписка ${payment.subscription_type}`
                                  : `${payment.credits_amount} кредитов`}
                              </span>
                              {getPaymentStatusBadge(payment.status)}
                            </div>
                            <div className="text-xs text-dark-600 space-y-0.5">
                              <div className="truncate">ID: {payment.payment_id}</div>
                              <div>{formatDate(payment.created_at)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-xl text-dark-900">
                            {payment.amount} ₽
                          </div>
                          {payment.paid_at && (
                            <div className="text-xs text-dark-500 mt-1">
                              Оплачено
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Реферальная программа */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card variant="glass" padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Реферальная программа</h2>
              <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>

          {isLoadingReferrals ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 spinner"></div>
              <p className="text-dark-600 font-medium">Загрузка...</p>
            </div>
          ) : referralStats ? (
            <>
              {/* Статистика */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card variant="gradient" padding="md" className="border border-success-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-success-700 mb-1">
                      {referralStats.total_referrals}
                    </div>
                    <div className="text-xs font-semibold text-success-600">Всего друзей</div>
                  </div>
                </Card>
                <Card variant="gradient" padding="md" className="border border-primary-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary-700 mb-1">
                      {referralStats.active_referrals}
                    </div>
                    <div className="text-xs font-semibold text-primary-600">Активных</div>
                  </div>
                </Card>
                <Card variant="gradient" padding="md" className="border border-secondary-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-secondary-700 mb-1">
                      {referralStats.total_earned}
                    </div>
                    <div className="text-xs font-semibold text-secondary-600">Заработано</div>
                  </div>
                </Card>
              </div>

              {/* Реферальная ссылка */}
              <Card variant="bordered" padding="md" className="mb-4 bg-white">
                <label className="block text-sm font-bold text-dark-800 mb-3">
                  Ваша реферальная ссылка
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={referralStats.referral_link}
                    readOnly
                    className="flex-1 px-4 py-3 border-2 border-dark-200 rounded-xl bg-dark-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={async () => {
                      const success = await copyReferralLink(referralStats.referral_link);
                      if (success) {
                        toast.success('Ссылка скопирована!');
                      } else {
                        toast.error('Не удалось скопировать ссылку');
                      }
                    }}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    }
                  />
                  <Button
                    variant="success"
                    size="md"
                    onClick={() => {
                      shareReferralLink(
                        referralStats.referral_link,
                        'Присоединяйся к AI Image Generator Bot и получай бонусы за создание изображений!'
                      );
                    }}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    }
                  />
                </div>
                <p className="text-xs text-dark-600 mt-3 font-medium bg-accent-50 border border-accent-200 rounded-lg p-3">
                  💰 Приглашайте друзей и получайте +10 кредитов за каждого активного реферала!
                </p>
              </Card>

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
