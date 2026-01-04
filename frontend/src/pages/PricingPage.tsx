import React, { useEffect, useState } from 'react';
import { PublicLayout } from '../components/common/PublicLayout';
import { getTariffs } from '../api/payment';
import type { TariffsListResponse, BackendTariff } from '../types/payment';
import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export const PricingPage: React.FC = () => {
  const [data, setData] = useState<TariffsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';

  useSeo({
    title: 'Тарифы и подписки — AI Generator',
    description: 'Актуальные тарифы и подписки для генерации изображений и виртуальной примерки.',
    canonical: `${baseUrl}/pricing`,
    image: `${baseUrl}/logo.png`,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getTariffs();
        setData(res);
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Не удалось загрузить тарифы');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renderCard = (tariff: BackendTariff, isSubscription: boolean) => (
    <div
      key={tariff.tariff_id}
      className="bg-white rounded-2xl border border-white/70 shadow-sm p-6 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-dark-900">{tariff.name}</h3>
        {tariff.is_popular && (
          <span className="px-3 py-1 rounded-full text-xs bg-primary-100 text-primary-700 font-semibold">
            Рекомендуем
          </span>
        )}
      </div>
      <p className="text-sm text-dark-600">{tariff.description}</p>
      <p className="text-3xl font-bold text-dark-900">{Number(tariff.price)} ₽</p>
      <ul className="text-sm text-dark-700 space-y-1">
        <li>Действий/кредитов: {tariff.credits_amount ?? 0}</li>
        {isSubscription && tariff.duration_days && <li>Срок: {tariff.duration_days} дней</li>}
        {!isSubscription && <li>Кредиты не сгорают</li>}
      </ul>
      <Link
        to="/register"
        className="mt-auto inline-flex justify-center px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-primary-500 to-secondary-500 shadow hover:shadow-md transition"
      >
        Купить / Попробовать
      </Link>
    </div>
  );

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-primary-600 uppercase">Тарифы и пакеты</p>
          <h1 className="text-4xl font-bold text-dark-900">Подписки и кредиты</h1>
          <p className="text-dark-600">
            Цены совпадают с теми, что уходят в ЮKassa. После оплаты кредиты или подписка начисляются автоматически.
          </p>
        </div>

        {loading && (
          <div className="text-center text-dark-600">Загрузка тарифов...</div>
        )}
        {error && (
          <div className="text-center text-red-600">{error}</div>
        )}
        {data && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-dark-900 mb-4">Подписки</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.subscriptions.map((t) => renderCard(t, true))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-dark-900 mb-4">Кредиты</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.credits_packages.map((t) => renderCard(t, false))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-white/80 shadow-sm p-6 space-y-3">
          <h3 className="text-xl font-semibold text-dark-900">Как получить результат</h3>
          <ul className="text-sm text-dark-700 space-y-1">
            <li>1) Зарегистрируйтесь и подтвердите e-mail.</li>
            <li>2) Выберите тариф или пакет кредитов, оплатите через ЮKassa.</li>
            <li>3) Кредиты/подписка начисляются автоматически, баланс виден в профиле.</li>
            <li>4) История результатов доступна в разделе “История”. Фото хранятся 24 часа, чаты — 30 дней.</li>
          </ul>
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-primary-700">
            <Link to="/oferta" className="hover:text-primary-800">Оферта →</Link>
            <Link to="/privacy" className="hover:text-primary-800">Политика →</Link>
            <Link to="/contacts" className="hover:text-primary-800">Контакты →</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
