import React from 'react';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'ИИ Генератор';
const SUPPORT_LINK = 'https://t.me/+Fj-R8QqIEEg5OTE6';

const formatBuildDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const FEATURES = [
  {
    title: 'Примерка одежды',
    description: 'Загрузите своё фото и фото одежды — ИИ покажет, как выглядит образ.',
    icon: '👕',
  },
  {
    title: 'Генерация и редактирование фото',
    description: 'Запускайте генерацию по тексту или редактируйте загруженные фото в чате с референсами и ИИ-помощником.',
    icon: '🎨',
  },
  {
    title: 'Генерации по примерам',
    description: 'Запускайте генерации по готовым шаблонам и популярным образцам.',
    icon: '✨',
  },
];

export const AboutPage: React.FC = () => {
  const versionLabel = __APP_VERSION__ ? `v${__APP_VERSION__}` : '—';
  const updatedAt = formatBuildDate(__APP_BUILD_DATE__);

  return (
    <AuthGuard>
      <Layout
        title="О приложении"
        subtitle="Версия, функционал и поддержка"
        backTo="/app"
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-dark-900">{APP_NAME}</h2>
                <p className="text-sm text-dark-600">
                  Примерка, генерация и редактирование фото с помощью искусственного интеллекта.
                </p>
              </div>
              <Badge variant="info" size="md">
                {versionLabel}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Версия</p>
                <p className="text-lg font-semibold text-dark-900">{versionLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Дата обновления</p>
                <p className="text-lg font-semibold text-dark-900">{updatedAt}</p>
              </div>
            </div>
          </Card>

          <Card padding="lg" className="space-y-4">
            <h3 className="text-xl font-semibold text-dark-900">Функционал</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-slate-200 bg-white/70 p-4 space-y-2">
                  <div className="text-2xl">{feature.icon}</div>
                  <p className="text-sm font-semibold text-dark-900">{feature.title}</p>
                  <p className="text-sm text-dark-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" className="space-y-4">
            <h3 className="text-xl font-semibold text-dark-900">Поддержка</h3>
            <p className="text-sm text-dark-600">
              Если у вас есть вопросы по работе сервиса, напишите нам в Telegram.
            </p>
            <a
              href={SUPPORT_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-sm font-semibold hover:shadow-lg transition"
            >
              Перейти в Telegram поддержки
            </a>
          </Card>
        </div>
      </Layout>
    </AuthGuard>
  );
};
