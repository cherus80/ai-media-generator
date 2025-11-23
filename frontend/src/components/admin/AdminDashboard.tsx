/**
 * Компонент главной панели администратора.
 *
 * Отображает:
 * - Ключевые метрики в карточках статистики
 * - График регистраций пользователей
 * - Статистику активности пользователей
 * - Кнопки экспорта данных
 */

import React, { useState, useEffect } from 'react';
import { StatsCard } from './StatsCard';
import { RegistrationsChart } from './RegistrationsChart';
import {
  getAdminStats,
  getUserRegistrations,
  getUserActivity,
  exportUsersCSV,
  exportPaymentsCSV,
  exportGenerationsCSV,
  formatCurrency,
  formatNumber,
} from '../../api/admin';
import type {
  AdminStats,
  UserRegistrationData,
  UserActivityStats,
  StatsCardData,
} from '../../types/admin';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [registrations, setRegistrations] = useState<UserRegistrationData[]>([]);
  const [activity, setActivity] = useState<UserActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [exportingPayments, setExportingPayments] = useState(false);
  const [exportingGenerations, setExportingGenerations] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, registrationsData, activityData] = await Promise.all([
        getAdminStats(),
        getUserRegistrations(30),
        getUserActivity(),
      ]);
      setStats(statsData);
      setRegistrations(registrationsData);
      setActivity(activityData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Не удалось загрузить данные панели управления');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      await exportUsersCSV();
    } catch (err) {
      console.error('Failed to export users:', err);
      alert('Не удалось экспортировать пользователей');
    } finally {
      setExportingUsers(false);
    }
  };

  const handleExportPayments = async () => {
    setExportingPayments(true);
    try {
      await exportPaymentsCSV();
    } catch (err) {
      console.error('Failed to export payments:', err);
      alert('Не удалось экспортировать платежи');
    } finally {
      setExportingPayments(false);
    }
  };

  const handleExportGenerations = async () => {
    setExportingGenerations(true);
    try {
      await exportGenerationsCSV();
    } catch (err) {
      console.error('Failed to export generations:', err);
      alert('Не удалось экспортировать генерации');
    } finally {
      setExportingGenerations(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error || !stats || !activity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Ошибка загрузки данных'}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Подготовка данных для карточек статистики
  const statsCards: StatsCardData[] = [
    {
      title: 'Всего пользователей',
      value: formatNumber(stats.total_users),
      change: stats.new_users_month > 0 ? (stats.new_users_month / Math.max(stats.total_users - stats.new_users_month, 1)) * 100 : 0,
      icon: '👥',
      color: 'blue',
    },
    {
      title: 'Новых за месяц',
      value: formatNumber(stats.new_users_month),
      icon: '📈',
      color: 'green',
    },
    {
      title: 'Активных сегодня',
      value: formatNumber(stats.active_users_today),
      icon: '⚡',
      color: 'yellow',
    },
    {
      title: 'Всего генераций',
      value: formatNumber(stats.total_generations),
      change: stats.generations_month > 0 ? (stats.generations_month / Math.max(stats.total_generations - stats.generations_month, 1)) * 100 : 0,
      icon: '🎨',
      color: 'purple',
    },
    {
      title: 'Генераций за месяц',
      value: formatNumber(stats.generations_month),
      icon: '📊',
      color: 'indigo',
    },
    {
      title: 'Доход за месяц',
      value: formatCurrency(stats.revenue_month),
      icon: '💰',
      color: 'green',
    },
    {
      title: 'Всего доход',
      value: formatCurrency(stats.total_revenue),
      icon: '💎',
      color: 'blue',
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
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Панель администратора</h1>
          <p className="mt-2 text-gray-600">Обзор ключевых метрик и статистики</p>
        </div>

        {/* Карточки статистики */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((cardData, index) => (
            <StatsCard key={index} data={cardData} />
          ))}
        </div>

        {/* График регистраций */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Регистрации пользователей (последние 30 дней)
            </h2>
            <RegistrationsChart data={registrations} />
          </div>
        </div>

        {/* Статистика активности */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Активность пользователей
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Активных сегодня</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(activity.active_today)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Активных за неделю</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(activity.active_this_week)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Активных за месяц</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(activity.active_this_month)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Среднее генераций на пользователя</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activity.avg_generations_per_user.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Всего потрачено кредитов</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(activity.total_credits_spent)}
                </p>
              </div>
            </div>

            {/* Топ пользователей по генерациям */}
            {activity.top_users.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Топ пользователей по генерациям
                </h3>
                <div className="space-y-2">
                  {activity.top_users.map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.username ? `@${user.username}` : user.email || `ID: ${user.id}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatNumber(user.generations_count)}
                        </p>
                        <p className="text-xs text-gray-500">генераций</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Кнопки экспорта */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Экспорт данных</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleExportUsers}
              disabled={exportingUsers}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingUsers ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Экспорт...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Экспорт пользователей (CSV)
                </>
              )}
            </button>

            <button
              onClick={handleExportPayments}
              disabled={exportingPayments}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingPayments ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Экспорт...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Экспорт платежей (CSV)
                </>
              )}
            </button>

            <button
              onClick={handleExportGenerations}
              disabled={exportingGenerations}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingGenerations ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Экспорт...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Экспорт генераций (CSV)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
