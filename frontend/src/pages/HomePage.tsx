/**
 * Главная страница - выбор между Примеркой и Редактированием
 * Согласно ТЗ: два основных режима работы приложения
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { getGenerationExamples, incrementExampleUse } from '../api/content';
import type { GenerationExampleItem } from '../types/content';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [topExamples, setTopExamples] = React.useState<GenerationExampleItem[]>([]);
  const [loadingTop, setLoadingTop] = React.useState(true);

  React.useEffect(() => {
    const loadTop = async () => {
      setLoadingTop(true);
      try {
        const response = await getGenerationExamples({ sort: 'popular', limit: 6 });
        setTopExamples(response.items);
      } catch {
        setTopExamples([]);
      } finally {
        setLoadingTop(false);
      }
    };
    loadTop();
  }, []);

  const features = [
    {
      id: 'fitting',
      title: 'Примерка одежды',
      icon: '👕',
      description: 'Примерьте одежду и аксессуары на своё фото',
      details: 'Загрузите своё фото и фото одежды — AI покажет посадку и образ, но итог не гарантирует точного совпадения с оригиналом',
      path: '/fitting',
      gradient: 'from-purple-500 to-blue-500',
      cost: '2 ⭐️звезды за примерку',
    },
    {
      id: 'editing',
      title: 'Редактирование фото',
      icon: '🎨',
      description: 'Чат-редактор с референсами и улучшением промпта',
      details: 'Опишите правки, прикрепите референсы и выберите: отправить запрос сразу или улучшить через AI',
      path: '/editing',
      gradient: 'from-pink-500 to-orange-500',
      cost: 'Ассистент 1 ⭐️звезда + генерация 2 ⭐️звезды (или 1 генерация по подписке)',
    },
  ];

  return (
    <AuthGuard>
      <Layout
        title="AI Generator"
        subtitle="Примерка и редактирование фото"
        showBackButton={false}
        icon={
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      >
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Quick Start */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <Card variant="glass" padding="lg" className="border border-white/60">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-2">
                  <Badge variant="info" size="sm">
                    Быстрый старт
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold gradient-text">
                    Две главные функции приложения
                  </h2>
                  <p className="text-dark-600 text-sm md:text-base">
                    Сразу выберите, что хотите сделать: примерить одежду или отредактировать фото.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                  <button
                    onClick={() => navigate('/fitting')}
                    className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm md:text-base shadow-lg hover:shadow-xl transition"
                  >
                    👕 Виртуальная примерка
                  </button>
                  <button
                    onClick={() => navigate('/editing')}
                    className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white font-semibold text-sm md:text-base shadow-lg hover:shadow-xl transition"
                  >
                    🎨 Редактирование фото
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Top Examples */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold gradient-text mb-2">
                ТОП 6
              </h2>
              <p className="text-dark-600">
                Шесть самых популярных образцов, по которым чаще всего запускают генерацию.
              </p>
            </div>

            {loadingTop ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
                Загружаем примеры...
              </div>
            ) : topExamples.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
                Пока нет опубликованных примеров.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
                {topExamples.map((example) => (
                  <Card
                    key={example.id}
                    variant="glass"
                    hover
                    padding="none"
                    className="overflow-hidden border border-white/40 max-w-[360px] w-full"
                  >
                    <div className="relative">
                      <img
                        src={resolveImageUrl(example.image_url)}
                        alt={example.title || 'Пример генерации'}
                        className="w-full h-56 object-contain bg-slate-50"
                      />
                      <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                        {example.uses_count} запусков
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-3">
                      <h3 className="text-lg font-bold text-dark-900">
                        {example.title || 'Без названия'}
                      </h3>
                      <button
                        onClick={() => {
                          incrementExampleUse(example.id).catch(() => undefined);
                          navigate(`/app/examples/generate?prompt=${encodeURIComponent(example.prompt)}`);
                        }}
                        className="mt-auto px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:shadow-lg transition"
                      >
                        Сгенерировать по этому образцу
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/app/examples')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition"
              >
                Смотреть больше примеров
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6, delay: 0.1 }}
              className="inline-block mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-3xl blur-2xl opacity-30 animate-pulse-slow" />
                <div className="relative bg-white rounded-3xl p-8 shadow-large">
                  <h2 className="text-4xl font-bold gradient-text mb-2">
                    Выберите функцию
                  </h2>
                  <p className="text-dark-600 text-lg">
                    Примерьте одежду или отредактируйте изображение с помощью AI
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              >
                <Card
                  variant="glass"
                  hover
                  padding="none"
                  className="overflow-hidden cursor-pointer border-2 border-white/20 hover:border-primary-300 transition-all duration-300"
                  onClick={() => navigate(feature.path)}
                >
                  {/* Icon Header */}
                  <div className={`bg-gradient-to-br ${feature.gradient} p-8 text-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
                    <div className="relative">
                      <div className="text-7xl mb-4">{feature.icon}</div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-white/90 text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-6">
                    <p className="text-dark-700 mb-4 text-sm leading-relaxed">
                      {feature.details}
                    </p>

                    {/* Cost Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="neutral" size="md">
                        {feature.cost}
                      </Badge>
                    </div>

                    {/* Action Button */}
                    <button
                      className={`w-full py-3 px-6 bg-gradient-to-r ${feature.gradient} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
                    >
                      Начать
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Card variant="glass" padding="lg" className="border border-primary-200">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-success-500 to-primary-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold text-dark-900 mb-2">Быстро</h4>
                <p className="text-sm text-dark-600">
                  Результат за несколько секунд
                </p>
              </div>
            </Card>

            <Card variant="glass" padding="lg" className="border border-primary-200">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h4 className="font-bold text-dark-900 mb-2">Просто</h4>
                <p className="text-sm text-dark-600">
                  Интуитивный интерфейс для новичков
                </p>
              </div>
            </Card>

            <Card variant="glass" padding="lg" className="border border-primary-200">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h4 className="font-bold text-dark-900 mb-2">Качественно</h4>
                <p className="text-sm text-dark-600">
                  Наглядные визуализации от AI (оттенки и детали могут отличаться)
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </Layout>
    </AuthGuard>
  );
};
