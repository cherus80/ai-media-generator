import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { getGenerationExamples } from '../api/content';
import type { GenerationExampleItem } from '../types/content';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const resolveImageUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;

const featureCards = [
  { title: 'Виртуальная примерка', desc: 'AI показывает посадку и образ на вашем фото — цвет и фактура могут отличаться от оригинала, это ориентировочная визуализация.', icon: 'fa-solid fa-shirt', iconWrapperClass: 'bg-sky-500 text-white' },
  { title: 'Редактирование фото в чате', desc: 'Опишите правки, прикрепите референсы и получите улучшенный промпт от AI.', icon: 'fa-solid fa-comments', iconWrapperClass: 'bg-purple-500 text-white' },
  { title: 'Мастер из 3 шагов', desc: 'Загрузка → выбор генерации → результат за несколько секунд.', icon: 'fa-solid fa-shoe-prints', iconWrapperClass: 'bg-slate-800 text-white' },
  { title: 'Гибкая система оплаты', desc: 'Используйте генерации по подписке или ⭐️звезды без ограничений.', icon: 'fa-solid fa-wallet', iconWrapperClass: 'bg-orange-100 text-orange-500' },
  { title: 'Бесплатный старт', desc: '10 ⭐️звезд бесплатно сразу после регистрации.', icon: 'fa-solid fa-bolt', iconWrapperClass: 'bg-green-100 text-green-500' },
  { title: 'Безопасность данных', desc: 'Фото хранятся временно и автоматически удаляются.', icon: 'fa-solid fa-shield-halved', iconWrapperClass: 'bg-slate-200 text-slate-600' },
];

const steps = [
  { title: 'Загрузите фотографию', desc: 'Добавьте своё фото или изображение товара.', accent: 'primary' },
  { title: 'Выберите тип генерации', desc: 'Виртуальная примерка или редактирование фото в чате.', accent: 'secondary' },
  { title: 'Получите результат', desc: 'Скачайте готовое изображение и используйте его дальше.', accent: 'accent' },
];

const stepHoverClasses: Record<string, string> = {
  primary: 'group-hover:border-sky-400 group-hover:text-sky-500',
  secondary: 'group-hover:border-purple-400 group-hover:text-purple-500',
  accent: 'group-hover:border-orange-400 group-hover:text-orange-500',
};

const subscriptionPlans = [
  {
    name: 'Basic',
    price: '369 ₽',
    per: '/ месяц',
    actions: '80',
    badge: { label: 'Basic', tone: 'bg-slate-100 text-slate-400' },
    highlight: false,
  },
  {
    name: 'Standard',
    price: '599 ₽',
    per: '/ месяц',
    actions: '130',
    badge: { label: 'Standard', tone: 'bg-blue-50 text-primary-500' },
    highlight: true,
  },
  {
    name: 'Premium',
    price: '1099 ₽',
    per: '/ месяц',
    actions: '250',
    badge: { label: 'Premium', tone: 'bg-slate-100 text-slate-400' },
    highlight: false,
  },
];

const creditPackages = [
  { name: 'Small', credits: 20, price: '100 ₽', highlight: false },
  { name: 'Medium', credits: 50, price: '230 ₽', highlight: false },
  { name: 'Large', credits: 100, price: '400 ₽', highlight: true },
  { name: 'Pro', credits: 250, price: '900 ₽', highlight: false },
];

const faqs = [
  { question: 'Насколько точна виртуальная примерка?', answer: 'Это AI-визуализация посадки. Из-за специфики моделей оттенок, фактура и детали могут отличаться от реального товара, поэтому не ждите 100% совпадения — используйте как наглядный предварительный пример.' },
  { question: 'Что такое генерации по подписке?', answer: 'Генерации — это количество запусков по подписке.' },
  { question: 'Что такое ⭐️звезды?', answer: '⭐️Звезды — это внутренняя валюта для генераций и AI-ассистента.' },
  { question: 'Сколько стоит одна генерация?', answer: '1 генерация по подписке или 2 ⭐️звезды без подписки.' },
  { question: 'Сколько стоит AI-ассистент?', answer: '1 ⭐️звезда за одно обращение.' },
  { question: 'Как работает редактирование фото?', answer: 'Загрузите фото, опишите правки в чате и при необходимости прикрепите референсы. Можно отправить промпт сразу или улучшить через AI — затем запустить генерацию.' },
  { question: 'Что выдаётся бесплатно?', answer: '10 ⭐️звезд при регистрации.' },
];

