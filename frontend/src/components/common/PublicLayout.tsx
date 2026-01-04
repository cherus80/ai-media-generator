import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Возможности', href: '/#features' },
  { label: 'Как это работает', href: '/#how-it-works' },
  { label: 'Инструкции', href: '/instructions?tab=video' },
  { label: 'Примеры', href: '/examples' },
  { label: 'Тарифы', href: '/pricing' },
  { label: 'Контакты', href: '/contacts' },
  { label: 'Оферта', href: '/oferta' },
  { label: 'Политика', href: '/privacy' },
];

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 text-dark-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-white/40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="AI Generator"
              className="w-12 h-12 rounded-2xl shadow-lg border border-white object-contain bg-white"
            />
            <div>
              <p className="text-sm text-dark-600 font-semibold">AI Generator</p>
              <p className="text-xs text-dark-400">Примерка и редактирование</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`px-2 py-1 rounded-lg transition ${
                  location.pathname === item.href
                    ? 'text-primary-700'
                    : 'text-dark-600 hover:text-primary-700'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-primary-700 border border-primary-200 rounded-xl hover:bg-primary-50 transition"
            >
              Войти
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 shadow-lg hover:shadow-xl transition hover:-translate-y-0.5"
            >
              Попробовать бесплатно
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <footer className="bg-white border-t border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-dark-600">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.png" alt="AI Generator" className="w-10 h-10 rounded-xl border border-white shadow-sm object-contain" />
              <p className="font-semibold text-dark-800">AI Generator</p>
            </div>
            <p>Виртуальная примерка и AI-редактирование изображений.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-dark-800">Ссылки</p>
            <Link to="/pricing" className="block hover:text-primary-700">Тарифы</Link>
            <Link to="/instructions?tab=video" className="block hover:text-primary-700">Инструкции</Link>
            <Link to="/examples" className="block hover:text-primary-700">Примеры</Link>
            <Link to="/contacts" className="block hover:text-primary-700">Контакты</Link>
            <Link to="/oferta" className="block hover:text-primary-700">Оферта</Link>
            <Link to="/privacy" className="block hover:text-primary-700">Политика</Link>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-dark-800">Контакты</p>
            <p>ai-generator@mix4.ru</p>
            <p>+7 913 220-69-67</p>
            <p>ИНН 222312090918</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
