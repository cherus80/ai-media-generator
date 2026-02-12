import { useEffect, useState } from 'react';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { getFittingHistory } from '../api/fitting';
import type { GenerationHistoryItem } from '../types/fitting';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function HistoryPage() {
  const [items, setItems] = useState<GenerationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getFittingHistory(1, 50);
      setItems(response.items || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Не удалось загрузить историю');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const renderStatus = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      completed: { text: 'Готово', color: 'bg-green-100 text-green-800' },
      processing: { text: 'В процессе', color: 'bg-blue-100 text-blue-800' },
      pending: { text: 'Ожидание', color: 'bg-yellow-100 text-yellow-800' },
      failed: { text: 'Ошибка', color: 'bg-red-100 text-red-800' },
    };
    const data = map[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${data.color}`}>{data.text}</span>;
  };

  const renderType = (type?: string) => {
    if (type === 'editing') {
      return <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Редактирование</span>;
    }
    return <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Примерка</span>;
  };

  return (
    <AuthGuard>
      <Layout
        title="История генераций"
        subtitle="Последние результаты примерки и редактирования"
        backTo="/"
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
          <Card padding="lg" className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-10 text-gray-600 space-x-3">
                <div className="animate-spin h-6 w-6 border-b-2 border-primary-600 rounded-full" />
                <span>Загружаем историю...</span>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            {!isLoading && !error && items.length === 0 && (
              <div className="text-center text-gray-500 py-10">
                История пока пуста. Попробуйте сгенерировать первую примерку.
              </div>
            )}

            {!isLoading && !error && items.length > 0 && (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-gray-200 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:shadow-sm transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m0-4l-4.553-2.276A1 1 0 009 8.618v6.764a1 1 0 001.447.894L15 14m0-4v4" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          {renderStatus(item.status)}
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ru })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-700">
                          <span>⭐️Звезды: {item.credits_spent ?? 0}</span>
                          {renderType(item.generation_type)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {item.image_url && (
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-600 hover:text-primary-700 text-sm font-semibold underline"
                        >
                          Открыть результат
                        </a>
                      )}
                      <span className="text-xs text-gray-400">Задача: {item.task_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Layout>
    </AuthGuard>
  );
}
