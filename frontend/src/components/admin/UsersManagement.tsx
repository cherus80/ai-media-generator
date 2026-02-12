/**
 * UsersManagement - компонент для управления пользователями
 *
 * Функционал:
 * - Таблица пользователей с пагинацией
 * - Поиск по email/username
 * - Фильтр по роли
 * - Действия: Редактирование кредитов, Block/Unblock, Delete User, Make Admin (для super admin)
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { updateUserBlockStatus } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

interface User {
  id: number;
  email: string;
  username?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  balance_credits: number;
  is_blocked: boolean;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  last_login_device?: string | null;
  last_login_user_agent?: string | null;
  ip_shared_accounts?: number;
  device_shared_accounts?: number;
  suspicion_score?: number;
  is_suspicious?: boolean;
  suspicion_reason?: string | null;
  subscription_type?: string;
  subscription_expires_at?: string;
  created_at: string;
  last_active_at?: string;
}

interface UsersManagementProps {
  onEditCredits?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  onMakeAdmin?: (user: User) => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({
  onEditCredits,
  onDeleteUser,
  onMakeAdmin,
}) => {
  const { isSuperAdmin } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchUsers();
  }, [page, search, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: limit.toString(),
      });

      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const response = await apiClient.get(
        `/api/v1/admin/users?${params.toString()}`
      );

      const data = response.data;
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleBlock = async (user: User) => {
    const targetState = !user.is_blocked;
    const actionLabel = targetState ? 'заблокировать' : 'разблокировать';

    const isConfirmed = window.confirm(
      `Вы уверены, что хотите ${actionLabel} пользователя ${user.email || `ID ${user.id}`}?`
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setActionUserId(user.id);
      await updateUserBlockStatus(user.id, {
        is_blocked: targetState,
        reason: targetState ? 'Blocked from admin panel (anti-multiaccounting)' : 'Unblocked from admin panel',
      });
      await fetchUsers();
    } catch (error) {
      console.error('Failed to update user block status:', error);
      window.alert('Не удалось изменить статус блокировки пользователя');
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок и статистика */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Управление пользователями</h2>
        <p className="mt-1 text-sm text-gray-600">
          Всего пользователей: <span className="font-semibold">{total}</span>
        </p>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Поиск */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Поиск
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Эл. почта или имя пользователя..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Фильтр по роли */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Все роли</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Загрузка...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Пользователи не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Эл. почта
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Роль
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Риск
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Устройство
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ⭐️Звезды
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Подписка
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={
                      user.is_blocked
                        ? 'bg-red-50 hover:bg-red-100'
                        : user.is_suspicious
                        ? 'bg-amber-50 hover:bg-amber-100'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      {user.username && (
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.is_blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.is_blocked ? 'Заблокирован' : 'Активен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_suspicious ? (
                        <span
                          className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800"
                          title={user.suspicion_reason || 'Подозрительная активность'}
                        >
                          ⚠️ {user.suspicion_score ?? 0}/100
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">
                          {user.suspicion_score ?? 0}/100
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{user.last_login_ip || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(user.last_login_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={user.last_login_device || 'Нет данных'}>
                        {user.last_login_device || 'Нет данных'}
                      </div>
                      {user.last_login_user_agent && (
                        <div
                          className="text-xs text-gray-500 truncate"
                          title={user.last_login_user_agent}
                        >
                          {user.last_login_user_agent}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.balance_credits}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.subscription_type ? (
                        <div>
                          <div className="font-medium">{user.subscription_type}</div>
                          <div className="text-xs">
                            до {formatDate(user.subscription_expires_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Нет</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {/* Edit Credits */}
                      <button
                        onClick={() => onEditCredits?.(user)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Редактировать баланс ⭐️звезд"
                      >
                        ✏️
                      </button>

                      {/* Make Admin (только для super admin) */}
                      {isSuperAdmin && user.role === 'USER' && (
                        <button
                          onClick={() => onMakeAdmin?.(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Сделать админом"
                        >
                          👑
                        </button>
                      )}

                      {/* Block / Unblock */}
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleToggleBlock(user)}
                          className={user.is_blocked ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'}
                          title={user.is_blocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
                          disabled={actionUserId === user.id}
                        >
                          {actionUserId === user.id ? '⏳' : user.is_blocked ? '✅' : '⛔'}
                        </button>
                      )}

                      {/* Delete User */}
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => onDeleteUser?.(user)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить пользователя"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Назад
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Показано <span className="font-medium">{(page - 1) * limit + 1}</span> -{' '}
                  <span className="font-medium">
                    {Math.min(page * limit, total)}
                  </span>{' '}
                  из <span className="font-medium">{total}</span> пользователей
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    →
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
