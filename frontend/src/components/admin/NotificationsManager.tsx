import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getAdminUsers, sendAdminNotification } from '../../api/admin';
import type { AdminUserItem } from '../../types/admin';

export const NotificationsManager: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const response = await getAdminUsers({
          page,
          page_size: pageSize,
          search: search || undefined,
        });
        setUsers(response.users || []);
        setTotal(response.total || 0);
      } catch (error) {
        console.error('Failed to load users:', error);
        toast.error('Не удалось загрузить пользователей');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [page, pageSize, search]);

  const pageUserIds = useMemo(() => users.map((user) => user.id), [users]);
  const allOnPageSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageUserIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageUserIds])));
  };

  const toggleSelectUser = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    if (!sendToAll && selectedIds.length === 0) {
      toast.error('Выберите пользователей или включите отправку всем');
      return;
    }

    setIsSending(true);
    try {
      const response = await sendAdminNotification({
        title: title.trim() ? title.trim() : undefined,
        message: message.trim(),
        user_ids: sendToAll ? undefined : selectedIds,
        send_to_all: sendToAll,
      });

      toast.success(
        sendToAll
          ? `Сообщение отправлено всем (${response.created_count})`
          : `Отправлено: ${response.created_count}, пропущено: ${response.skipped_count}`
      );

      setMessage('');
      setTitle('');
      setSelectedIds([]);
      setSendToAll(false);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Не удалось отправить сообщение';
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Оповещения пользователям</h2>
        <p className="mt-1 text-sm text-gray-600">
          Отправляйте сообщения выбранным пользователям или сразу всем.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок (необязательно)</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Важное обновление"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Поиск пользователей</label>
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Email, username или Telegram ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Сообщение</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Введите текст уведомления..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={(event) => {
                setSendToAll(event.target.checked);
                if (event.target.checked) {
                  setSelectedIds([]);
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Отправить всем пользователям
          </label>
          {!sendToAll && (
            <span className="text-sm text-gray-500">Выбрано: {selectedIds.length}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-5 py-2 rounded-md bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
          >
            {isSending ? 'Отправка...' : 'Отправить уведомление'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Список пользователей</h3>
            <p className="text-sm text-gray-500">Всего: {total}</p>
          </div>
          {!sendToAll && (
            <button
              onClick={toggleSelectAll}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              {allOnPageSelected ? 'Снять выбор на странице' : 'Выбрать всех на странице'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Загрузка...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Пользователи не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      disabled={sendToAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      aria-label="Выбрать всех на странице"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Роль</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={sendToAll ? 'opacity-60' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                        disabled={sendToAll}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Выбрать пользователя ${user.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {user.email || user.username || `ID ${user.id}`}
                      </div>
                      {user.username && <div className="text-xs text-gray-500">@{user.username}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-md border border-gray-200 disabled:opacity-50"
            >
              Назад
            </button>
            <span>
              Страница {page} из {totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-md border border-gray-200 disabled:opacity-50"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
