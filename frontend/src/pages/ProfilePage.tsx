/**
 * ProfilePage Component
 * Страница профиля пользователя с балансом, подпиской, историей генераций и платежей
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePayment } from '../store/paymentStore';
import type { PaymentType } from '../types/payment';
import { PaymentWizard } from '../components/payment/PaymentWizard';
import { handlePaymentReturn, pollPaymentStatus } from '../api/payment';
import { getReferralStats, copyReferralLink, shareReferralLink, type ReferralStatsResponse } from '../api/referral';
import { sendVerificationEmail } from '../api/authWeb';
import { Layout } from '../components/common/Layout';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuthStore();
  const {
    paymentHistory,
    loadPaymentHistory,
    isLoading,
    hidePayments,
    reset: resetPayments,
    setSelectedType,
  } = usePayment();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [paymentReturnMessage, setPaymentReturnMessage] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStatsResponse | null>(null);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [isDeletingPayments, setIsDeletingPayments] = useState(false);

  // Загружаем историю платежей при монтировании
  useEffect(() => {
    loadPaymentHistory();
    loadReferralStats();
  }, []);

  useEffect(() => {
    const buyParam = searchParams.get('buy');
    if (!buyParam) {
      return;
    }
    if (buyParam === 'credits' || buyParam === 'subscription') {
      setShowPaymentWizard(true);
      setSelectedType(buyParam as PaymentType);
    } else if (buyParam === '1') {
      setShowPaymentWizard(true);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('buy');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, setSelectedType]);

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

  const togglePaymentSelection = (paymentId: number) => {
    setSelectedPayments((prev) =>
      prev.includes(paymentId)
        ? prev.filter((id) => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const handleDeleteSingle = async (paymentId: number) => {
    setIsDeletingPayments(true);
    try {
      await hidePayments([paymentId]);
      setSelectedPayments((prev) => prev.filter((id) => id !== paymentId));
      toast.success('Запись скрыта из истории');
    } catch (error) {
      console.error('Failed to delete payment:', error);
      toast.error('Не удалось удалить запись');
    } finally {
      setIsDeletingPayments(false);
    }
  };

  const clearMissingSelections = () => {
    setSelectedPayments((prev) =>
      prev.filter((id) => paymentHistory.some((payment) => payment.id === id))
    );
  };

  useEffect(() => {
    clearMissingSelections();
  }, [paymentHistory]);

  const handleDeleteSelected = async () => {
    if (!selectedPayments.length) return;

    setIsDeletingPayments(true);
    try {
      await hidePayments(selectedPayments);
      setSelectedPayments([]);
      toast.success('Записи оплаты скрыты из истории');
    } catch (error) {
      console.error('Failed to delete payments:', error);
      toast.error('Не удалось удалить выбранные записи');
    } finally {
      setIsDeletingPayments(false);
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
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка профиля...</p>
          </div>
        </div>
      </AuthGuard>
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

  const subscriptionExpiresAt = user.subscription_expires_at
    ? new Date(user.subscription_expires_at)
    : null;
  const hasActiveSubscription =
    !!user.subscription_type &&
    user.subscription_type !== 'none' &&
    !!subscriptionExpiresAt &&
    subscriptionExpiresAt > new Date();

  const actionsRemaining =
    user.subscription_ops_remaining ??
    (user.subscription_ops_limit != null && user.subscription_ops_used != null
      ? Math.max(user.subscription_ops_limit - user.subscription_ops_used, 0)
      : null);

  const subscriptionLabel = hasActiveSubscription
    ? user.subscription_type
    : 'Нет активной подписки';
  const daysLeft = subscriptionExpiresAt
    ? Math.max(
        Math.ceil((subscriptionExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        0
      )
    : null;

  // Получение статуса подписки
  const getSubscriptionStatus = () => {
    if (hasActiveSubscription && subscriptionExpiresAt) {
      const daysText = daysLeft !== null ? `${daysLeft} дн.` : null;
      const actionsText =
        actionsRemaining != null ? `генераций осталось: ${actionsRemaining}` : null;
      const details = [actionsText, daysText].filter(Boolean).join(' · ');
      return `Активна до ${formatDate(subscriptionExpiresAt.toISOString())}${details ? ` · ${details}` : ''}`;
    }

    return 'Нет активной подписки';
  };

  // Рендер статуса платежа
  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { text: 'Успешно', color: 'bg-green-100 text-green-800' },
      pending: { text: 'В обработке', color: 'bg-yellow-100 text-yellow-800' },
      canceled: { text: 'Отменён', color: 'bg-gray-100 text-gray-800' },
      refunded: { text: 'Возврат', color: 'bg-blue-100 text-blue-800' },
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

  const isTrialUser = !!user.free_trial_granted;

  // Модальное окно с PaymentWizard
  if (showPaymentWizard) {
    return (
      <AuthGuard>
        <Layout
          title="Покупка ⭐️звезд"
          subtitle="Выберите подходящий тариф"
          backTo="/profile"
          onBack={() => {
            resetPayments();
            setShowPaymentWizard(false);
          }}
          showBackButton={true}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="max-w-6xl mx-auto p-6">
            <PaymentWizard />
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Layout
        title="Мой профиль"
        subtitle={`@${user?.username || 'unknown'}`}
        backTo="/"
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card variant="glass" padding="lg" className="relative overflow-hidden">
            {/* Декоративный фон */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full filter blur-3xl opacity-20 -mr-32 -mt-32" />

            <div className="relative z-10 flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </span>
              </div>
              <div>
                <p className="text-dark-600 flex items-center space-x-2">
                  <span>{user.first_name} {user.last_name}</span>
                  <Badge variant="success" size="sm" dot>Активен</Badge>
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {isTrialUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card variant="glass" padding="md" className="border border-primary-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  ⭐
                </div>
                <div className="flex-1">
                  <div className="text-sm text-primary-900 font-semibold">Приветственный бонус активен</div>
                  <div className="text-xs text-gray-600">
                    Вам начислены приветственные ⭐️звезды при регистрации. Сначала тратятся бонусные ⭐️звезды, затем подписка или оплаченные пакеты.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary-800">{user.balance_credits}</div>
                  <div className="text-xs text-gray-500">Текущий баланс ⭐️звезд</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

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
          {/* Баланс ⭐️звезд */}
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
                  <h2 className="text-lg font-semibold">Баланс ⭐️звезд</h2>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-5xl font-bold mb-2">{user.balance_credits}</div>
                <p className="text-secondary-100 text-sm font-medium">⭐️звезд доступно</p>
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
                  {subscriptionLabel}
                </div>
                <p className="text-primary-100 text-sm font-medium">{getSubscriptionStatus()}</p>
                {hasActiveSubscription ? (
                  <div className="mt-4 space-y-2">
                    {actionsRemaining != null && (
                      <div className="inline-flex items-center px-3 py-1 rounded-lg bg-white/15 text-xs font-semibold">
                        Осталось генераций по подписке: {actionsRemaining}
                      </div>
                    )}
                    {daysLeft !== null && (
                      <div className="text-xs text-primary-50">
                        До завершения подписки: {daysLeft} дн.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setShowPaymentWizard(true)}
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      Подключить подписку
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

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
            Купить ⭐️звезды или подписку
          </Button>
        </motion.div>

        {/* История платежей */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card variant="glass" padding="lg">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-2xl font-bold gradient-text">История платежей</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-dark-500 hidden sm:inline">
                  Отметьте платежи и нажмите «Удалить» или используйте корзину в карточке.
                </span>
                {selectedPayments.length > 0 && (
                  <span className="text-sm text-dark-600">
                    Выбрано: <span className="font-semibold">{selectedPayments.length}</span>
                  </span>
                )}
                <button
                  onClick={handleDeleteSelected}
                  disabled={!selectedPayments.length || isDeletingPayments || isLoading}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                    !selectedPayments.length || isDeletingPayments || isLoading
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-1-2h-6l-1 2z" />
                  </svg>
                  Удалить выбранные
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
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
                      <div className="flex items-start gap-3">
                        <label className="pt-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            checked={selectedPayments.includes(payment.id)}
                            onChange={() => togglePaymentSelection(payment.id)}
                          />
                        </label>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                          <div className="flex items-start sm:items-center space-x-4 flex-1">
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
                                <span className="font-bold text-dark-900 truncate">
                                  {payment.payment_type === 'subscription'
                                    ? `Подписка ${payment.subscription_type || ''}`.trim()
                                    : payment.credits_amount
                                      ? `${payment.credits_amount} ⭐️звезд`
                                      : 'Покупка ⭐️звезд'}
                                </span>
                                {getPaymentStatusBadge(payment.status)}
                              </div>
                              <div className="text-xs text-dark-600 space-y-0.5">
                                <div className="break-all">ID: {payment.payment_id || '—'}</div>
                                <div>{formatDate(payment.created_at)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right sm:ml-4 flex-shrink-0">
                            <div className="font-bold text-lg sm:text-xl text-dark-900">
                              {payment.amount} ₽
                            </div>
                            <div className="text-xs text-dark-500 mt-1">
                              {payment.paid_at ? 'Оплачено' : formatDate(payment.created_at)}
                            </div>
                            <button
                              className="mt-2 inline-flex items-center text-xs text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteSingle(payment.id)}
                              disabled={isDeletingPayments || isLoading}
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-1-2h-6l-1 2z" />
                              </svg>
                              Удалить
                            </button>
                          </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <Card
                  variant="gradient"
                  padding="md"
                  className="border border-success-200 h-full shadow-sm"
                >
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-h-[104px]">
                    <div className="text-3xl font-bold text-success-700 mb-1">
                      {referralStats.total_referrals}
                    </div>
                    <div className="text-xs font-semibold text-success-600">Всего приглашённых</div>
                  </div>
                </Card>
                <Card
                  variant="gradient"
                  padding="md"
                  className="border border-primary-200 h-full shadow-sm"
                >
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-h-[104px]">
                    <div className="text-3xl font-bold text-primary-700 mb-1">
                      {referralStats.active_referrals}
                    </div>
                    <div className="text-xs font-semibold text-primary-600">Активных (оплатили)</div>
                  </div>
                </Card>
                <Card
                  variant="gradient"
                  padding="md"
                  className="border border-secondary-200 h-full shadow-sm"
                >
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-h-[104px]">
                    <div className="text-3xl font-bold text-secondary-700 mb-1">
                      {referralStats.total_earned}
                    </div>
                    <div className="text-xs font-semibold text-secondary-600">Заработано, ⭐️звезд</div>
                  </div>
                </Card>
              </div>

              {/* Реферальная ссылка */}
              <Card variant="bordered" padding="md" className="mb-4 bg-white">
                <label className="block text-sm font-bold text-dark-800 mb-3">
                  Ваша реферальная ссылка
                </label>
                <div className="flex flex-wrap items-stretch gap-2">
                  <input
                    type="text"
                    value={referralStats.referral_link}
                    readOnly
                    className="w-full sm:flex-1 min-w-0 px-4 py-3 border-2 border-dark-200 rounded-xl bg-dark-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-shrink-0 w-full sm:w-auto"
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
                    className="flex-shrink-0 w-full sm:w-auto"
                    onClick={async () => {
                      await shareReferralLink(
                        referralStats.referral_link,
                        'Присоединяйся к AI Generator и получай бонусы за создание изображений!'
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
                  💰 Приглашайте друзей: 10 ⭐️звезд за каждого, кто оплатит подписку или покупку ⭐️звезд.
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
                              {referral.is_awarded ? 'Активный (после оплаты)' : 'Ожидает первой покупки'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            +{referral.credits_awarded} ⭐️звезд
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
        </Card>
      </motion.div>

        {/* Информация о пользователе */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Информация об аккаунте
          </h2>
          <div className="space-y-3 text-sm">
            {user.email && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{user.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Статус email:</span>
                  <div className="flex items-center space-x-2">
                    {user.email_verified ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Подтверждён
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Не подтверждён
                        </span>
                        <button
                          onClick={async () => {
                            setIsSendingVerification(true);
                            try {
                              const response = await sendVerificationEmail();
                              toast.success(response.message);
                            } catch (error: any) {
                              const errorText = error.response?.data?.detail || 'Не удалось отправить письмо';
                              toast.error(errorText);
                            } finally {
                              setIsSendingVerification(false);
                            }
                          }}
                          disabled={isSendingVerification}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSendingVerification ? 'Отправка...' : 'Отправить снова'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {user.telegram_id && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Telegram ID:</span>
                <span className="font-medium text-gray-900">{user.telegram_id}</span>
              </div>
            )}
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
    </Layout>
  </AuthGuard>
);
};
