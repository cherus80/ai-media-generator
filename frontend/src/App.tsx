import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { FittingPage } from './pages/FittingPage';
import { EditingPage } from './pages/EditingPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ErrorPage } from './pages/ErrorPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import MockPaymentEmulator from './pages/MockPaymentEmulator';
import { HistoryPage } from './pages/HistoryPage';
import { VerifyRequiredPage } from './pages/VerifyRequiredPage';
import { VKCallbackPage } from './pages/VKCallbackPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<EmailVerificationPage />} />
        <Route path="/verify-required" element={<VerifyRequiredPage />} />
        <Route path="/vk/callback" element={<VKCallbackPage />} />

        {/* Главная страница - выбор функции */}
        <Route path="/" element={<HomePage />} />

        {/* Функция 1: Примерка одежды */}
        <Route path="/fitting" element={<FittingPage />} />

        {/* Функция 2: Редактирование изображений */}
        <Route path="/editing" element={<EditingPage />} />

        {/* Профиль пользователя */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />

        {/* Админ панель */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Эмулятор платежей для тестирования */}
        <Route path="/mock-payment-emulator" element={<MockPaymentEmulator />} />

        {/* 404 страница */}
        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