const testimonials = [
  { text: 'Примерка помогла оценить посадку куртки перед покупкой — визуализация оказалась близка к реальности.', name: 'Анна', city: 'Москва', badge: 'А', tone: 'from-sky-400 to-sky-600' },
  { text: 'Очень удобно для карточек товаров на маркетплейсах.', name: 'Дмитрий', city: 'Санкт-Петербург', badge: 'Д', tone: 'from-purple-500 to-purple-700' },
  { text: 'Экономит часы работы на обработке фото.', name: 'Елена', city: 'Новосибирск', badge: 'Е', tone: 'from-rose-400 to-orange-400' },
];

export const LandingPage: React.FC = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';
  const description =
    'Виртуальная примерка одежды и AI-редактирование фото. Загружайте изображения, выбирайте промпты и получайте реалистичные результаты.';
  const [topExamples, setTopExamples] = useState<GenerationExampleItem[]>([]);
  const [topExamplesLoading, setTopExamplesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadTopExamples = async () => {
      setTopExamplesLoading(true);
      try {
        const response = await getGenerationExamples({ sort: 'popular', limit: 6 });
        if (isMounted) {
          setTopExamples(response.items);
        }
      } catch {
        if (isMounted) {
          setTopExamples([]);
        }
      } finally {
        if (isMounted) {
          setTopExamplesLoading(false);
        }
      }
    };

    loadTopExamples();
    return () => {
      isMounted = false;
    };
  }, []);

  useSeo({
    title: 'AI Generator — виртуальная примерка и AI-редактирование фото',
    description,
    canonical: `${baseUrl}/`,
    image: `${baseUrl}/logo.png`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'AI Generator',
      url: `${baseUrl}/`,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'All',
      description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'RUB',
      },
      sameAs: ['https://t.me/+Fj-R8QqIEEg5OTE6'],
    },
  });
  return (
    <div className="landing-page bg-slate-50 text-slate-900">
      <header className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-3 min-h-[80px] py-3">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src="/logo.png"
                alt="AI Generator"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-md object-contain bg-white/70 p-2 border border-white flex-shrink-0"
              />
              <span className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight leading-tight truncate">
                AI Generator
              </span>
            </Link>

            <nav className="hidden md:flex space-x-8 text-sm font-medium">
              <a href="#features" className="text-slate-600 hover:text-secondary-500 transition-colors">Возможности</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-secondary-500 transition-colors">Как это работает</a>
              <a href="#pricing" className="text-slate-600 hover:text-secondary-500 transition-colors">Тарифы</a>
              <a href="#faq" className="text-slate-600 hover:text-secondary-500 transition-colors">FAQ</a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-4 text-sm font-semibold flex-shrink-0 max-[600px]:w-full max-[600px]:flex-col max-[600px]:items-end">
              <a
                href="https://t.me/+Fj-R8QqIEEg5OTE6"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-600 text-[11px] sm:text-xs hover:text-secondary-500 transition-colors whitespace-nowrap max-[600px]:order-2"
              >
                Наш канал в Telegram
              </a>
              <div className="flex items-center gap-2 sm:gap-4 max-[600px]:order-1">
                <Link
                  to="/login"
                  className="text-slate-700 hover:text-secondary-500 transition-colors px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm whitespace-nowrap"
                >
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-5 sm:px-6 py-2.5 rounded-full transition-all transform hover:scale-[1.02] shadow-lg whitespace-nowrap"
                >
                  Регистрация
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-32 lg:pt-40">
        <section className="relative pb-20 lg:pb-32 overflow-hidden">
          <div className="absolute bg-purple-200 w-96 h-96 rounded-full top-0 -left-20 blur-[80px] opacity-60" />
          <div className="absolute bg-blue-200 w-80 h-80 rounded-full bottom-0 right-0 blur-[80px] opacity-60" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-semibold mb-8 shadow-sm">
                <i className="fa-solid fa-gift" />
                  <span>Бонус при регистрации</span>
                </div>
                <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight mb-6 text-slate-900">
                  Виртуальная примерка и{' '}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500">AI-редактирование</span>
                </h1>
                <p className="text-xl text-slate-500 mb-6 leading-relaxed">
                  Загружайте фото, визуализируйте одежду, улучшайте изображения — AI подбирает посадку и образ, но оттенки и детали могут отличаться от реального товара.
                </p>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-soft mb-8 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-check" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Специальный оффер</p>
                    <p className="text-slate-500">
                      Каждому новому пользователю — <span className="text-purple-600 font-bold">10 бесплатных ⭐️звезд</span> сразу после регистрации.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-sky-400 to-sky-500 text-white text-lg px-8 py-4 rounded-full font-bold transition shadow-xl text-center hover:shadow-2xl"
                  >
                    Попробовать бесплатно
                  </Link>
                  <Link
                    to="/app/instructions?tab=video"
                    className="bg-white border border-slate-200 text-slate-700 text-lg px-8 py-4 rounded-full font-bold transition flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300"
                  >
                    <i className="fa-solid fa-play text-slate-400 text-xs" /> Смотреть как работает
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                  <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Выберите функцию</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">Начните с загрузки вашего фото, а затем выберите один из основных режимов генерации.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-8">
                    <div className="rounded-3xl border border-slate-100 shadow-soft overflow-hidden bg-white flex flex-col">
                      <div className="bg-gradient-to-r from-purple-500 to-sky-400 text-white px-6 sm:px-8 pt-6 pb-8 text-center">
                        <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(255,255,255,0.25)]">
                          <i className="fa-solid fa-shirt text-2xl" />
                        </div>
                        <h4 className="text-2xl font-bold mb-2">Примерка одежды</h4>
                        <p className="text-white/90 font-medium">Примерьте одежду и аксессуары на своё фото</p>
                      </div>
                      <div className="p-6 sm:p-8 flex flex-col gap-3">
                        <p className="text-slate-600">Загрузите своё фото и фото одежды — AI подготовит визуализацию посадки без гарантии точного совпадения с оригиналом</p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold self-start">
                          <i className="fa-solid fa-coins text-purple-500" />
                          <span>2 ⭐️звезды за примерку</span>
                        </div>
                        <Link
                          to="/register"
                          className="bg-gradient-to-r from-sky-400 to-sky-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition text-center"
                        >
                          Начать
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 shadow-soft overflow-hidden bg-white flex flex-col">
                      <div className="bg-gradient-to-r from-rose-400 to-amber-500 text-white px-6 sm:px-8 pt-6 pb-8 text-center">
                        <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(255,255,255,0.25)]">
                          <i className="fa-solid fa-palette text-2xl" />
                        </div>
                        <h4 className="text-2xl font-bold mb-2">Редактирование фото</h4>
                        <p className="text-white/90 font-medium">Чат-редактор с референсами и улучшением промпта</p>
                      </div>
                      <div className="p-6 sm:p-8 flex flex-col gap-3">
                        <p className="text-slate-600">Опишите правки, прикрепите референсы и выберите: отправить промпт сразу или улучшить его с AI</p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold self-start">
                          <i className="fa-solid fa-bolt text-orange-500" />
                          <span>1 ⭐️звезда за ассистента + 2 за генерацию (или 1 генерация по подписке)</span>
                        </div>
                        <Link
                          to="/register"
                          className="bg-gradient-to-r from-rose-400 to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition text-center"
                        >
                          Начать
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 sm:px-8 pb-6">
                    <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">
                        <i className="fa-solid fa-circle-info text-orange-500 mr-1" /> Каждая генерация списывает 1 генерацию по подписке или 2 ⭐️звезды.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute -z-10 top-10 -right-10 w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl opacity-50 blur-3xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-2">ТОП 6</h2>
              <p className="text-xl md:text-2xl font-extrabold text-slate-900">Самые популярные образцы</p>
              <p className="text-slate-500 mt-4 max-w-2xl mx-auto">
                Шесть образцов, по которым чаще всего запускают генерацию.
              </p>
            </div>

            {topExamplesLoading ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center text-slate-500">
                Загружаем примеры...
              </div>
            ) : topExamples.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center text-slate-500">
                Пока нет опубликованных примеров.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
                {topExamples.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden flex flex-col max-w-[360px] w-full">
                    <div className="relative">
                      <img
                        src={resolveImageUrl(item.image_url)}
                        alt={item.title || 'Пример генерации'}
                        className="w-full h-56 object-contain bg-slate-50"
                      />
                      <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                        {item.uses_count} запусков
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-3 flex-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {item.title || 'Без названия'}
                      </h3>
                      <Link
                        to="/register"
                        className="mt-auto px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:shadow-lg transition text-center"
                      >
                        Сгенерировать по этому образцу
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featureCards.map((feature) => (
                <div
                  key={feature.title}
                  className="bg-slate-50 p-8 rounded-3xl hover:bg-white hover:shadow-soft transition-all duration-300 group border border-transparent hover:border-slate-100"
                >
                  <div className={`w-14 h-14 ${feature.iconWrapperClass} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    <i className={`${feature.icon} text-2xl`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-800">{feature.title}</h3>
                  <p className="text-slate-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 bg-slate-50 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-16 text-slate-900">Как это работает</h2>
            <div className="grid md:grid-cols-3 gap-8 relative z-10">
              {steps.map((step, index) => (
                <div key={step.title} className="flex flex-col items-center text-center group">
                  <div
                    className={`w-20 h-20 rounded-full bg-white border-4 border-slate-100 text-slate-900 text-2xl font-bold flex items-center justify-center mb-6 shadow-sm transition-colors ${stepHoverClasses[step.accent]}`}
                  >
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-800">{step.title}</h3>
                  <p className="text-slate-500">{step.desc}</p>
                </div>
              ))}

              <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-1 bg-slate-200 -z-10 rounded-full" />
            </div>

            <div className="mt-16 bg-white rounded-2xl p-8 shadow-soft max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-primary-500 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-info text-lg" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 mb-2 text-lg">Стоимость генераций:</div>
                  <ul className="text-slate-500 space-y-2">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> 1 генерация = 1 генерация по подписке</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> или 2 ⭐️звезды без подписки</li>
                  </ul>
                </div>
              </div>
              <div className="h-px w-full md:w-px md:h-16 bg-slate-100" />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-robot text-lg" />
                </div>
                <div>
                  <span className="block font-bold text-slate-800 mb-2 text-lg">AI-ассистент:</span>
                  <span className="text-slate-500">1 ⭐️звезда = 1 обращение</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-slate-900">Выберите подписку</h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">Подписка даёт вам лимит генераций каждый месяц.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white rounded-3xl p-8 border ${plan.highlight ? 'border-2 border-primary-500 shadow-xl relative flex flex-col md:-translate-y-4' : 'border-slate-200 shadow-soft flex flex-col hover:-translate-y-2 transition-transform duration-300'}`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-sky-400 to-sky-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-lg uppercase shadow-md">Популярный</div>
                  )}
                  <div className="mb-4">
                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${plan.badge.tone}`}>
                      {plan.name}
                    </span>
                  </div>
                  <div className="flex items-baseline mb-6">
                    <span className={`text-4xl ${plan.highlight ? 'md:text-5xl' : ''} font-extrabold text-slate-900`}>{plan.price}</span>
                    <span className="text-slate-400 ml-2 font-medium">{plan.per}</span>
                  </div>
                  <div className={`mb-8 p-4 rounded-2xl ${plan.highlight ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                    <div className={`text-4xl font-bold ${plan.highlight ? 'text-primary-500' : 'text-slate-800'} mb-1`}>{plan.actions}</div>
                    <div className={`text-xs uppercase font-bold tracking-wider ${plan.highlight ? 'text-blue-400' : 'text-slate-400'}`}>генераций</div>
                  </div>
                  <p className={`text-slate-500 mb-8 flex-grow ${plan.highlight ? 'text-slate-600' : ''}`}>
                    {plan.name === 'Basic' && 'Подходит для первых тестов и личного использования.'}
                    {plan.name === 'Standard' && 'Для активных пользователей и продавцов.'}
                    {plan.name === 'Premium' && 'Для бизнеса, студий и агентств.'}
                  </p>
                  <Link
                    to="/pricing"
                    className={`w-full text-center font-bold rounded-xl ${plan.highlight ? 'py-4 bg-gradient-to-r from-sky-400 to-sky-600 text-white hover:shadow-xl transition-all text-lg' : 'py-3.5 border-2 border-slate-200 text-slate-700 hover:border-primary-400 hover:text-primary-500 transition-all'}`}
                  >
                    Выбрать
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-sm text-slate-500 bg-slate-50 inline-block px-6 py-3 rounded-full border border-slate-200">
                <i className="fa-solid fa-circle-exclamation text-orange-500 mr-2" /> Генерации по подписке списываются в первую очередь. Когда они заканчиваются — используются ⭐️звезды.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div>
                <h2 className="text-3xl font-bold mb-2 text-slate-900">Пакеты ⭐️звезд</h2>
                <p className="text-slate-500">Для максимальной гибкости. Работают без подписки.</p>
              </div>
              <div className="text-sm text-slate-500 text-right bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                ⭐️Звезды используются для генераций без подписки
                <br />и для AI-ассистента.
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {creditPackages.map((pack) => (
                <div
                  key={pack.name}
                  className={`bg-white p-6 rounded-2xl ${pack.highlight ? 'shadow-lg border-2 border-orange-400 cursor-pointer relative overflow-hidden transform hover:-translate-y-1 transition-all' : 'shadow-sm hover:shadow-md transition-all border border-slate-100 hover:border-orange-400/30 cursor-pointer group'}`}
                >
                  {pack.highlight && (
                    <div className="absolute top-0 right-0 bg-orange-500 px-3 py-1 text-[10px] text-white font-bold rounded-bl-lg">ХИТ</div>
                  )}
                  <h4 className="text-slate-800 font-bold text-lg mb-3">{pack.name}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-full ${pack.highlight ? 'bg-gradient-to-r from-rose-400 to-orange-500 text-white shadow-md' : 'bg-orange-100 text-orange-500'} flex items-center justify-center font-bold`}>
                      {pack.credits}
                    </div>
                    <span className="text-xs text-slate-400 uppercase font-bold">⭐️звезд</span>
                  </div>
                  <div className={`text-xl font-bold ${pack.highlight ? 'text-orange-500' : 'text-slate-600 group-hover:text-orange-500 transition-colors'}`}>{pack.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-1/3 h-full bg-purple-50 skew-x-12 opacity-50" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-16">
              <div className="md:w-1/2">
                <div className="inline-block p-4 rounded-2xl bg-purple-100 text-purple-600 mb-8">
                  <i className="fa-solid fa-wand-magic-sparkles text-3xl" />
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold mb-8 text-slate-900 leading-tight">Умный AI-ассистент для идеальных результатов</h2>
                <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                  Ассистент помогает формировать точные промпты, улучшать качество генераций и получать более аккуратные визуализации.
                </p>
                <div className="bg-white shadow-soft rounded-xl p-6 inline-flex flex-col border border-slate-100">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Стоимость использования</span>
                  <div className="text-slate-800 font-bold text-2xl flex items-center gap-2">
                    1 ⭐️звезда <span className="text-sm font-normal text-slate-400">= 1 обращение</span>
                  </div>
                </div>
              </div>

              <div className="md:w-1/2 w-full">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_35px_-12px_rgba(249,115,22,0.5)]">
                        <i className="fa-solid fa-wand-magic-sparkles" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg leading-tight">AI Редактор</p>
                        <p className="text-xs text-slate-400">Ассистент для фото</p>
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-white rounded-xl shadow-soft border border-slate-100 text-right">
                      <div className="text-lg font-extrabold text-slate-900 leading-none">106</div>
                      <div className="text-[11px] uppercase text-slate-400 tracking-wide leading-none">⭐️звезд</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 sm:px-6 py-6 flex flex-col gap-4">
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-gradient-to-r from-purple-600 to-sky-500 text-white px-4 py-3 rounded-2xl rounded-br-sm shadow-[0_12px_30px_-10px_rgba(59,130,246,0.45)] text-sm">
                        Замени цвет платья на красный
                        <div className="text-[11px] text-white/70 mt-1 text-right">20:37</div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-soft p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-[0_10px_30px_-12px_rgba(124,58,237,0.5)]">
                          <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-purple-600 uppercase">AI Assistant</p>
                          <p className="text-[11px] text-slate-400">13:37</p>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        Вот улучшенный промпт: <span className="font-semibold">“Преобразуй цвет платья, заменив текущий оттенок на яркий красный с сохранением текстуры ткани.”</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">Короткий</span>
                        <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold">Средний</span>
                        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">Детальный</span>
                      </div>
                      <button className="w-full bg-gradient-to-r from-sky-400 to-sky-600 text-white font-bold py-3 rounded-xl shadow-[0_14px_35px_-15px_rgba(59,130,246,0.8)] hover:shadow-[0_16px_38px_-14px_rgba(59,130,246,0.9)] transition">
                        Генерировать изображение
                      </button>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <i className="fa-solid fa-circle-info text-purple-600" />
                        <span>AI-ассистент −1 кр, генерация изображения −2 кр.</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-inner p-3 sm:p-4 flex items-center gap-3">
                      <input className="flex-1 bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400" placeholder="Опишите, как хотите изменить изображение..." />
                      <button className="px-4 py-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 text-white font-semibold text-sm shadow-[0_12px_30px_-12px_rgba(124,58,237,0.5)] flex items-center gap-2">
                        <i className="fa-solid fa-paper-plane text-xs" />
                        <span>Отправить</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-16 text-slate-900">Безопасность и надёжность</h2>
            <div className="grid md:grid-cols-4 gap-8">
              {['Временное хранение файлов', 'Автоматическое удаление', 'Платежи через ЮKassa', 'Защита персональных данных'].map((item) => (
                <div key={item} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-soft transition-all">
                  <p className="font-bold text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-16 text-slate-900">Отзывы пользователей</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((item) => (
                <div key={item.name} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 relative">
                  <div className="absolute top-8 right-8 text-slate-200 text-6xl font-serif">"</div>
                  <div className="flex items-center gap-1 text-yellow-400 text-xs mb-6">
                      {Array.from({ length: 5 }).map((_, idx) => (
                      <i key={idx} className="fa-solid fa-star" />
                    ))}
                  </div>
                  <p className="text-slate-600 mb-8 leading-relaxed relative z-10 font-medium">{item.text}</p>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${item.tone} flex items-center justify-center font-bold text-white shadow-md`}>
                      {item.badge}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-sm text-slate-400">{item.city}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Частые вопросы</h2>
            <div className="space-y-4">
              {faqs.map((item) => (
                <div key={item.question} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <h4 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-3">
                      <i className="fa-regular fa-circle-question text-primary-500" />
                      {item.question}
                    </h4>
                    <p className="text-slate-500 pl-8">{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gradient-to-r from-sky-400 to-purple-600">
          <div className="max-w-6xl mx-auto px-4 text-center text-white space-y-4">
            <h2 className="text-3xl font-extrabold">Готовы примерить и отредактировать?</h2>
            <p className="text-white/80 text-lg">Зарегистрируйтесь, получите 10 ⭐️звезд и начните прямо сейчас.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link to="/register" className="px-6 py-3 bg-white text-sky-600 font-semibold rounded-xl shadow-lg hover:shadow-xl transition">Попробовать бесплатно</Link>
              <Link to="/login" className="px-6 py-3 border border-white/70 text-white font-semibold rounded-xl hover:bg-white/10 transition">У меня уже есть аккаунт</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <Link to="/" className="flex items-center gap-3 mb-4">
                <img
                  src="/logo.png"
                  alt="AI Generator"
                  className="w-16 h-16 rounded-2xl shadow-md object-contain bg-white/70 p-2 border border-white"
                />
                <span className="font-bold text-lg text-slate-800">AI Generator</span>
              </Link>
              <p className="text-slate-500 text-sm">Виртуальная примерка и AI-редактирование изображений.</p>
            </div>

            <div>
              <h5 className="text-slate-900 font-bold mb-4">Ссылки</h5>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#pricing" className="hover:text-primary-500 transition-colors">Тарифы</a></li>
                <li><Link to="/contacts" className="hover:text-primary-500 transition-colors">Контакты</Link></li>
                <li><Link to="/oferta" className="hover:text-primary-500 transition-colors">Оферта</Link></li>
                <li><Link to="/privacy" className="hover:text-primary-500 transition-colors">Политика</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="text-slate-900 font-bold mb-4">Контакты</h5>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-center gap-2"><i className="fa-regular fa-envelope text-orange-500 w-4" /> ai-generator@mix4.ru</li>
                <li className="flex items-center gap-2"><i className="fa-solid fa-phone text-orange-500 w-4" /> +7 913 220-69-67</li>
                <li className="flex items-center gap-2"><i className="fa-regular fa-file-lines text-orange-500 w-4" /> ИНН 222312090918
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-8 text-center text-xs text-slate-400">
            &copy; 2024 AI Generator. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};
