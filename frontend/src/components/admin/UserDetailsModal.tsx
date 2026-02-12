/**
 * Компонент модального окна для просмотра и редактирования данных пользователя.
 *
 * Отображает:
 * - Информацию о пользователе
 * - Последние генерации
 * - Последние платежи
 * - Рефералов
 * - Кнопку редактирования кредитов
 */

import React, { useState, useEffect } from 'react';
import { getUserDetails, formatCurrency, formatNumber, formatDate, formatRelativeTime } from '../../api/admin';
import { EditCreditsModal } from './EditCreditsModal';
import type { UserDetailsResponse } from '../../types/admin';

interface UserDetailsModalProps {
  userId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const [userDetails, setUserDetails] = useState<UserDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditCreditsModal, setShowEditCreditsModal] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId]);

  const loadUserDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserDetails(userId);
      setUserDetails(data);
    } catch (err) {
      console.error('Failed to load user details:', err);
      setError('Не удалось загрузить данные пользователя');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreditsUpdated = () => {
    setShowEditCreditsModal(false);
    loadUserDetails(); // Перезагружаем данные пользователя
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Детали пользователя</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={loadUserDetails}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Попробовать снова
                  </button>
                </div>
              ) : userDetails ? (
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Основная информация
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">ID</p>
                        <p className="font-medium text-gray-900">{userDetails.user.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Telegram ID</p>
                        <p className="font-medium text-gray-900">{userDetails.user.telegram_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Username</p>
                        <p className="font-medium text-gray-900">
                          {userDetails.user.username ? `@${userDetails.user.username}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900">{userDetails.user.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Имя</p>
                        <p className="font-medium text-gray-900">
                          {userDetails.user.first_name || '—'} {userDetails.user.last_name || ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Роль</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userDetails.user.role === 'ADMIN'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userDetails.user.role}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Статус доступа</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userDetails.user.is_blocked
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {userDetails.user.is_blocked ? 'Заблокирован' : 'Активен'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Баланс и подписка */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Баланс и подписка</h3>
                      <button
                        onClick={() => setShowEditCreditsModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Редактировать ⭐️звезды
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Баланс ⭐️звезд</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(userDetails.user.balance_credits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Freemium генераций</p>
                        <p className="text-2xl font-bold text-green-600">
                          {userDetails.user.freemium_actions_remaining}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Подписка</p>
                        {userDetails.user.subscription_type ? (
                          <div>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {userDetails.user.subscription_type}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              до {formatDate(userDetails.user.subscription_expires_at)}
                            </p>
                          </div>
                        ) : (
                          <p className="font-medium text-gray-400">Нет подписки</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Статистика */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Статистика</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Всего генераций</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(userDetails.user.total_generations)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Потрачено</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(userDetails.user.total_spent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Рефералов</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {userDetails.user.referrals_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Регистрация</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(userDetails.user.created_at)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(userDetails.user.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Последние генерации */}
                  {userDetails.recent_generations.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Последние генерации ({userDetails.recent_generations.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Тип</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Статус</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Дата</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {userDetails.recent_generations.map((gen: any, index: number) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{gen.generation_type || '—'}</td>
                                  <td className="px-4 py-2 text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      gen.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : gen.status === 'failed'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {gen.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    {formatRelativeTime(gen.created_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Последние платежи */}
                  {userDetails.recent_payments.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Последние платежи ({userDetails.recent_payments.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Тип</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Сумма</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Статус</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Дата</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {userDetails.recent_payments.map((payment: any, index: number) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{payment.payment_type || '—'}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    {formatCurrency(payment.amount)}
                                  </td>
                                  <td className="px-4 py-2 text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      payment.status === 'succeeded'
                                        ? 'bg-green-100 text-green-800'
                                        : payment.status === 'canceled'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {payment.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    {formatRelativeTime(payment.created_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Рефералы */}
                  {userDetails.referrals.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Рефералы ({userDetails.referrals.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Пользователь</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Дата</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {userDetails.referrals.map((referral) => (
                                <tr key={referral.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{referral.id}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">
                                    {referral.username ? `@${referral.username}` : referral.email || '—'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    {formatRelativeTime(referral.created_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно добавления ⭐️звезд */}
      <EditCreditsModal
        user={
          userDetails
            ? {
                id: userDetails.user.id,
                email: userDetails.user.email || 'unknown',
                username: userDetails.user.username || undefined,
                balance_credits: userDetails.user.balance_credits,
              }
            : null
        }
        isOpen={showEditCreditsModal}
        onClose={() => setShowEditCreditsModal(false)}
        onSuccess={handleCreditsUpdated}
      />
    </>
  );
};
