import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/authWeb';
import { isValidEmail } from '../utils/passwordValidation';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !isValidEmail(email)) {
      setError('Введите корректную эл. почту');
      return;
    }

    setIsLoading(true);
    try {
      const response = await requestPasswordReset({ email });
      setMessage(response.message);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Не удалось отправить письмо');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-10">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-white/70 shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-dark-900">Сброс пароля</h2>
          <p className="text-sm text-dark-600">
            Введите эл. почту, и мы отправим ссылку для сброса пароля.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {message && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-sm text-emerald-800">{message}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
              Эл. почта
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full h-12 px-4 border border-slate-200 rounded-xl bg-slate-50 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 text-slate-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 inline-flex items-center justify-center rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-400/30 hover:shadow-blue-400/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Отправка...' : 'Отправить ссылку'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Вспомнили пароль?{' '}
          <Link to="/login" className="text-primary-700 hover:text-primary-800 underline">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}
