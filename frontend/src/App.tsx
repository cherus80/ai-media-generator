import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { FittingPage } from './pages/FittingPage';
import { EditingPage } from './pages/EditingPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ErrorPage } from './pages/ErrorPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import MockPaymentEmulator from './pages/MockPaymentEmulator';
import { HistoryPage } from './pages/HistoryPage';
import { VerifyRequiredPage } from './pages/VerifyRequiredPage';
import { VKCallbackPage } from './pages/VKCallbackPage';
import { OfertaPage } from './pages/OfertaPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { LandingPage } from './pages/LandingPage';
import { PricingPage } from './pages/PricingPage';
import { ContactsPage } from './pages/ContactsPage';
import { CookieBanner } from './components/common/CookieBanner';
import { YandexMetrika } from './components/analytics/YandexMetrika';
import { PaymentReturnPage } from './pages/PaymentReturnPage';
import { InstructionsPage } from './pages/InstructionsPage';
import { ExamplesPage } from './pages/ExamplesPage';
import { ExampleGenerationPage } from './pages/ExampleGenerationPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Router>
        <Routes>
          {/* Auth pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<EmailVerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-required" element={<VerifyRequiredPage />} />
          <Route path="/vk/callback" element={<VKCallbackPage />} />

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
          <Route path="/mock-payment-emulator" element={<MockPaymentEmulator />} />

          {/* 404 страница */}
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
      <CookieBanner />
      <YandexMetrika />
    </>
  );
}

export default App;
