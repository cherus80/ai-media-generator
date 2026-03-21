import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CookieBanner } from './components/common/CookieBanner';
import { YandexMetrika } from './components/analytics/YandexMetrika';
import { Toaster } from 'react-hot-toast';

const lazyNamed = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  exportName: keyof T
) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as React.ComponentType<any> };
  });

const LoginPage = lazyNamed(() => import('./routes/authRoutes'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('./routes/authRoutes'), 'RegisterPage');
const EmailVerificationPage = lazyNamed(() => import('./routes/authRoutes'), 'EmailVerificationPage');
const ForgotPasswordPage = lazyNamed(() => import('./routes/authRoutes'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('./routes/authRoutes'), 'ResetPasswordPage');
const VerifyRequiredPage = lazyNamed(() => import('./routes/authRoutes'), 'VerifyRequiredPage');
const VKCallbackPage = lazyNamed(() => import('./routes/authRoutes'), 'VKCallbackPage');
const YandexCallbackPage = lazyNamed(() => import('./routes/authRoutes'), 'YandexCallbackPage');

const LandingPage = lazyNamed(() => import('./routes/publicRoutes'), 'LandingPage');
const PricingPage = lazyNamed(() => import('./routes/publicRoutes'), 'PricingPage');
const ContactsPage = lazyNamed(() => import('./routes/publicRoutes'), 'ContactsPage');
const OfertaPage = lazyNamed(() => import('./routes/publicRoutes'), 'OfertaPage');
const PrivacyPage = lazyNamed(() => import('./routes/publicRoutes'), 'PrivacyPage');
const PaymentReturnPage = lazyNamed(() => import('./routes/publicRoutes'), 'PaymentReturnPage');
const ErrorPage = lazyNamed(() => import('./routes/publicRoutes'), 'ErrorPage');

const HomePage = lazyNamed(() => import('./routes/appRoutes'), 'HomePage');
const InstructionsPage = lazyNamed(() => import('./routes/appRoutes'), 'InstructionsPage');
const ExamplesPage = lazyNamed(() => import('./routes/appRoutes'), 'ExamplesPage');
const ExampleGenerationPage = lazyNamed(() => import('./routes/appRoutes'), 'ExampleGenerationPage');
const AboutPage = lazyNamed(() => import('./routes/appRoutes'), 'AboutPage');
const FittingPage = lazyNamed(() => import('./routes/appRoutes'), 'FittingPage');
const EditingPage = lazyNamed(() => import('./routes/appRoutes'), 'EditingPage');
const ProfilePage = lazyNamed(() => import('./routes/appRoutes'), 'ProfilePage');
const HistoryPage = lazyNamed(() => import('./routes/appRoutes'), 'HistoryPage');
const NotificationsPage = lazyNamed(() => import('./routes/appRoutes'), 'NotificationsPage');

const AdminPage = lazyNamed(() => import('./routes/adminRoutes'), 'AdminPage');
const MockPaymentEmulatorPage = lazyNamed(() => import('./routes/adminRoutes'), 'MockPaymentEmulatorPage');

const RouteFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-500" />
      <p className="text-sm font-semibold text-slate-800">Загружаем интерфейс...</p>
      <p className="mt-2 text-sm text-slate-500">Подготавливаем нужный раздел приложения.</p>
    </div>
  </div>
);

function App() {
  return (
    <>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Auth pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<EmailVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-required" element={<VerifyRequiredPage />} />
            <Route path="/vk/callback" element={<VKCallbackPage />} />
            <Route path="/yandex/callback" element={<YandexCallbackPage />} />

            {/* Публичные страницы */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/oferta" element={<OfertaPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/instructions" element={<Navigate to="/app/instructions" replace />} />
            <Route path="/examples" element={<Navigate to="/app/examples" replace />} />
            <Route path="/payment/return" element={<PaymentReturnPage />} />

            {/* Главная страница приложения (после входа) */}
            <Route path="/app" element={<HomePage />} />
            <Route path="/app/instructions" element={<InstructionsPage />} />
            <Route path="/app/examples" element={<ExamplesPage />} />
            <Route path="/app/examples/generate" element={<ExampleGenerationPage />} />
            <Route path="/app/about" element={<AboutPage />} />

            {/* Функция 1: Примерка одежды */}
            <Route path="/fitting" element={<FittingPage />} />

            {/* Функция 2: Редактирование изображений */}
            <Route path="/editing" element={<EditingPage />} />

            {/* Профиль пользователя */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* Админ панель */}
            <Route path="/admin" element={<AdminPage />} />

            {/* Эмулятор платежей для тестирования */}
            <Route path="/mock-payment-emulator" element={<MockPaymentEmulatorPage />} />

            {/* 404 страница */}
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster position="top-right" />
      <CookieBanner />
      <YandexMetrika />
    </>
  );
}

export default App;
