import type { SeoOptions } from '../hooks/useSeo';

export const DEFAULT_SITE_URL = 'https://ai-generator.mix4.ru';

export type SeoRoutePath =
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/app'
  | '/app/about'
  | '/app/examples'
  | '/app/instructions'
  | '/pricing'
  | '/privacy'
  | '/contacts';

type RouteSeoDefinition = {
  title: string;
  description: string;
  noIndex?: boolean;
};

const ROUTE_SEO: Record<SeoRoutePath, RouteSeoDefinition> = {
  '/login': {
    title: 'Вход в аккаунт — ИИ Генератор',
    description: 'Войдите в аккаунт ИИ Генератор, чтобы управлять подпиской, запускать генерации и получать доступ к личным результатам.',
    noIndex: true,
  },
  '/register': {
    title: 'Регистрация — ИИ Генератор',
    description: 'Создайте аккаунт в ИИ Генератор, чтобы получить стартовые звезды, сохранить историю генераций и работать с примеркой и редактированием фото.',
    noIndex: true,
  },
  '/forgot-password': {
    title: 'Восстановление пароля — ИИ Генератор',
    description: 'Запросите ссылку для восстановления пароля от аккаунта ИИ Генератор, чтобы вернуть доступ к истории, тарифам и результатам.',
    noIndex: true,
  },
  '/app': {
    title: 'Личный кабинет — ИИ Генератор',
    description: 'Личный кабинет ИИ Генератор: быстрый доступ к виртуальной примерке, генерации фото, истории запусков и внутреннему балансу.',
    noIndex: true,
  },
  '/app/about': {
    title: 'О приложении — ИИ Генератор',
    description: 'Служебная страница с версией приложения, кратким описанием функций ИИ Генератор и ссылкой на поддержку.',
    noIndex: true,
  },
  '/app/examples': {
    title: 'Примеры генераций в приложении — ИИ Генератор',
    description: 'Внутренняя библиотека примеров ИИ Генератор для запуска генерации по готовым шаблонам внутри личного кабинета.',
    noIndex: true,
  },
  '/app/instructions': {
    title: 'Инструкции по использованию — ИИ Генератор',
    description: 'Служебные инструкции ИИ Генератор: как загрузить фото, выбрать режим и получить лучший результат в приложении.',
    noIndex: true,
  },
  '/pricing': {
    title: 'Тарифы на виртуальную примерку и генерацию фото — ИИ Генератор',
    description: 'Сравните подписки и пакеты звезд в ИИ Генератор: стоимость виртуальной примерки, генерации и редактирования фото, условия списания и мгновенное начисление после оплаты.',
  },
  '/privacy': {
    title: 'Политика конфиденциальности сервиса ИИ Генератор',
    description: 'Узнайте, какие персональные данные обрабатывает ИИ Генератор, где они хранятся, кому передаются и как запросить изменение или удаление информации.',
  },
  '/contacts': {
    title: 'Контакты и реквизиты — ИИ Генератор',
    description: 'Контакты службы поддержки, реквизиты самозанятого исполнителя, адрес, телефон и e-mail сервиса ИИ Генератор для связи по оплате и работе приложения.',
  },
};

export const getSiteOrigin = () =>
  typeof window !== 'undefined' ? window.location.origin : DEFAULT_SITE_URL;

export const resolveRouteSeo = (
  path: SeoRoutePath,
  origin: string = DEFAULT_SITE_URL
): SeoOptions => {
  const route = ROUTE_SEO[path];

  return {
    title: route.title,
    description: route.description,
    canonical: `${origin}${path}`,
    image: `${origin}/logo.png`,
    noIndex: route.noIndex,
  };
};
