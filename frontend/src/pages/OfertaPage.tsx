import React from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { useSeo } from '../hooks/useSeo';

export const OfertaPage: React.FC = () => {
  const effectiveDate = '03.12.2025';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';

  useSeo({
    title: 'Публичная оферта — AI Generator',
    description: 'Условия оказания услуг виртуальной примерки и AI-редактирования.',
    canonical: `${baseUrl}/oferta`,
    image: `${baseUrl}/logo.png`,
  });

  return (
    <Layout
      title="Публичная оферта"
      subtitle={`Редакция от ${effectiveDate}`}
      backTo="/"
      showBackButton
      icon={
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-3-3v6m9 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">1. Термины</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li><strong>Сервис</strong> — AI Generator (виртуальная примерка и AI-редактирование изображений), домен ai-generator.mix4.ru.</li>
            <li><strong>Пользователь</strong> — лицо, принявшее оферту.</li>
            <li><strong>Аккаунт</strong> — учётная запись Пользователя в Сервисе.</li>
            <li><strong>Кредиты</strong> — условные единицы для операций в Сервисе.</li>
            <li><strong>Подписка</strong> — доступ к пакету операций на период.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200">
          <h2 className="text-2xl font-bold mb-3">2. Предмет</h2>
          <p className="text-dark-700 text-sm leading-relaxed">
            Исполнитель предоставляет доступ к функционалу Сервиса (виртуальная примерка, AI-редактирование изображений, хранение истории) на возмездной основе по условиям настоящей оферты.
          </p>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">3. Регистрация и аккаунт</h2>
          <p className="text-dark-700 text-sm leading-relaxed">Для использования требуется регистрация и подтверждение e-mail. Пользователь обеспечивает сохранность своих учётных данных.</p>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">4. Услуги и стоимость</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Тарифы и пакеты кредитов опубликованы на странице /pricing и формируются из текущего предложения Сервиса.</li>
            <li>Стоимость указана в российских рублях и отображается в окне оплаты ЮKassa.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">5. Порядок оплаты</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Оплата принимается через ЮKassa банковскими картами и иными поддерживаемыми способами.</li>
            <li>При успешной оплате кредиты или подписка начисляются автоматически в аккаунт.</li>
            <li>Доступ к операциям предоставляется сразу после начисления.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">6. Предоставление результата</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Результат — готовые изображения и/или доступ к операциям в Сервисе.</li>
            <li>Доступ к истории генераций — в разделе «История».</li>
            <li>Удаление фото примерки — через 24 часа; удаление чат-сессий — через 30 дней.</li>
            <li>Физическая доставка не требуется.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">7. Отказ и возвраты</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Если операция не выполнена по технической ошибке Сервиса и кредиты списаны, Пользователь вправе запросить перерасчёт или возврат через поддержку: ai-generator@mix4.ru.</li>
            <li>Возвраты производятся согласно законодательству РФ и правилам платёжной системы. Обращение — не позднее 14 дней с даты оплаты, с указанием ID платежа.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">8. Ограничения</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Запрещено загружать контент, нарушающий закон или права третьих лиц.</li>
            <li>Исполнитель может приостановить доступ при нарушении условий.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">9. Ответственность</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>
              Генерация изображений выполняется сторонними моделями (внешний AI-провайдер). Результат формируется автоматизированно, Исполнитель не контролирует работу алгоритмов, не гарантирует точность,
              соответствие ожиданиям или отсутствие артефактов, не отвечает за содержание и пригодность результата для целей Пользователя, а также за любые последствия его использования.
            </li>
            <li>Исполнитель не несёт ответственность за качество исходных изображений и корректность введённых данных Пользователем.</li>
            <li>Ответственность Исполнителя ограничена стоимостью оплаченного периода/пакета.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">10. Конфиденциальность и данные</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Персональные данные обрабатываются по политике конфиденциальности.</li>
            <li>Технические журналы и файлы хранятся ограниченный срок, необходимый для работы Сервиса.</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">11. Поддержка</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Телефон: +7 913 220-69-67</li>
            <li>E-mail: ai-generator@mix4.ru</li>
            <li>Часы поддержки: 10:00–18:00 (МСК)</li>
          </ul>
        </Card>

        <Card variant="glass" padding="lg" className="border border-primary-200 space-y-3">
          <h2 className="text-2xl font-bold">12. Прочие условия</h2>
          <ul className="space-y-2 text-dark-700 text-sm leading-relaxed">
            <li>Оферта вступает в силу с момента акцепта (оплаты или регистрации).</li>
            <li>Актуальная версия всегда доступна по адресу /oferta.</li>
            <li>Исполнитель: Чернов Руслан Васильевич, ИНН 222312090918, почтовый адрес: г. Барнаул, ул. Энтузиастов 55-203, 656065.</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
};
