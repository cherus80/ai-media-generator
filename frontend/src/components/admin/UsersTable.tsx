/**
 * Компонент таблицы пользователей для админки.
 *
 * Отображает список пользователей с фильтрацией, сортировкой и пагинацией.
 */

import React, { useState, useEffect } from 'react';
import { getAdminUsers } from '../../api/admin';
import { formatCurrency, formatRelativeTime, formatNumber } from '../../api/admin';
import type { AdminUserItem, AdminUsersRequest } from '../../types/admin';

interface UsersTableProps {
  onError?: (error: Error) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({ onError }) => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    loadUsers();
  }, [page, sortBy, order, filterActive]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const params: AdminUsersRequest = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        order,
        search: search || undefined,
        filter_active: filterActive,
      };
      const response = await getAdminUsers(params);
      setUsers(response.users);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error) {
      console.error('Failed to load users:', error);
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setOrder('desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return order === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Фильтры */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Поиск по имени пользователя или ID Telegram..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Поиск
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilterActive(undefined)}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              filterActive === undefined
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilterActive(true)}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              filterActive === true
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => setFilterActive(false)}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              filterActive === false
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Неактивные
          </button>
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center gap-1">
                  ID {getSortIcon('id')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('username')}
              >
                <div className="flex items-center gap-1">
                  Пользователь {getSortIcon('username')}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Баланс
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Подписка
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Генераций
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Потрачено
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-1">
                  Регистрация {getSortIcon('created_at')}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('last_active_at')}
              >
                <div className="flex items-center gap-1">
                  Активность {getSortIcon('last_active_at')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Загрузка...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Пользователей не найдено
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.id}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {user.username ? `@${user.username}` : user.first_name || 'Без имени'}
                      </div>
                      <div className="text-xs text-gray-500">ID Telegram: {user.telegram_id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm text-gray-900">
                        {formatNumber(user.balance_credits)} кр.
                      </div>
                      {user.freemium_actions_remaining > 0 && (
                        <div className="text-xs text-green-600">
                          +{user.freemium_actions_remaining} бесп.
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {user.subscription_type ? (
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.subscription_type}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(user.total_generations)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(user.total_spent)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatRelativeTime(user.created_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {user.is_active ? (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-900">
                          {formatRelativeTime(user.last_active_at)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-400">
                          {formatRelativeTime(user.last_active_at)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="px-4 py-3 border-t border-gray-200 sm:flex sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700">
          Показано <span className="font-medium">{users.length}</span> из{' '}
          <span className="font-medium">{formatNumber(total)}</span> пользователей
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперёд
          </button>
        </div>
      </div>
    </div>
  );
};
