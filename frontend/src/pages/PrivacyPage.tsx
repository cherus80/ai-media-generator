import React from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { useSeo } from '../hooks/useSeo';

export const PrivacyPage: React.FC = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';

  useSeo({
    title: 'Политика конфиденциальности — AI Generator',
    description: 'Правила обработки персональных данных и конфиденциальности в AI Generator.',
    canonical: `${baseUrl}/privacy`,
    image: `${baseUrl}/logo.png`,
  });

  return (
    <Layout
      title="Политика конфиденциальности"
      subtitle="Как мы обрабатываем ваши данные"
      backTo="/"
      showBackButton
      icon={
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 11c0-1.105.9-2 2-2s2 .895 2 2-1.343 2-3 4-1 3-1 3m-1-9c0-1.105-.9-2-2-2s-2 .895-2 2 1.343 2 3 4 1 3 1 3m-1 4h4"
          />
        </svg>
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">1. Обработка персональных данных</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Оператор: Чернов Руслан Васильевич, ИНН 222312090918 (далее — «Оператор»).</li>
            <li>Правовое основание: 152-ФЗ «О персональных данных», акцепт оферты и согласие при регистрации/входе.</li>
            <li>Состав данных: e-mail, имя/фамилия (если указаны), платежные идентификаторы (от ЮKassa), загруженные изображения и сообщения чата, технические данные (IP, user-agent, cookie/токены).</li>
            <li>Действия с данными: сбор, запись, систематизация, хранение, уточнение, использование, передача (в т.ч. ЮKassa и AI-провайдерам), обезличивание, блокирование и уничтожение.</li>
            <li>Трансграничная передача: возможна при использовании внешних AI/SMTP-провайдеров; пользователь соглашается на такую передачу для оказания услуги.</li>
            <li>Возрастное ограничение: сервис для пользователей 18+.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">2. Обрабатываемые данные</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Email, имя и фамилия (если указаны) — для регистрации и коммуникации.</li>
            <li>Файлы изображений и переписка с ассистентом — для оказания услуг (примерка, редактирование).</li>
            <li>Технические данные: IP, user-agent, cookie/токены — для защиты и авторизации.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">3. Цели обработки</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Оказание услуг по виртуальной примерке и AI-редактированию.</li>
            <li>Отправка служебных писем (подтверждение e-mail, статус операций, безопасность).</li>
            <li>Обеспечение безопасности, антиспам, соблюдение закона.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">4. Хранение</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Данные хранятся на VPS хостинге (Россия) для домена ai-generator.mix4.ru; доступ ограничен учетками администратора.</li>
            <li>База данных и файлы находятся на том же сервере; резервные копии могут храниться в том же дата-центре.</li>
            <li>Фото примерки удаляются через 24 часа.</li>
            <li>История чатов удаляется через 30 дней.</li>
            <li>Учетные данные хранятся пока активен аккаунт или требуется по закону.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">5. Передача третьим лицам</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Платежи обрабатывает ЮKassa — передаем минимальные платежные данные.</li>
            <li>AI-генерация выполняется сторонними моделями — изображения и промпты могут передаваться провайдеру модели.</li>
            <li>По закону данные могут быть предоставлены по запросу уполномоченных органов.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">6. Права пользователя</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Запросить актуализацию или удаление аккаунта и данных (если это не противоречит закону).</li>
            <li>Отозвать согласие на рассылку служебных писем невозможно — они необходимы для работы сервиса.</li>
            <li>Для запросов пишите: ai-generator@mix4.ru.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">7. Меры защиты</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Передача данных ведётся по HTTPS (TLS); подключение к сайту ai-generator.mix4.ru — только шифрованное.</li>
            <li>Пароли хранятся в виде хэша (bcrypt); доступ к базе и файлам ограничен учетными записями администратора.</li>
            <li>Минимизация данных: храним только необходимое для оказания услуги; фото удаляются через 24 часа, чаты через 30 дней.</li>
            <li>Резервные копии могут храниться в том же дата-центре; доступ к ним ограничен.</li>
            <li>Используются уникальные секретные ключи и токены; рекомендуем пользователям включать сложные пароли.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">8. Контакты и оператор</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Оператор: Чернов Руслан Васильевич, ИНН 222312090918.</li>
            <li>Почтовый адрес: г. Барнаул, ул. Энтузиастов 55-203, 656065.</li>
            <li>Телефон: +7 913 220-69-67, E-mail: ai-generator@mix4.ru.</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
};
