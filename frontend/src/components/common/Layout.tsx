/**
 * Layout Component - Universal layout with header, hamburger menu, and back button
 * Used across all pages for consistent navigation
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MobileMenu } from './MobileMenu';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  showBalance?: boolean;
  showBackButton?: boolean;
  backTo?: string; // Optional custom back path
  gradient?: string; // Custom gradient for title icon
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  subtitle,
  icon,
  onBack,
  showBalance = true,
  showBackButton = true,
  backTo,
  gradient = 'from-primary-500 to-secondary-500',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshProfile } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isTrialUser =
    !!user &&
    !user.subscription_type &&
    user.created_at &&
    Date.now() - new Date(user.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  // Обновляем профиль при монтировании, чтобы баланс был актуален на любой странице
  React.useEffect(() => {
    refreshProfile().catch(() => {
      /* игнорируем ошибки автообновления */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const message = sessionStorage.getItem('emailVerifiedMessage');
    if (message) {
      toast.success(message);
      sessionStorage.removeItem('emailVerifiedMessage');
    }
  }, [location.pathname]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
    } else {
      // Smart back navigation
      if (location.pathname === '/') {
        // Already on home, do nothing
        return;
      }
      navigate(-1); // Go back in history
    }
  };

  const defaultIcon = (
    <img
      src="/logo.png"
      alt="AI Generator"
      className="w-10 h-10 rounded-lg object-contain bg-white shadow-lg border border-white"
    />
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-primary-50 via-white to-secondary-50 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            {/* Left side: Back button + Title */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {showBackButton && location.pathname !== '/' && (
                <button
                  onClick={handleBack}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-dark-700 hover:text-primary-600 transition-all shadow-sm hover:shadow-md"
                  aria-label="Назад"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-3 min-w-0"
              >
                <div
                  className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg`}
                >
                  {icon || defaultIcon}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold gradient-text truncate">{title}</h1>
                  {subtitle && <p className="text-sm text-dark-600 truncate">{subtitle}</p>}
                </div>
              </motion.div>
            </div>

            {/* Right side: Balance + Hamburger menu */}
            <div className="flex flex-wrap items-center gap-3 ml-0 sm:ml-3 w-full sm:w-auto justify-end">
              <a
                href="https://t.me/+Fj-R8QqIEEg5OTE6"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-white/80 border border-primary-100 text-primary-700 text-xs sm:text-sm font-semibold hover:bg-primary-50 transition whitespace-nowrap"
              >
                Наш канал в Telegram
              </a>
              {showBalance && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full sm:w-auto">
                  <Card variant="gradient" padding="sm" className="border border-primary-200 w-full sm:w-auto">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary-700">{user?.balance_credits ?? 0}</p>
                      <p className="text-xs text-primary-600 font-semibold whitespace-nowrap">кредитов</p>
                    </div>
                    {isTrialUser && (
                      <p className="mt-1 text-[11px] text-primary-50 font-semibold">
                        Пробный пакет активен
                      </p>
                    )}
                    {user?.subscription_type && user.subscription_type !== 'none' && (
                      <Badge variant="primary" size="sm" className="mt-1">
                        {user.subscription_type}
                      </Badge>
                    )}
                  </Card>
                </motion.div>
              )}

              {/* Hamburger menu button */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-dark-700 hover:text-primary-600 transition-all shadow-sm hover:shadow-md"
                aria-label="Открыть меню"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Email Verification Banner */}
      <EmailVerificationBanner />

      {/* Main content */}
      <main
        className="flex-1 w-full overflow-y-auto min-h-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>

      <footer className="bg-white/80 border-t border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-dark-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© AI Generator</span>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/oferta" className="hover:text-primary-700 underline-offset-2 hover:underline">Оферта</a>
            <a href="/privacy" className="hover:text-primary-700 underline-offset-2 hover:underline">Политика ПДн</a>
            <span className="text-dark-400">Cookie используются для авторизации и аналитики</span>
          </div>
        </div>
      </footer>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
};
