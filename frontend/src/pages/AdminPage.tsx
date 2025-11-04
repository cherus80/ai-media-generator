/**
 * Страница админки.
 *
 * Отображает:
 * - Общую статистику приложения
 * - Таблицу пользователей
 * - Кнопку экспорта платежей
 * - Модальное окно для ввода ADMIN_SECRET_KEY
 */

import React, { useState, useEffect } from 'react';
import { StatsCard } from '../components/admin/StatsCard';
import { UsersTable } from '../components/admin/UsersTable';
import {
  getAdminStats,
  setAdminSecret,
  hasAdminSecret,
  exportPaymentsCSV,
  formatNumber,
  formatCurrency,
} from '../api/admin';
import type { AdminStats, StatsCardData } from '../types/admin';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  useEffect(() => {
    // Проверяем, установлен ли секретный ключ
    if (!hasAdminSecret()) {
      setShowSecretModal(true);
    } else {
      loadStats();
    }
  }, []);

  const loadStats = async () => {
    setIsLoadingStats(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error: any) {
      console.error('Failed to load admin stats:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setError('Неверный секретный ключ. Пожалуйста, введите правильный ключ.');
        setShowSecretModal(true);
      } else {
        setError('Не удалось загрузить статистику. Проверьте соединение.');
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSecretSubmit = () => {
    if (!secretInput.trim()) {
      alert('Пожалуйста, введите секретный ключ');
      return;
    }
    setAdminSecret(secretInput.trim());
    setShowSecretModal(false);
    setSecretInput('');
    loadStats();
  };

  const handleExportPayments = async () => {
    setIsExporting(true);
    try {
      await exportPaymentsCSV({
        status: 'succeeded',
      });
    } catch (error) {
      console.error('Failed to export payments:', error);
      alert('Не удалось экспортировать платежи. Проверьте секретный ключ.');
    } finally {
      setIsExporting(false);
    }
  };

  // Подготовка данных для карточек статистики
  const statsCards: StatsCardData[] = stats
    ? [
        {
          title: 'Всего пользователей',
          value: formatNumber(stats.total_users),
          change: stats.new_users_month > 0 ? ((stats.new_users_month / stats.total_users) * 100) : 0,
          icon: '👥',
          color: 'blue',
        },
        {
          title: 'Активных за месяц',
          value: formatNumber(stats.active_users_month),
          change: stats.active_users_month > 0 ? ((stats.active_users_month / stats.total_users) * 100) : 0,
          icon: '✅',
          color: 'green',
        },
        {
          title: 'Выручка за месяц',
          value: formatCurrency(stats.revenue_month),
          change: parseFloat(stats.revenue_week) > 0 ? ((parseFloat(stats.revenue_week) / parseFloat(stats.revenue_month)) * 100) : 0,
          icon: '💰',
          color: 'green',
        },
        {
          title: 'Средний чек',
          value: formatCurrency(stats.average_payment),
          icon: '💳',
          color: 'indigo',
        },
        {
          title: 'Генераций за месяц',
          value: formatNumber(stats.generations_month),
          change: stats.generations_week > 0 ? ((stats.generations_week / stats.generations_month) * 100) : 0,
          icon: '🎨',
          color: 'purple',
        },
        {
          title: 'Активных подписок',
          value: formatNumber(
            stats.active_subscriptions_basic +
              stats.active_subscriptions_pro +
              stats.active_subscriptions_premium
          ),
          icon: '⭐',
          color: 'yellow',
        },
        {
          title: 'Примерки',
          value: formatNumber(stats.fitting_generations),
          icon: '👗',
          color: 'blue',
        },
        {
          title: 'Редактирования',
          value: formatNumber(stats.editing_generations),
          icon: '✏️',
          color: 'purple',
        },
        {
          title: 'Рефералы',
          value: formatNumber(stats.total_referrals),
          change: stats.active_referrals > 0 ? ((stats.active_referrals / stats.total_referrals) * 100) : 0,
          icon: '🤝',
          color: 'green',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Secret Key Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Админка — Вход
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Введите секретный ключ для доступа к админке
            </p>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSecretSubmit()}
              placeholder="ADMIN_SECRET_KEY"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            />
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSecretSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Войти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Админка</h1>
        <p className="text-gray-600 mt-1">AI Image Generator Bot — Панель управления</p>
      </div>

      {/* Error */}
      {error && !showSecretModal && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-600 font-medium">{error}</span>
          </div>
          <button
            onClick={() => setShowSecretModal(true)}
            className="mt-2 text-sm text-red-700 underline"
          >
            Изменить секретный ключ
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={loadStats}
          disabled={isLoadingStats}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isLoadingStats ? 'Обновление...' : 'Обновить статистику'}
        </button>
        <button
          onClick={handleExportPayments}
          disabled={isExporting}
          className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isExporting ? 'Экспорт...' : 'Экспорт платежей (CSV)'}
        </button>
        <button
          onClick={() => setShowSecretModal(true)}
          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Изменить ключ
        </button>
      </div>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Загрузка статистики...</p>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsCards.map((card, index) => (
              <StatsCard key={index} data={card} />
            ))}
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Пользователи</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Новых сегодня:</span>
                  <span className="font-medium">{formatNumber(stats.new_users_today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Новых за неделю:</span>
                  <span className="font-medium">{formatNumber(stats.new_users_week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Активных сегодня:</span>
                  <span className="font-medium">{formatNumber(stats.active_users_today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Freemium:</span>
                  <span className="font-medium">{formatNumber(stats.freemium_users)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Генерации</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Сегодня:</span>
                  <span className="font-medium">{formatNumber(stats.generations_today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">За неделю:</span>
                  <span className="font-medium">{formatNumber(stats.generations_week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Всего:</span>
                  <span className="font-medium">{formatNumber(stats.total_generations)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Freemium сегодня:</span>
                  <span className="font-medium">{formatNumber(stats.freemium_generations_today)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Платежи</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Сегодня:</span>
                  <span className="font-medium">{formatCurrency(stats.revenue_today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">За неделю:</span>
                  <span className="font-medium">{formatCurrency(stats.revenue_week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Всего:</span>
                  <span className="font-medium">{formatCurrency(stats.total_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Успешных:</span>
                  <span className="font-medium">{formatNumber(stats.successful_payments)} / {formatNumber(stats.total_payments)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Рефералы</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Всего:</span>
                  <span className="font-medium">{formatNumber(stats.total_referrals)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Активных:</span>
                  <span className="font-medium">{formatNumber(stats.active_referrals)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">% активных:</span>
                  <span className="font-medium">
                    {stats.total_referrals > 0
                      ? ((stats.active_referrals / stats.total_referrals) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Активные рефералы - пользователи, совершившие хотя бы одно действие после регистрации
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <UsersTable onError={(error) => setError(error.message)} />
        </>
      ) : null}
    </div>
  );
};
