import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

export const ContactsPage: React.FC = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ai-generator.mix4.ru';

  useSeo({
    title: 'Контакты — AI Generator',
    description: 'Контакты, реквизиты и способы связи с AI Generator.',
    canonical: `${baseUrl}/contacts`,
    image: `${baseUrl}/logo.png`,
  });

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
      <header className="fixed w-full top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="AI Generator"
                className="w-16 h-16 rounded-2xl shadow-md object-contain bg-white/70 p-2 border border-white"
              />
              <span className="font-bold text-xl text-slate-800 tracking-tight">AI Generator</span>
            </Link>

            <nav className="hidden md:flex space-x-8 text-sm font-medium">
              <a href="/#features" className="text-slate-600 hover:text-secondary-500 transition-colors">Возможности</a>
              <a href="/#how-it-works" className="text-slate-600 hover:text-secondary-500 transition-colors">Как это работает</a>
              <a href="/#pricing" className="text-slate-600 hover:text-secondary-500 transition-colors">Тарифы</a>
              <a href="/#faq" className="text-slate-600 hover:text-secondary-500 transition-colors">FAQ</a>
            </nav>

            <div className="flex items-center gap-4 text-sm font-semibold">
              <Link to="/login" className="hidden md:block text-slate-600 hover:text-secondary-500 transition-colors">
                Войти
              </Link>
              <Link
                to="/register"
                className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-2.5 rounded-full transition-all transform hover:scale-[1.02] shadow-lg"
              >
                Регистрация
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-semibold mb-4">
                <i className="fa-solid fa-address-card" />
                <span>Контакты и реквизиты</span>
              </p>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Связь и реквизиты исполнителя</h1>
              <p className="text-slate-600">
                Самозанятый: Чернов Руслан Васильевич. ИНН 222312090918. Домен ai-generator.mix4.ru.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 p-8">
              <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-file-lines text-purple-500" />
                  Основные данные
                </h2>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>ИНН: 222312090918</li>
                  <li>Статус: Самозанятый (НПД)</li>
                  <li>Телефон: +7 913 220-69-67</li>
                  <li>E-mail поддержки: ai-generator@mix4.ru</li>
                  <li>Почтовый адрес: Энтузиастов 55-203, 656065, г. Барнаул</li>
                  <li>Сайт: https://ai-generator.mix4.ru</li>
                  <li>Часы поддержки: 10:00–18:00 (МСК)</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-sky-500" />
                  Предоставление услуги
                </h2>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>Цифровой сервис: виртуальная примерка и AI-редактирование изображений.</li>
                  <li>Начисление после оплаты: мгновенно, баланс виден в профиле.</li>
                  <li>Хранение: фото удаляются через 24 часа; переписка — через 30 дней.</li>
                  <li>Физическая доставка не требуется.</li>
                </ul>
              </div>
            </div>

            <div className="px-8 pb-8">
              <div className="flex flex-wrap gap-3 text-sm font-semibold text-primary-700">
                <Link to="/pricing" className="hover:text-primary-800">Тарифы →</Link>
                <Link to="/oferta" className="hover:text-primary-800">Оферта →</Link>
                <Link to="/privacy" className="hover:text-primary-800">Политика →</Link>
              </div>
            </div>
          </div>
        </div>
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
                <li><a href="/#pricing" className="hover:text-primary-500 transition-colors">Тарифы</a></li>
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
                <li className="flex items-center gap-2"><i className="fa-regular fa-file-lines text-orange-500 w-4" /> ИНН 222312090918</li>
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
