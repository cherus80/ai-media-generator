import React, { useEffect, useState } from 'react';
import { exportConsentsCSV, getConsents, deleteConsents } from '../../api/admin';
import type { ConsentExportItem, ConsentExportRequest, ConsentExportResponse } from '../../types/admin';

type Filters = {
  date_from: string;
  date_to: string;
  version: string;
};

const formatDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
};

export const Consents: React.FC = () => {
  const [filters, setFilters] = useState<Filters>({
    date_from: '',
    date_to: '',
    version: '',
  });
  const [data, setData] = useState<ConsentExportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async (payload?: Partial<ConsentExportRequest>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getConsents({
        date_from: payload?.date_from ?? (filters.date_from ? filters.date_from : undefined),
        date_to: payload?.date_to ?? (filters.date_to ? filters.date_to : undefined),
        version: payload?.version ?? (filters.version ? filters.version : undefined),
      });
      setData(response);
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось загрузить согласия';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => data?.consents?.some((item) => item.id === id))
    );
  }, [data]);

  const handleExport = async () => {
    try {
      await exportConsentsCSV({
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        version: filters.version || undefined,
      });
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось выгрузить CSV';
      setError(msg);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!data?.consents?.length) return;
    if (selectedIds.length === data.consents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.consents.map((item) => item.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteConsents(selectedIds);
      setSelectedIds([]);
      await load();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось удалить записи';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const allSelected = data?.consents?.length ? selectedIds.length === data.consents.length : false;

  const renderRow = (item: ConsentExportItem) => (
    <tr key={item.id}>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={() => toggleSelect(item.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </td>
      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{item.user_id}</td>
      <td className="px-4 py-2 text-sm text-gray-700">{item.email || '—'}</td>
      <td className="px-4 py-2 text-sm text-gray-700">{item.consent_version}</td>
      <td className="px-4 py-2 text-sm text-gray-700">{item.source}</td>
      <td className="px-4 py-2 text-sm text-gray-700">{item.ip_address || '—'}</td>
      <td className="px-4 py-2 text-sm text-gray-700">{formatDateTime(item.granted_at)}</td>
      <td className="px-4 py-2 text-xs text-gray-500 max-w-[280px] truncate" title={item.user_agent || ''}>
        {item.user_agent || '—'}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Согласия на обработку ПДн</h2>
        <p className="mt-1 text-sm text-gray-600">
          Просмотр и выгрузка согласий пользователей для предоставления по запросам регуляторов.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата с</label>
            <input
              type="date"
              value={formatDateInput(filters.date_from)}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата по</label>
            <input
              type="date"
              value={formatDateInput(filters.date_to)}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Версия согласия</label>
            <input
              type="text"
              placeholder="например: v1"
              value={filters.version}
              onChange={(e) => setFilters((prev) => ({ ...prev, version: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => load()}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-semibold shadow hover:bg-primary-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Загрузка...' : 'Применить'}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:bg-gray-50"
            >
              Экспорт CSV
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Выбрано: <span className="font-semibold">{selectedIds.length}</span>
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedIds.length || isDeleting || loading}
            className={`inline-flex items-center px-3 py-2 rounded-md border text-sm font-semibold shadow-sm ${
              !selectedIds.length || isDeleting || loading
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-1-2h-6l-1 2z" />
            </svg>
            {isDeleting ? 'Удаляем...' : 'Удалить выбранные'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID пользователя</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Эл. почта</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Версия</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Источник</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP-адрес</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Дата/время</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Идентификатор устройства</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.consents?.length ? data.consents.map(renderRow) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                    {loading ? 'Загружаем...' : 'Нет данных за выбранный период'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 flex justify-between">
            <span>Всего записей: <span className="font-semibold">{data.total_count}</span></span>
            <span>Период: {data.date_from ? formatDateTime(data.date_from) : '—'} — {data.date_to ? formatDateTime(data.date_to) : '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
