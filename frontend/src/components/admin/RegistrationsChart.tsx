/**
 * Компонент графика регистраций пользователей.
 *
 * Использует recharts для отображения столбчатой диаграммы
 * регистраций пользователей по дням.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UserRegistrationData } from '../../types/admin';

interface RegistrationsChartProps {
  data: UserRegistrationData[];
}

export const RegistrationsChart: React.FC<RegistrationsChartProps> = ({ data }) => {
  // Если нет данных, показываем заглушку
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Нет данных для отображения</p>
      </div>
    );
  }

  // Форматируем дату для отображения на оси X
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  };

  // Кастомный тултип для отображения детальной информации
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {formatDate(data.date)}
          </p>
          <p className="text-sm text-blue-600 font-semibold">
            Регистраций: {data.count}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            stroke="#d1d5db"
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            stroke="#d1d5db"
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            name="Регистраций"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
